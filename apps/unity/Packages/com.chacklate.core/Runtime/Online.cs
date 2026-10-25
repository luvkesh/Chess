// Online play against services/game-server: the same JSON protocol the web game speaks.
// Messages arrive on a background thread and wait in a queue; call Poll() from the thread that owns
// the game (Unity's main thread, in Update) so every event fires there.
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Chacklate.Core
{
    public interface ITransport
    {
        void Send(string text);
        bool TryReceive(out string text);   // non-blocking; false when nothing is waiting
        bool Open { get; }
    }

    // System.Net.WebSockets works in the Unity editor, standalone, iOS and Android builds (not WebGL).
    public sealed class WebSocketTransport : ITransport, IDisposable
    {
        readonly ClientWebSocket ws = new ClientWebSocket();
        readonly ConcurrentQueue<string> inbox = new ConcurrentQueue<string>();
        readonly CancellationTokenSource cts = new CancellationTokenSource();
        readonly SemaphoreSlim sendLock = new SemaphoreSlim(1, 1);
        public bool Open => ws.State == WebSocketState.Open;

        public static async Task<WebSocketTransport> Connect(Uri uri)
        {
            var t = new WebSocketTransport();
            await t.ws.ConnectAsync(uri, t.cts.Token);
            _ = t.ReceiveLoop();
            return t;
        }
        async Task ReceiveLoop()
        {
            var buf = new byte[16384];
            var msg = new StringBuilder();
            try
            {
                while (ws.State == WebSocketState.Open)
                {
                    var r = await ws.ReceiveAsync(new ArraySegment<byte>(buf), cts.Token);
                    if (r.MessageType == WebSocketMessageType.Close) break;
                    msg.Append(Encoding.UTF8.GetString(buf, 0, r.Count));
                    if (r.EndOfMessage) { inbox.Enqueue(msg.ToString()); msg.Clear(); }
                }
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
        }
        public void Send(string text)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            Task.Run(async () =>
            {
                await sendLock.WaitAsync();
                try { if (Open) await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cts.Token); }
                catch (WebSocketException) { }
                finally { sendLock.Release(); }
            });
        }
        public bool TryReceive(out string text) => inbox.TryDequeue(out text);
        public void Dispose() { cts.Cancel(); ws.Dispose(); }
    }

    public sealed class MatchInfo
    {
        public string Id, Tc, OpponentName;
        public Side Me;
        public bool Rated;
        public int? OpponentRating;
    }

    public sealed class GameClient
    {
        readonly ITransport transport;
        public string Token { get; private set; }
        public string Name { get; private set; }
        public bool Guest { get; private set; }
        public bool Ready { get; private set; }
        public MatchInfo Match { get; private set; }
        public Game Game { get; private set; }
        public long ClockWhiteMs { get; private set; }
        public long ClockBlackMs { get; private set; }

        public event Action Welcomed;
        public event Action<string> Seeking;
        public event Action<string> FriendCode;
        public event Action<MatchInfo> Started;
        public event Action<Move, string> OpponentMoved;    // move, SAN
        public event Action Synced;
        public event Action<string, string, int?> Ended;     // result, reason, rating change
        public event Action DrawOffered;
        public event Action<string> Error;

        public GameClient(ITransport transport) { this.transport = transport; }

        void Send(Dictionary<string, object> m) => transport.Send(Json.Write(m));
        static Dictionary<string, object> Msg(string type, params object[] kv)
        {
            var d = new Dictionary<string, object> { ["type"] = type };
            for (int i = 0; i + 1 < kv.Length; i += 2) d[(string)kv[i]] = kv[i + 1];
            return d;
        }

        public void Hello(string token = null) => Send(Msg("hello", "token", token ?? ""));
        public void Seek(string tc = "5+3") => Send(Msg("seek", "tc", tc));
        public void Cancel() => Send(Msg("cancel"));
        public void CreateFriendGame(string tc) => Send(Msg("friend-create", "tc", tc));
        public void JoinFriendGame(string code) => Send(Msg("friend-join", "code", code));
        public void Resign() => Send(Msg("resign"));
        public void OfferDraw() => Send(Msg("draw-offer"));
        public void AcceptDraw() => Send(Msg("draw-accept"));
        public void ClaimDraw() => Send(Msg("claim"));
        public void RequestSync() => Send(Msg("sync"));

        // Plays your move locally (it must be legal and your turn) and sends it. Returns the SAN or null.
        public string PlayMove(string uciOrSan)
        {
            if (Game == null || Match == null || Game.Outcome != null || Game.Pos.ToMove != Match.Me) return null;
            var m = Game.Pos.ParseMove(uciOrSan, Game.Legal);
            if (!m.HasValue) return null;
            int ply = Game.Moves.Count;
            var san = Game.Play(m.Value);
            if (san != null) Send(Msg("move", "uci", m.Value.Uci, "ply", ply));
            return san;
        }

        // Handles everything that has arrived. Returns how many messages were processed.
        public int Poll()
        {
            int n = 0;
            while (transport.TryReceive(out var text))
            {
                n++;
                Dictionary<string, object> m;
                try { m = Json.Parse(text) as Dictionary<string, object>; } catch (FormatException) { continue; }
                if (m != null) Handle(m);
            }
            return n;
        }

        void Clock(Dictionary<string, object> c)
        {
            if (c == null) return;
            ClockWhiteMs = (long)c.Num("w", ClockWhiteMs);
            ClockBlackMs = (long)c.Num("b", ClockBlackMs);
        }
        static Game Replay(List<object> moves)
        {
            var g = new Game();
            if (moves != null) foreach (var u in moves) if (u is string s) g.Play(s);
            return g;
        }

        void Handle(Dictionary<string, object> m)
        {
            switch (m.Str("type"))
            {
                case "welcome":
                    var u = m.Obj("user");
                    Token = m.Str("token"); Name = u.Str("name"); Guest = u.Bool("guest"); Ready = true;
                    Welcomed?.Invoke();
                    break;
                case "seeking": Seeking?.Invoke(m.Str("tc")); break;
                case "friend-code": FriendCode?.Invoke(m.Str("code")); break;
                case "start":
                    var opp = m.Obj("opponent");
                    var r = opp != null && opp.TryGetValue("rating", out var rv) && rv is double d ? (int?)Math.Round(d) : null;
                    Match = new MatchInfo { Id = m.Str("id"), Tc = m.Str("tc"), Rated = m.Bool("rated"), Me = m.Str("color") == "black" ? Side.Black : Side.White, OpponentName = opp.Str("name"), OpponentRating = r };
                    Game = Replay(m.Arr("moves"));
                    Clock(m.Obj("clock"));
                    Started?.Invoke(Match);
                    break;
                case "move":
                    Clock(m.Obj("clock"));
                    if (Game == null) break;
                    var mv = Game.Pos.ParseMove(m.Str("uci"), Game.Legal);
                    if (!mv.HasValue) { RequestSync(); break; }
                    var san = Game.Play(mv.Value);
                    OpponentMoved?.Invoke(mv.Value, san);
                    break;
                case "ack": Clock(m.Obj("clock")); break;
                case "sync":
                    Clock(m.Obj("clock"));
                    Game = Replay(m.Arr("moves"));
                    Synced?.Invoke();
                    break;
                case "draw-offer": DrawOffered?.Invoke(); break;
                case "end":
                    Clock(m.Obj("clock"));
                    if (Game != null && Game.Outcome == null) Game.Finish(m.Str("result"), m.Str("reason"));
                    var rt = m.Obj("rating");
                    int? delta = rt != null ? (int?)(int)(rt.Num("after") - rt.Num("before")) : null;
                    Ended?.Invoke(m.Str("result"), m.Str("reason"), delta);
                    break;
                case "banned": case "deleted": Ready = false; Error?.Invoke(m.Str("reason")); break;
                case "error": Error?.Invoke(m.Str("message")); break;
            }
        }
    }
}

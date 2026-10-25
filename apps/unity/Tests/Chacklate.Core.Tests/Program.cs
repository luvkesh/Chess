// Tests for the Unity rules and protocol code. LangVersion 9 matches what Unity compiles.
// Fixtures come from the JavaScript rules: node ../fixtures.js > fixtures.json
// Set CHACKLATE_SERVER=ws://127.0.0.1:8080/ws to also play a game against a running server.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using Chacklate.Core;

static class Program
{
    static int failures, checks;
    static void Check(bool ok, string what) { checks++; if (!ok) { failures++; Console.WriteLine("FAIL " + what); } }

    static int Main()
    {
        Perft();
        Rules();
        Fixtures();
        JsonRoundTrip();
        ClientWithFakeServer();
        var server = Environment.GetEnvironmentVariable("CHACKLATE_SERVER");
        if (!string.IsNullOrEmpty(server)) LiveServer(server);
        else Console.WriteLine("live server test skipped (set CHACKLATE_SERVER)");
        Console.WriteLine(failures == 0 ? "all " + checks + " checks passed" : failures + " of " + checks + " checks failed");
        return failures == 0 ? 0 : 1;
    }

    static void Perft()
    {
        var cases = new (string fen, long[] counts)[]
        {
            (Position.StartFen, new long[] { 20, 400, 8902, 197281 }),
            ("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", new long[] { 48, 2039, 97862 }),
            ("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", new long[] { 14, 191, 2812, 43238 }),
            ("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", new long[] { 6, 264, 9467 }),
            ("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", new long[] { 44, 1486, 62379 }),
        };
        foreach (var (fen, counts) in cases)
            for (int d = 1; d <= counts.Length; d++)
            {
                long n = Position.Perft(Position.FromFen(fen), d);
                Check(n == counts[d - 1], "perft " + d + " of " + fen + ": " + n + " vs " + counts[d - 1]);
            }
        Console.WriteLine("perft done");
    }

    static void Rules()
    {
        var g = new Game();
        foreach (var s in new[] { "f3", "e5", "g4", "Qh4" }) Check(g.Play(s) != null, "fool's mate move " + s);
        Check(g.Sans.Last() == "Qh4#", "mate suffix: " + g.Sans.Last());
        Check(g.Outcome != null && g.Outcome.Result == "0-1" && g.Outcome.Reason == "checkmate", "fool's mate outcome");
        Check(g.Play("a3") == null, "no moves after the end");

        // Repetition: threefold is claimable, fivefold ends the game.
        g = new Game();
        for (int i = 0; i < 2; i++) foreach (var s in new[] { "Nf3", "Nf6", "Ng1", "Ng8" }) g.Play(s);
        Check(g.Repetitions() == 3 && g.Claimable() == "threefold", "threefold claim");
        for (int i = 0; i < 2; i++) foreach (var s in new[] { "Nf3", "Nf6", "Ng1", "Ng8" }) g.Play(s);
        Check(g.Outcome != null && g.Outcome.Reason == "fivefold", "fivefold");

        // SAN details: castling, en passant, promotion with check, disambiguation, lenient input.
        g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
        Check(g.Legal.Any(m => g.Pos.San(m, g.Legal) == "O-O-O"), "queenside castling listed");
        Check(g.Play("0-0") == "O-O", "0-0 accepted");
        g = new Game("4k3/8/8/2pP4/8/8/8/4K3 w - c6 0 2");
        Check(g.Play("dxc6") == "dxc6", "en passant");
        Check(g.Pos.Board[Square.Parse("c5")] == 0, "en passant removes the pawn");
        g = new Game("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
        Check(g.Play("b8Q") == "b8=Q+", "promotion with check from lenient input");
        g = new Game("4k3/8/8/8/8/8/8/R4RK1 w - - 0 1");
        Check(g.Pos.San(g.Pos.ParseMove("a1d1").Value) == "Rad1", "file disambiguation");
        g = new Game("4k3/8/8/8/8/8/8/K6N w - - 0 1");
        Check(g.Outcome != null && g.Outcome.Reason == "insufficient", "K+N v K is a dead position");
        bool threw = false; try { Position.FromFen("8/8/8/8/8/8/8/8 w - - 0 1"); } catch (FormatException) { threw = true; }
        Check(threw, "FEN without kings rejected");
        Check(new Game().Undo() == false, "nothing to undo");
        g = new Game(); g.Play("e4"); Check(g.Undo() && g.Pos.Fen() == Position.StartFen, "undo restores the start");
        Console.WriteLine("rules done");
    }

    static void Fixtures()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures.json");
        if (!File.Exists(path)) path = "fixtures.json";
        if (!File.Exists(path)) { Check(false, "fixtures.json missing: run node ../fixtures.js > fixtures.json"); return; }
        var root = (Dictionary<string, object>)Json.Parse(File.ReadAllText(path));
        int plies = 0, games = 0;
        foreach (Dictionary<string, object> gm in root.Arr("games"))
        {
            games++;
            var g = new Game(gm.Str("start"));
            foreach (Dictionary<string, object> p in gm.Arr("plies"))
            {
                plies++;
                string where = "game " + games + " ply " + g.Moves.Count;
                Check(g.Pos.Fen() == p.Str("fen"), where + " fen " + g.Pos.Fen() + " vs " + p.Str("fen"));
                var mine = g.Legal.Select(m => g.Pos.San(m, g.Legal)).OrderBy(x => x, StringComparer.Ordinal).ToList();
                var theirs = p.Arr("sans").Cast<string>().OrderBy(x => x, StringComparer.Ordinal).ToList();
                if (!mine.SequenceEqual(theirs)) { Check(false, where + " legal moves differ at " + p.Str("fen") + ": " + string.Join(" ", mine.Except(theirs)) + " / " + string.Join(" ", theirs.Except(mine))); return; }
                Check(g.Repetitions() == (int)p.Num("reps"), where + " repetitions");
                Check(g.Claimable() == p.Str("claim"), where + " claim");
                var san = g.Play(p.Str("uci"));
                Check(san == p.Str("san"), where + " san " + san + " vs " + p.Str("san"));
            }
            var end = gm.Obj("end");
            Check(g.Pos.Fen() == end.Str("fen"), "game " + games + " final fen");
            var oc = end.Obj("outcome");
            Check(oc == null ? g.Outcome == null : g.Outcome != null && g.Outcome.Result == oc.Str("result") && g.Outcome.Reason == oc.Str("reason"),
                "game " + games + " outcome " + (g.Outcome == null ? "none" : g.Outcome.Reason) + " vs " + (oc == null ? "none" : oc.Str("reason")));
        }
        Console.WriteLine("fixtures done: " + games + " games, " + plies + " plies match the JavaScript rules");
    }

    static void JsonRoundTrip()
    {
        var s = "{\"type\":\"start\",\"n\":-1.5e2,\"ok\":true,\"none\":null,\"list\":[1,\"a\\\"b\",{\"x\":\"\\u00e9\\n\"}]}";
        var o = (Dictionary<string, object>)Json.Parse(s);
        Check(o.Str("type") == "start" && o.Num("n") == -150 && o.Bool("ok") && o["none"] == null, "json scalars");
        var back = (Dictionary<string, object>)Json.Parse(Json.Write(o));
        Check(((Dictionary<string, object>)back.Arr("list")[2]).Str("x") == "é\n" && (string)back.Arr("list")[1] == "a\"b", "json round trip");
    }

    sealed class FakeTransport : ITransport
    {
        public readonly Queue<string> ToClient = new Queue<string>();
        public readonly List<Dictionary<string, object>> Sent = new List<Dictionary<string, object>>();
        public bool Open => true;
        public void Send(string text) => Sent.Add((Dictionary<string, object>)Json.Parse(text));
        public bool TryReceive(out string text) { if (ToClient.Count > 0) { text = ToClient.Dequeue(); return true; } text = null; return false; }
    }

    static void ClientWithFakeServer()
    {
        var t = new FakeTransport();
        var c = new GameClient(t);
        string moved = null, ended = null; int? delta = null;
        c.OpponentMoved += (m, san) => moved = san;
        c.Ended += (r, why, d) => { ended = r + " " + why; delta = d; };
        c.Hello();
        Check(t.Sent[0].Str("type") == "hello", "hello sent");
        t.ToClient.Enqueue("{\"type\":\"welcome\",\"token\":\"tok\",\"user\":{\"id\":1,\"name\":\"Guest1\",\"guest\":true}}");
        t.ToClient.Enqueue("{\"type\":\"start\",\"id\":\"g1\",\"color\":\"black\",\"tc\":\"5+3\",\"rated\":true,\"opponent\":{\"name\":\"Ana\",\"rating\":1500},\"moves\":[\"f2f3\"],\"clock\":{\"w\":300000,\"b\":300000}}");
        c.Poll();
        Check(c.Ready && c.Token == "tok" && c.Name == "Guest1", "welcome handled");
        Check(c.Match.Me == Side.Black && c.Match.OpponentName == "Ana" && c.Match.OpponentRating == 1500 && c.Game.Moves.Count == 1, "start handled with moves so far");
        Check(c.PlayMove("Nf3") == null, "illegal move refused locally");
        Check(c.PlayMove("e5") == "e5", "own move played");
        var last = t.Sent.Last();
        Check(last.Str("type") == "move" && last.Str("uci") == "e7e5" && last.Num("ply") == 1, "move sent with ply");
        Check(c.PlayMove("d5") == null, "not your turn");
        t.ToClient.Enqueue("{\"type\":\"move\",\"uci\":\"g2g4\",\"clock\":{\"w\":290000,\"b\":295000}}");
        c.Poll();
        Check(moved == "g4" && c.ClockWhiteMs == 290000, "opponent move and clock");
        Check(c.PlayMove("Qh4") == "Qh4#", "mate");
        t.ToClient.Enqueue("{\"type\":\"end\",\"result\":\"0-1\",\"reason\":\"checkmate\",\"rating\":{\"before\":1500,\"after\":1662}}");
        c.Poll();
        Check(ended == "0-1 checkmate" && delta == 162, "end with rating change");
        t.ToClient.Enqueue("not json");
        Check(c.Poll() == 1, "bad frames are skipped");
    }

    // Two clients find each other on a real server and play Fool's mate.
    static void LiveServer(string url)
    {
        var a = new GameClient(WebSocketTransport.Connect(new Uri(url)).GetAwaiter().GetResult());
        var b = new GameClient(WebSocketTransport.Connect(new Uri(url)).GetAwaiter().GetResult());
        string endA = null, endB = null;
        a.Ended += (r, why, d) => endA = r + " " + why;
        b.Ended += (r, why, d) => endB = r + " " + why;
        a.Hello(); b.Hello();
        Wait(() => a.Ready && b.Ready, a, b, "welcome");
        a.Seek("3+2"); b.Seek("3+2");
        Wait(() => a.Match != null && b.Match != null, a, b, "pairing");
        var white = a.Match.Me == Side.White ? a : b; var black = white == a ? b : a;
        foreach (var (who, mv) in new[] { (white, "f3"), (black, "e5"), (white, "g4"), (black, "Qh4") })
        {
            Wait(() => who.Game.Pos.ToMove == who.Match.Me, a, b, "turn for " + mv);
            Check(who.PlayMove(mv) != null, "live move " + mv);
        }
        Wait(() => endA != null && endB != null, a, b, "game end");
        Check(endA == "0-1 checkmate" && endB == "0-1 checkmate", "server agrees on the result: " + endA + " / " + endB);
        Console.WriteLine("live server game done");
    }
    static void Wait(Func<bool> ok, GameClient a, GameClient b, string what)
    {
        var until = DateTime.UtcNow.AddSeconds(10);
        while (!ok() && DateTime.UtcNow < until) { a.Poll(); b.Poll(); Thread.Sleep(20); }
        Check(ok(), "timed out waiting for " + what);
    }
}

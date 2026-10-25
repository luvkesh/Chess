// Chess rules for the Unity clients: a C# port of packages/chess-core/src/engine.js (rules only, no AI).
// Same FEN, SAN, UCI and draw rules as the server and the web game, so a position or a move list
// means the same thing everywhere. Plain C# with no UnityEngine references; tested outside Unity.
using System;
using System.Collections.Generic;
using System.Text;

namespace Chacklate.Core
{
    public enum Side { White = 0, Black = 1 }

    public static class Pieces
    {
        public const int None = 0, Pawn = 1, Knight = 2, Bishop = 3, Rook = 4, Queen = 5, King = 6;
        public const int BlackFlag = 8;
        public static int Make(int kind, Side side) => kind | (side == Side.Black ? BlackFlag : 0);
        public static int Kind(int piece) => piece & 7;
        public static Side SideOf(int piece) => (piece & BlackFlag) != 0 ? Side.Black : Side.White;
        public const string Letters = " PNBRQK";
    }

    [Flags]
    public enum MoveFlags { None = 0, Capture = 1, EnPassant = 2, Castle = 4, DoublePush = 8 }

    public readonly struct Move : IEquatable<Move>
    {
        public readonly int From, To, Promotion;
        public readonly MoveFlags Flags;
        public Move(int from, int to, MoveFlags flags, int promotion = 0) { From = from; To = to; Flags = flags; Promotion = promotion; }
        public bool Is(MoveFlags f) => (Flags & f) != 0;
        public string Uci => Square.Name(From) + Square.Name(To) + (Promotion != 0 ? "pnbrqk"[Promotion - 1].ToString() : "");
        public bool Equals(Move o) => From == o.From && To == o.To && Promotion == o.Promotion;
        public override bool Equals(object obj) => obj is Move m && Equals(m);
        public override int GetHashCode() => From | (To << 6) | (Promotion << 12);
        public override string ToString() => Uci;
    }

    public static class Square
    {
        // a1 = 0, h1 = 7, a8 = 56.
        public static int File(int sq) => sq & 7;
        public static int Rank(int sq) => sq >> 3;
        public static string Name(int sq) => "abcdefgh"[sq & 7].ToString() + (char)('1' + (sq >> 3));
        public static int Parse(string s)
        {
            if (s == null || s.Length != 2 || s[0] < 'a' || s[0] > 'h' || s[1] < '1' || s[1] > '8') return -1;
            return (s[0] - 'a') + 8 * (s[1] - '1');
        }
    }

    public sealed class Position
    {
        public const string StartFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        public readonly int[] Board = new int[64];
        public Side ToMove;
        public int Castling;      // 1 = K, 2 = Q, 4 = k, 8 = q
        public int EnPassant = -1;
        public int HalfMove, FullMove = 1;

        static readonly int[] KnightD = { 17, 15, 10, 6, -6, -10, -15, -17 };
        static readonly int[] KingD = { 9, 8, 7, 1, -1, -7, -8, -9 };
        static readonly int[] BishopD = { 9, 7, -7, -9 };
        static readonly int[] RookD = { 8, 1, -1, -8 };

        public static Position FromFen(string fen)
        {
            var p = new Position();
            var f = (fen ?? "").Trim().Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
            if (f.Length < 4) throw new FormatException("FEN needs at least 4 fields");
            var rows = f[0].Split('/');
            if (rows.Length != 8) throw new FormatException("FEN board needs 8 ranks");
            for (int r = 0; r < 8; r++)
            {
                int file = 0, rank = 7 - r;
                foreach (char c in rows[r])
                {
                    if (c >= '1' && c <= '8') { file += c - '0'; continue; }
                    int kind = Pieces.Letters.IndexOf(char.ToUpperInvariant(c));
                    if (kind <= 0 || file > 7) throw new FormatException("Bad FEN board");
                    p.Board[rank * 8 + file] = Pieces.Make(kind, char.IsUpper(c) ? Side.White : Side.Black);
                    file++;
                }
                if (file != 8) throw new FormatException("Bad FEN rank length");
            }
            p.ToMove = f[1] == "b" ? Side.Black : Side.White;
            foreach (char c in f[2]) p.Castling |= c == 'K' ? 1 : c == 'Q' ? 2 : c == 'k' ? 4 : c == 'q' ? 8 : 0;
            // Drop castling rights the board cannot support.
            if (p.Board[4] != Pieces.Make(Pieces.King, Side.White)) p.Castling &= ~3;
            if (p.Board[7] != Pieces.Make(Pieces.Rook, Side.White)) p.Castling &= ~1;
            if (p.Board[0] != Pieces.Make(Pieces.Rook, Side.White)) p.Castling &= ~2;
            if (p.Board[60] != Pieces.Make(Pieces.King, Side.Black)) p.Castling &= ~12;
            if (p.Board[63] != Pieces.Make(Pieces.Rook, Side.Black)) p.Castling &= ~4;
            if (p.Board[56] != Pieces.Make(Pieces.Rook, Side.Black)) p.Castling &= ~8;
            p.EnPassant = f[3] == "-" ? -1 : Square.Parse(f[3]);
            p.HalfMove = f.Length > 4 && int.TryParse(f[4], out var h) ? h : 0;
            p.FullMove = f.Length > 5 && int.TryParse(f[5], out var n) ? Math.Max(1, n) : 1;
            int wk = 0, bk = 0;
            foreach (var pc in p.Board) { if (pc == Pieces.Make(Pieces.King, Side.White)) wk++; if (pc == Pieces.Make(Pieces.King, Side.Black)) bk++; }
            if (wk != 1 || bk != 1) throw new FormatException("Each side needs exactly one king");
            return p;
        }

        public Position Clone()
        {
            var c = new Position { ToMove = ToMove, Castling = Castling, EnPassant = EnPassant, HalfMove = HalfMove, FullMove = FullMove };
            Array.Copy(Board, c.Board, 64);
            return c;
        }

        string BoardFen()
        {
            var sb = new StringBuilder();
            for (int rank = 7; rank >= 0; rank--)
            {
                int empty = 0;
                for (int file = 0; file < 8; file++)
                {
                    int pc = Board[rank * 8 + file];
                    if (pc == 0) { empty++; continue; }
                    if (empty > 0) { sb.Append(empty); empty = 0; }
                    char ch = Pieces.Letters[Pieces.Kind(pc)];
                    sb.Append(Pieces.SideOf(pc) == Side.White ? ch : char.ToLowerInvariant(ch));
                }
                if (empty > 0) sb.Append(empty);
                if (rank > 0) sb.Append('/');
            }
            return sb.ToString();
        }
        string CastlingFen()
        {
            var c = (Castling & 1) != 0 ? "K" : "";
            if ((Castling & 2) != 0) c += "Q";
            if ((Castling & 4) != 0) c += "k";
            if ((Castling & 8) != 0) c += "q";
            return c.Length > 0 ? c : "-";
        }
        public string Fen() => BoardFen() + " " + (ToMove == Side.White ? "w" : "b") + " " + CastlingFen() + " " + (EnPassant >= 0 ? Square.Name(EnPassant) : "-") + " " + HalfMove + " " + FullMove;

        // Repetition identity: the en passant square counts only when the capture is actually possible.
        public string RepetitionKey()
        {
            bool ep = false;
            if (EnPassant >= 0) foreach (var m in LegalMoves()) if (m.Is(MoveFlags.EnPassant)) { ep = true; break; }
            return BoardFen() + " " + (ToMove == Side.White ? "w" : "b") + " " + CastlingFen() + " " + (ep ? Square.Name(EnPassant) : "-");
        }

        static bool OnBoardStep(int from, int to, int maxFileJump) => to >= 0 && to < 64 && Math.Abs(Square.File(to) - Square.File(from)) <= maxFileJump;

        public bool IsAttacked(int sq, Side by)
        {
            int pawnDir = by == Side.White ? -8 : 8;   // look back toward the attacker's pawns
            foreach (int df in new[] { -1, 1 })
            {
                int s = sq + pawnDir + df;
                if (OnBoardStep(sq, s, 1) && Square.Rank(s) == Square.Rank(sq) + (by == Side.White ? -1 : 1) && Board[s] == Pieces.Make(Pieces.Pawn, by)) return true;
            }
            foreach (int d in KnightD) { int s = sq + d; if (OnBoardStep(sq, s, 2) && Board[s] == Pieces.Make(Pieces.Knight, by)) return true; }
            foreach (int d in KingD) { int s = sq + d; if (OnBoardStep(sq, s, 1) && Board[s] == Pieces.Make(Pieces.King, by)) return true; }
            if (Slides(sq, BishopD, by, Pieces.Bishop)) return true;
            return Slides(sq, RookD, by, Pieces.Rook);
        }
        bool Slides(int sq, int[] dirs, Side by, int kind)
        {
            foreach (int d in dirs)
            {
                int s = sq;
                while (true)
                {
                    int n = s + d;
                    if (!OnBoardStep(s, n, 1)) break;
                    s = n;
                    int pc = Board[s];
                    if (pc == 0) continue;
                    if (Pieces.SideOf(pc) == by && (Pieces.Kind(pc) == kind || Pieces.Kind(pc) == Pieces.Queen)) return true;
                    break;
                }
            }
            return false;
        }

        public int KingSquare(Side side) { int k = Pieces.Make(Pieces.King, side); for (int i = 0; i < 64; i++) if (Board[i] == k) return i; return -1; }
        public bool InCheck() => IsAttacked(KingSquare(ToMove), Opp(ToMove));
        static Side Opp(Side s) => s == Side.White ? Side.Black : Side.White;

        void Pseudo(List<Move> list)
        {
            Side us = ToMove, them = Opp(us);
            int fwd = us == Side.White ? 8 : -8, startRank = us == Side.White ? 1 : 6, lastRank = us == Side.White ? 7 : 0;
            for (int sq = 0; sq < 64; sq++)
            {
                int pc = Board[sq];
                if (pc == 0 || Pieces.SideOf(pc) != us) continue;
                int kind = Pieces.Kind(pc);
                if (kind == Pieces.Pawn)
                {
                    int one = sq + fwd;
                    if (one >= 0 && one < 64 && Board[one] == 0)
                    {
                        AddPawn(list, sq, one, MoveFlags.None, lastRank);
                        int two = one + fwd;
                        if (Square.Rank(sq) == startRank && Board[two] == 0) list.Add(new Move(sq, two, MoveFlags.DoublePush));
                    }
                    foreach (int df in new[] { -1, 1 })
                    {
                        int to = one + df;
                        if (!OnBoardStep(one, to, 1) || one < 0 || one >= 64) continue;
                        if (Board[to] != 0 && Pieces.SideOf(Board[to]) == them) AddPawn(list, sq, to, MoveFlags.Capture, lastRank);
                        else if (to == EnPassant) list.Add(new Move(sq, to, MoveFlags.Capture | MoveFlags.EnPassant));
                    }
                }
                else if (kind == Pieces.Knight || kind == Pieces.King)
                {
                    var ds = kind == Pieces.Knight ? KnightD : KingD;
                    foreach (int d in ds)
                    {
                        int to = sq + d;
                        if (!OnBoardStep(sq, to, kind == Pieces.Knight ? 2 : 1)) continue;
                        if (Board[to] == 0) list.Add(new Move(sq, to, MoveFlags.None));
                        else if (Pieces.SideOf(Board[to]) == them) list.Add(new Move(sq, to, MoveFlags.Capture));
                    }
                }
                else
                {
                    var dirs = kind == Pieces.Bishop ? BishopD : kind == Pieces.Rook ? RookD : KingD;
                    foreach (int d in dirs)
                    {
                        int s = sq;
                        while (true)
                        {
                            int to = s + d;
                            if (!OnBoardStep(s, to, 1)) break;
                            s = to;
                            if (Board[to] == 0) { list.Add(new Move(sq, to, MoveFlags.None)); continue; }
                            if (Pieces.SideOf(Board[to]) == them) list.Add(new Move(sq, to, MoveFlags.Capture));
                            break;
                        }
                    }
                }
            }
            // Castling: king and rook unmoved (rights), squares between empty, king not in or through check.
            int home = us == Side.White ? 4 : 60;
            if (Board[home] == Pieces.Make(Pieces.King, us) && !IsAttacked(home, them))
            {
                int kRight = us == Side.White ? 1 : 4, qRight = us == Side.White ? 2 : 8;
                if ((Castling & kRight) != 0 && Board[home + 1] == 0 && Board[home + 2] == 0 && !IsAttacked(home + 1, them) && !IsAttacked(home + 2, them))
                    list.Add(new Move(home, home + 2, MoveFlags.Castle));
                if ((Castling & qRight) != 0 && Board[home - 1] == 0 && Board[home - 2] == 0 && Board[home - 3] == 0 && !IsAttacked(home - 1, them) && !IsAttacked(home - 2, them))
                    list.Add(new Move(home, home - 2, MoveFlags.Castle));
            }
        }
        static void AddPawn(List<Move> list, int from, int to, MoveFlags f, int lastRank)
        {
            if (Square.Rank(to) == lastRank)
                foreach (int pr in new[] { Pieces.Queen, Pieces.Rook, Pieces.Bishop, Pieces.Knight }) list.Add(new Move(from, to, f, pr));
            else list.Add(new Move(from, to, f));
        }

        public List<Move> LegalMoves()
        {
            var pseudo = new List<Move>(48);
            Pseudo(pseudo);
            var legal = new List<Move>(pseudo.Count);
            Side us = ToMove;
            foreach (var m in pseudo)
            {
                var c = Clone();
                c.Apply(m);
                if (!c.IsAttacked(c.KingSquare(us), c.ToMove)) legal.Add(m);
            }
            return legal;
        }

        // Plays a move without checking legality. Use Game.Play for checked moves.
        public void Apply(Move m)
        {
            int pc = Board[m.From];
            Side us = ToMove;
            bool pawn = Pieces.Kind(pc) == Pieces.Pawn;
            if (m.Is(MoveFlags.EnPassant)) Board[m.To + (us == Side.White ? -8 : 8)] = 0;
            Board[m.To] = m.Promotion != 0 ? Pieces.Make(m.Promotion, us) : pc;
            Board[m.From] = 0;
            if (m.Is(MoveFlags.Castle))
            {
                if (m.To > m.From) { Board[m.From + 1] = Board[m.From + 3]; Board[m.From + 3] = 0; }
                else { Board[m.From - 1] = Board[m.From - 4]; Board[m.From - 4] = 0; }
            }
            // Any move from or to a corner or king square loses the matching rights.
            foreach (int s in new[] { m.From, m.To })
            {
                if (s == 4) Castling &= ~3; else if (s == 60) Castling &= ~12;
                else if (s == 7) Castling &= ~1; else if (s == 0) Castling &= ~2;
                else if (s == 63) Castling &= ~4; else if (s == 56) Castling &= ~8;
            }
            EnPassant = m.Is(MoveFlags.DoublePush) ? m.From + (us == Side.White ? 8 : -8) : -1;
            HalfMove = pawn || m.Is(MoveFlags.Capture) ? 0 : HalfMove + 1;
            if (us == Side.Black) FullMove++;
            ToMove = Opp(us);
        }

        // K v K, K + minor v K, and bishops all on one square colour.
        public bool InsufficientMaterial()
        {
            var others = new List<(int kind, int sq)>();
            for (int sq = 0; sq < 64; sq++)
            {
                int k = Pieces.Kind(Board[sq]);
                if (k == 0 || k == Pieces.King) continue;
                if (k == Pieces.Pawn || k == Pieces.Rook || k == Pieces.Queen) return false;
                others.Add((k, sq));
            }
            if (others.Count <= 1) return true;
            int shade0 = (Square.Rank(others[0].sq) + Square.File(others[0].sq)) & 1;
            foreach (var o in others) if (o.kind != Pieces.Bishop || ((Square.Rank(o.sq) + Square.File(o.sq)) & 1) != shade0) return false;
            return true;
        }

        public string San(Move m, List<Move> legal = null)
        {
            legal = legal ?? LegalMoves();
            int pc = Board[m.From], kind = Pieces.Kind(pc);
            var sb = new StringBuilder();
            if (m.Is(MoveFlags.Castle)) sb.Append(m.To > m.From ? "O-O" : "O-O-O");
            else if (kind == Pieces.Pawn)
            {
                if (m.Is(MoveFlags.Capture)) sb.Append("abcdefgh"[Square.File(m.From)]).Append('x');
                sb.Append(Square.Name(m.To));
                if (m.Promotion != 0) sb.Append('=').Append(Pieces.Letters[m.Promotion]);
            }
            else
            {
                sb.Append(Pieces.Letters[kind]);
                bool rivals = false, sameFile = false, sameRank = false;
                foreach (var o in legal)
                {
                    if (o.To != m.To || o.From == m.From || Board[o.From] != pc) continue;
                    rivals = true;
                    if (Square.File(o.From) == Square.File(m.From)) sameFile = true;
                    if (Square.Rank(o.From) == Square.Rank(m.From)) sameRank = true;
                }
                if (rivals)
                {
                    if (!sameFile) sb.Append("abcdefgh"[Square.File(m.From)]);
                    else if (!sameRank) sb.Append((char)('1' + Square.Rank(m.From)));
                    else sb.Append(Square.Name(m.From));
                }
                if (m.Is(MoveFlags.Capture)) sb.Append('x');
                sb.Append(Square.Name(m.To));
            }
            var after = Clone();
            after.Apply(m);
            if (after.InCheck()) sb.Append(after.LegalMoves().Count > 0 ? '+' : '#');
            return sb.ToString();
        }

        // Reads UCI ("e2e4", "e7e8q") or SAN ("Nf3", "exd5", "e8=Q+", "O-O", "0-0"). Returns null if not legal.
        public Move? ParseMove(string text, List<Move> legal = null)
        {
            legal = legal ?? LegalMoves();
            var raw = (text ?? "").Trim();
            var low = raw.ToLowerInvariant();
            if (low.Length >= 4 && low.Length <= 5)
            {
                int from = Square.Parse(low.Substring(0, 2)), to = Square.Parse(low.Substring(2, 2));
                int promo = low.Length == 5 ? "pnbrqk".IndexOf(low[4]) + 1 : 0;
                if (from >= 0 && to >= 0) foreach (var m in legal) if (m.From == from && m.To == to && m.Promotion == promo) return m;
            }
            var s = raw.TrimEnd('+', '#', '!', '?');
            if (s == "O-O" || s == "0-0") { foreach (var m in legal) if (m.Is(MoveFlags.Castle) && m.To > m.From) return m; return null; }
            if (s == "O-O-O" || s == "0-0-0") { foreach (var m in legal) if (m.Is(MoveFlags.Castle) && m.To < m.From) return m; return null; }
            foreach (var m in legal) if (San(m, legal).TrimEnd('+', '#') == s) return m;
            // Lenient forms: missing "=", extra disambiguation.
            s = s.Replace("=", "").Replace("x", "").Replace("-", "");
            foreach (var m in legal)
            {
                var san = San(m, legal).TrimEnd('+', '#').Replace("=", "").Replace("x", "");
                if (san == s) return m;
                int pc = Board[m.From];
                var full = (Pieces.Kind(pc) == Pieces.Pawn ? "" : Pieces.Letters[Pieces.Kind(pc)].ToString()) + Square.Name(m.From) + Square.Name(m.To) + (m.Promotion != 0 ? Pieces.Letters[m.Promotion].ToString() : "");
                if (full == s) return m;
            }
            return null;
        }

        public static long Perft(Position p, int depth)
        {
            if (depth == 0) return 1;
            var moves = p.LegalMoves();
            if (depth == 1) return moves.Count;
            long n = 0;
            foreach (var m in moves) { var c = p.Clone(); c.Apply(m); n += Perft(c, depth - 1); }
            return n;
        }
    }

    public sealed class Outcome
    {
        public readonly string Result, Reason;   // "1-0" | "0-1" | "1/2-1/2"; checkmate, stalemate, insufficient, fivefold, seventyfive, ...
        public Outcome(string result, string reason) { Result = result; Reason = reason; }
    }

    // A game in progress: history, SAN, outcome and draw claims, matching the server's referee.
    public sealed class Game
    {
        public Position Pos { get; private set; }
        public readonly string StartFen;
        public readonly List<Move> Moves = new List<Move>();
        public readonly List<string> Sans = new List<string>();
        public List<Move> Legal { get; private set; }
        public Outcome Outcome { get; private set; }
        readonly List<string> keys = new List<string>();
        readonly List<Position> history = new List<Position>();
        Outcome ended;

        public Game(string fen = null)
        {
            Pos = Position.FromFen(fen ?? Position.StartFen);
            StartFen = Pos.Fen();
            keys.Add(Pos.RepetitionKey());
            Refresh();
        }

        void Refresh()
        {
            Legal = Pos.LegalMoves();
            Outcome = ended ?? BoardOutcome();
        }
        public int Repetitions() { var last = keys[keys.Count - 1]; int n = 0; foreach (var k in keys) if (k == last) n++; return n; }
        Outcome BoardOutcome()
        {
            if (Legal.Count == 0) return Pos.InCheck() ? new Outcome(Pos.ToMove == Side.White ? "0-1" : "1-0", "checkmate") : new Outcome("1/2-1/2", "stalemate");
            if (Pos.InsufficientMaterial()) return new Outcome("1/2-1/2", "insufficient");
            if (Repetitions() >= 5) return new Outcome("1/2-1/2", "fivefold");
            if (Pos.HalfMove >= 150) return new Outcome("1/2-1/2", "seventyfive");
            return null;
        }
        public string Claimable() => Outcome != null ? null : Repetitions() >= 3 ? "threefold" : Pos.HalfMove >= 100 ? "fifty" : null;

        public string Play(Move m)
        {
            if (Outcome != null || !Legal.Contains(m)) return null;
            var match = Legal[Legal.IndexOf(m)];   // carry the generated flags
            var san = Pos.San(match, Legal);
            history.Add(Pos.Clone());
            Pos.Apply(match);
            Moves.Add(match);
            Sans.Add(san);
            keys.Add(Pos.RepetitionKey());
            Refresh();
            return san;
        }
        public string Play(string text) { var m = Pos.ParseMove(text, Legal); return m.HasValue ? Play(m.Value) : null; }
        public bool Undo()
        {
            if (Moves.Count == 0 || ended != null) return false;
            Pos = history[history.Count - 1];
            history.RemoveAt(history.Count - 1);
            Moves.RemoveAt(Moves.Count - 1); Sans.RemoveAt(Sans.Count - 1); keys.RemoveAt(keys.Count - 1);
            Refresh();
            return true;
        }
        public bool Finish(string result, string reason) { if (Outcome != null) return false; ended = new Outcome(result, reason); Outcome = ended; return true; }
        public List<string> UciMoves() { var l = new List<string>(); foreach (var m in Moves) l.Add(m.Uci); return l; }
    }
}

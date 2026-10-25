// Starter board for the Unity clients: builds an 8x8 board and placeholder pieces from primitives,
// lets the player click a piece then a square, and keeps the scene in step with Chacklate.Core.Game.
// The art pass replaces the primitives with the real board and piece meshes; the rules stay in the package.
using System.Collections.Generic;
using Chacklate.Core;
using UnityEngine;

namespace Chacklate.Client
{
    public class BoardView : MonoBehaviour
    {
        public Color lightSquare = new Color(0.86f, 0.72f, 0.55f);
        public Color darkSquare = new Color(0.42f, 0.25f, 0.17f);
        public Color whitePieces = new Color(0.94f, 0.89f, 0.80f);
        public Color blackPieces = new Color(0.23f, 0.13f, 0.09f);
        public Color highlight = new Color(0.89f, 0.70f, 0.35f);

        public Game Game { get; private set; } = new Game();
        // Set by OnlineMatch: which side the local player controls (null = both, for pass and play).
        public Side? LocalSide;
        public System.Action<string> MovePlayed;   // UCI of a move the local player made

        readonly GameObject[] squares = new GameObject[64];
        readonly Dictionary<int, GameObject> pieces = new Dictionary<int, GameObject>();
        int selected = -1;

        void Start()
        {
            for (int sq = 0; sq < 64; sq++)
            {
                var s = GameObject.CreatePrimitive(PrimitiveType.Cube);
                s.name = Square.Name(sq);
                s.transform.SetParent(transform, false);
                s.transform.localPosition = ToWorld(sq) + new Vector3(0f, -0.05f, 0f);
                s.transform.localScale = new Vector3(1f, 0.1f, 1f);
                squares[sq] = s;
            }
            Redraw();
        }

        static Vector3 ToWorld(int sq) => new Vector3(Square.File(sq) - 3.5f, 0f, Square.Rank(sq) - 3.5f);

        public void SetGame(Game g) { Game = g; selected = -1; Redraw(); }

        public void Redraw()
        {
            foreach (var p in pieces.Values) Destroy(p);
            pieces.Clear();
            for (int sq = 0; sq < 64; sq++)
            {
                bool light = ((Square.File(sq) + Square.Rank(sq)) & 1) == 1;
                var target = sq == selected ? highlight : light ? lightSquare : darkSquare;
                squares[sq].GetComponent<Renderer>().material.color = target;
                int pc = Game.Pos.Board[sq];
                if (pc != 0) pieces[sq] = MakePiece(pc, sq);
            }
        }

        GameObject MakePiece(int pc, int sq)
        {
            int kind = Pieces.Kind(pc);
            var go = GameObject.CreatePrimitive(kind == Pieces.Pawn ? PrimitiveType.Sphere : PrimitiveType.Cylinder);
            float h = new[] { 0f, 0.35f, 0.5f, 0.55f, 0.5f, 0.65f, 0.75f }[kind];
            go.name = (Pieces.SideOf(pc) == Side.White ? "white " : "black ") + " PNBRQK"[kind];
            go.transform.SetParent(transform, false);
            go.transform.localPosition = ToWorld(sq) + new Vector3(0f, h, 0f);
            go.transform.localScale = new Vector3(0.55f, h, 0.55f);
            go.GetComponent<Renderer>().material.color = Pieces.SideOf(pc) == Side.White ? whitePieces : blackPieces;
            Destroy(go.GetComponent<Collider>());
            return go;
        }

        void Update()
        {
            if (!Input.GetMouseButtonDown(0) || Game.Outcome != null || Camera.main == null) return;
            if (LocalSide.HasValue && Game.Pos.ToMove != LocalSide.Value) return;
            if (!Physics.Raycast(Camera.main.ScreenPointToRay(Input.mousePosition), out var hit)) return;
            int sq = System.Array.IndexOf(squares, hit.collider.gameObject);
            if (sq < 0) return;
            int pc = Game.Pos.Board[sq];
            if (pc != 0 && Pieces.SideOf(pc) == Game.Pos.ToMove) { selected = sq; Redraw(); return; }
            if (selected < 0) return;
            // Promotions default to a queen here; the full client asks.
            Move? move = null;
            foreach (var m in Game.Legal) if (m.From == selected && m.To == sq && (m.Promotion == 0 || m.Promotion == Pieces.Queen)) { move = m; break; }
            selected = -1;
            if (move.HasValue)
            {
                if (MovePlayed != null) MovePlayed(move.Value.Uci);
                else Game.Play(move.Value);
            }
            Redraw();
        }
    }
}

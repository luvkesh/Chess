// Connects a BoardView to the game server: quick match, moves both ways, results.
// Network messages are queued by the transport and handled here on the main thread (Poll in Update).
using System;
using Chacklate.Core;
using UnityEngine;

namespace Chacklate.Client
{
    public class OnlineMatch : MonoBehaviour
    {
        public BoardView board;
        public string serverUrl = "ws://localhost:8080/ws";
        public string timeControl = "5+3";
        public string Status { get; private set; } = "Not connected";

        GameClient client;
        WebSocketTransport transport;

        async void Start()
        {
            try
            {
                transport = await WebSocketTransport.Connect(new Uri(serverUrl));
                client = new GameClient(transport);
                client.Welcomed += () => { Status = "Signed in as " + client.Name; PlayerPrefs.SetString("chacklate.token", client.Token); client.Seek(timeControl); };
                client.Seeking += tc => Status = "Finding an opponent (" + tc + ")";
                client.Started += m => { Status = "Playing " + m.OpponentName + " as " + m.Me; board.LocalSide = m.Me; board.SetGame(client.Game); };
                client.OpponentMoved += (m, san) => board.Redraw();
                client.Synced += () => board.SetGame(client.Game);
                client.Ended += (result, reason, delta) => { Status = result + " by " + reason + (delta.HasValue ? " (" + (delta.Value >= 0 ? "+" : "") + delta.Value + ")" : ""); board.Redraw(); };
                client.Error += msg => Status = msg;
                board.MovePlayed = uci => { if (client.PlayMove(uci) != null) board.Redraw(); };
                client.Hello(PlayerPrefs.GetString("chacklate.token", ""));
            }
            catch (Exception e) { Status = "Could not reach the server: " + e.Message; }
        }

        void Update() { if (client != null) client.Poll(); }

        void OnGUI() { GUI.Label(new Rect(12, 12, 600, 24), Status); }

        void OnDestroy() { if (transport != null) transport.Dispose(); }
    }
}

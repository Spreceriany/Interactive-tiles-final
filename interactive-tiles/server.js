const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

const wss = new WebSocket.Server({ port: 4050 });

function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.post("/webhook", (req, res) => {
  const commit = req.body.head_commit?.message;
  const repo = req.body.repository?.name;
  console.log(`🚀 Push to ${repo}: ${commit}`);

  // Notify frontend
  broadcast("csv_updated");

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Webhook server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:4050`);
});

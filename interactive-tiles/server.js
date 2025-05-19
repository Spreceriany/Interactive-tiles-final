const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const cors = require("cors");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket to the same server
const wss = new WebSocket.Server({ server });

function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// GitHub webhook endpoint
app.post("/webhook", (req, res) => {
  const commit = req.body.head_commit?.message;
  const repo = req.body.repository?.name;
  console.log(`🚀 Push to ${repo}: ${commit}`);

  // Notify all connected WebSocket clients
  broadcast("csv_updated");

  res.sendStatus(200);
});

// Start both HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`✅ Webhook server running on http://localhost:${PORT}`);
  console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
});

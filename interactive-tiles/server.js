const express = require("express");
const cors = require("cors");
const path = require("path");
const chokidar = require("chokidar");
const app = express();
const PORT = 3000;
const fs = require("fs");

// Enable CORS
app.use(cors());

const csvPath = path.join(__dirname, "data.csv");

// Serve the raw CSV file
app.get("/data", (req, res) => {
  res.sendFile(csvPath);
});

// Watch for changes and log to console
chokidar.watch(csvPath).on("change", () => {
  console.log(`CSV file updated: ${new Date().toLocaleTimeString()}`);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

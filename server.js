const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const REGISTRY_PATH = path.join(
  __dirname,
  "backend",
  "data",
  "componentRegistry.json"
);

app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

app.get("/api/registry", (req, res) => {
  try {
    const data = fs.readFileSync(REGISTRY_PATH, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/registry", (req, res) => {
  try {
    fs.writeFileSync(
      REGISTRY_PATH,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
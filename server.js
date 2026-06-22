const cds = require("@sap/cds");
const USERS = {};

cds.on("bootstrap", (app) => {
  app.use(require("express").json());
  app.post("/signup", (req, res) => {
    const { username, password } = req.body;
    if (USERS[username]) return res.status(409).json({ error: "Username taken" });
    USERS[username] = password;
    res.json({ success: true, username });
  });
  app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!USERS[username] || USERS[username] !== password)
      return res.status(401).json({ error: "Invalid credentials" });
    res.json({ success: true, username });
  });
});

module.exports = cds.server;
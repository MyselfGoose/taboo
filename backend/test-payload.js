const express = require("express");
const app = express();
app.get("/lobby", (req, res) => res.json({ error: "Lobby not found.", code: "LOBBY_NOT_FOUND" }));
app.get("/player", (req, res) => res.json({ error: "Player not found in lobby.", code: "PLAYER_NOT_FOUND" }));
app.get("/notfound", (req, res) => res.json({ error: "Not found", path: "/api/sessions/restore" }));
const server = app.listen(0, () => {
    const port = server.address().port;
    const http = require("http");
    const test = (path) => new Promise(r => {
        http.get(`http://localhost:${port}${path}`, (res) => {
            console.log(path, "->", res.headers["content-length"]);
            r();
        });
    });
    (async () => {
        await test("/lobby");
        await test("/player");
        await test("/notfound");
        process.exit(0);
    })();
});

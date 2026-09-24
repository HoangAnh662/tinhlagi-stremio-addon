const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/playlist.m3u") {
    try {
      const file = path.join(__dirname, "coban66.m3u");
      const m3u = fs.readFileSync(file, "utf8");

      res.writeHead(200, {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      });

      res.end(m3u);
    } catch (err) {
      console.error(err);

      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Khong doc duoc coban66.m3u");
    }

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`M3U server running on port ${PORT}`);
});

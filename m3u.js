const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 3000);
const ADDON = "https://tinhlagi-stremio-addon.onrender.com";

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function createM3U() {
  const catalog = await getJSON(
    `${ADDON}/catalog/tv/tinhlagi.json`
  );

  let m3u = "#EXTM3U\n";

  for (const item of catalog.metas || []) {
    try {
      const streamData = await getJSON(
        `${ADDON}/stream/tv/${encodeURIComponent(item.id)}.json`
      );

      const stream = (streamData.streams || []).find((s) => s.url);

      if (!stream) continue;

      const name = (item.name || "TV").replace(/\n/g, " ").trim();
      const logo = item.poster || "";

      m3u += `#EXTINF:-1 tvg-logo="${logo}",${name}\n`;
      m3u += `${stream.url}\n`;
    } catch (e) {
      console.log("Skip:", item.name);
    }
  }

  return m3u;
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || "").split("?")[0];

  if (
    path === "/" ||
    path === "/playlist.m3u" ||
    path === "/playlist.m3u/"
  ) {
    try {
      const m3u = await createM3U();

      res.writeHead(200, {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      });

      return res.end(m3u);
    } catch (err) {
      console.error("M3U ERROR:", err);

      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      return res.end("Khong tao duoc playlist M3U");
    }
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});
server.listen(PORT, () => {
  console.log(`M3U server running on port ${PORT}`);
});

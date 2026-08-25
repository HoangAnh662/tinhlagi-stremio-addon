const https = require("https");

const ADDON = "https://tinhlagi-stremio-addon.onrender.com";

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";

      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function createM3U() {
  const catalogUrl =
    `${ADDON}/catalog/tv/tinhlagi.json`;

  const catalog = await getJSON(catalogUrl);

  let m3u = "#EXTM3U\n";

  for (const item of catalog.metas || []) {
    try {
      const streamData = await getJSON(
        `${ADDON}/stream/tv/${encodeURIComponent(item.id)}.json`
      );

      const stream = (streamData.streams || []).find(s => s.url);

      if (!stream) continue;

      const name = item.name || "TV";
      const logo = item.poster || "";

      m3u += `#EXTINF:-1 tvg-logo="${logo}",${name}\n`;
      m3u += `${stream.url}\n`;

    } catch (e) {
      console.log("Skip:", item.name);
    }
  }

  return m3u;
}

module.exports = { createM3U };

const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 3000);
const ADDON = "https://tinhlagi-stremio-addon.onrender.com";
const SELF = "https://tinhlagi-m3u-tv.onrender.com";

function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Too many redirects"));

    const lib = url.startsWith("https:") ? https : http;

    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; SmartTV) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "*/*"
        }
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const next = new URL(res.headers.location, url).href;
          res.resume();
          return resolve(request(next, redirects + 1));
        }

        resolve({ res, finalUrl: url });
      }
    );

    req.on("error", reject);
  });
}

async function getText(url) {
  const { res } = await request(url);

  return new Promise((resolve, reject) => {
    let data = "";

    res.setEncoding("utf8");
    res.on("data", (c) => (data += c));
    res.on("end", () => resolve(data));
    res.on("error", reject);
  });
}

async function getJSON(url) {
  return JSON.parse(await getText(url));
}

async function getStream(itemId) {
  const data = await getJSON(
    `${ADDON}/stream/tv/${encodeURIComponent(itemId)}.json`
  );

  return (data.streams || []).find((s) => s.url);
}

async function createM3U() {
  const catalog = await getJSON(
    `${ADDON}/catalog/tv/tinhlagi.json`
  );

  let out = "#EXTM3U\n";

  for (const item of catalog.metas || []) {
    try {
      const stream = await getStream(item.id);
      if (!stream) continue;

      const name = String(item.name || "TV")
        .replace(/[\r\n]/g, " ")
        .trim();

      const logo = item.poster || "";

      out += `#EXTINF:-1 tvg-logo="${logo}",${name}\n`;
      out += `${SELF}/play/${encodeURIComponent(item.id)}\n`;
    } catch (e) {
      console.log("Skip:", item.name);
    }
  }

  return out;
}

function rewriteHLS(text, baseUrl, itemId) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line || line.startsWith("#")) {
        // URI="..." trong EXT-X-KEY / EXT-X-MAP
        return line.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = new URL(uri, baseUrl).href;
          return `URI="${SELF}/segment/${encodeURIComponent(
            itemId
          )}?u=${encodeURIComponent(absolute)}"`;
        });
      }

      const absolute = new URL(line.trim(), baseUrl).href;

      return `${SELF}/segment/${encodeURIComponent(
        itemId
      )}?u=${encodeURIComponent(absolute)}`;
    })
    .join("\n");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, SELF);

    // Playlist chính
    if (url.pathname === "/" || url.pathname === "/playlist.m3u") {
      const m3u = await createM3U();

      res.writeHead(200, {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      });

      return res.end(m3u);
    }

    // Mở một kênh
    if (url.pathname.startsWith("/play/")) {
      const itemId = decodeURIComponent(
        url.pathname.substring("/play/".length)
      );

      const stream = await getStream(itemId);

      if (!stream || !stream.url) {
        res.writeHead(404);
        return res.end("Stream not found");
      }

      const upstream = await request(stream.url);
      const contentType =
        upstream.res.headers["content-type"] || "";

      // HLS playlist
      if (
        contentType.includes("mpegurl") ||
        stream.url.includes(".m3u8")
      ) {
        let body = "";

        upstream.res.setEncoding("utf8");
        upstream.res.on("data", (c) => (body += c));

        upstream.res.on("end", () => {
          const rewritten = rewriteHLS(
            body,
            upstream.finalUrl,
            itemId
          );

          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
          });

          res.end(rewritten);
        });

        return;
      }

      // Không phải HLS: chuyển dữ liệu trực tiếp
      res.writeHead(upstream.res.statusCode || 200, {
        "Content-Type":
          upstream.res.headers["content-type"] ||
          "application/octet-stream",
        "Access-Control-Allow-Origin": "*"
      });

      return upstream.res.pipe(res);
    }

    // Segment / playlist con của HLS
    if (url.pathname.startsWith("/segment/")) {
      const itemId = decodeURIComponent(
        url.pathname.substring("/segment/".length)
      );

      const target = url.searchParams.get("u");
      if (!target) {
        res.writeHead(400);
        return res.end("Missing URL");
      }

      // Xác nhận item này thực sự tồn tại trong addon
      const stream = await getStream(itemId);
      if (!stream) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      const upstream = await request(target);
      const contentType =
        upstream.res.headers["content-type"] || "";

      if (
        contentType.includes("mpegurl") ||
        target.includes(".m3u8")
      ) {
        let body = "";

        upstream.res.setEncoding("utf8");
        upstream.res.on("data", (c) => (body += c));

        upstream.res.on("end", () => {
          const rewritten = rewriteHLS(
            body,
            upstream.finalUrl,
            itemId
          );

          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
          });

          res.end(rewritten);
        });

        return;
      }

      res.writeHead(upstream.res.statusCode || 200, {
        "Content-Type":
          upstream.res.headers["content-type"] ||
          "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      });

      return upstream.res.pipe(res);
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error(err);

    res.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Proxy error");
  }
});

server.listen(PORT, () => {
  console.log(`M3U proxy running on port ${PORT}`);
});

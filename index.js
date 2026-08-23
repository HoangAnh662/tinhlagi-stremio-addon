const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const PORT = Number(process.env.PORT || 7000);
const SOURCE = "https://tinhlagi.pro/tivi/";

const manifest = {
  id: "org.tinhlagi.live",
  version: "1.0.0",
  name: "HoàngAnh",
  description: "Đọc danh sách kênh/phim công khai từ tinhlagi.pro/tivi và đưa vào Stremio.",
  resources: ["catalog", "meta", "stream"],
  types: ["tv"],
  catalogs: [
    {
      type: "tv",
      id: "tinhlagi",
      name: "HoàngAnh",
      extra: [{ name: "search", isRequired: false }]
    }
  ],
  idPrefixes: ["tinhlagi:"],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

const builder = new addonBuilder(manifest);

let cache = { at: 0, items: [] };
const CACHE_MS = 3 * 60 * 1000;

function unescapeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(s) {
  return unescapeHtml(String(s || "").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function encodeId(item) {
  const payload = JSON.stringify({ n: item.name, u: item.url });
  return "tinhlagi:" + Buffer.from(payload, "utf8").toString("base64url");
}

function decodeId(id) {
  if (!id || !id.startsWith("tinhlagi:")) return null;
  try {
    const raw = Buffer.from(id.slice("tinhlagi:".length), "base64url").toString("utf8");
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.n !== "string" || typeof obj.u !== "string") return null;
    return { name: obj.n, url: obj.u };
  } catch {
    return null;
  }
}

async function loadItems() {
  if (Date.now() - cache.at < CACHE_MS && cache.items.length) return cache.items;

  const res = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Android) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  });

  if (!res.ok) throw new Error(`Tinhlagi HTTP ${res.status}`);

  const html = await res.text();
  const items = [];
  const seen = new Set();

  // Lấy mọi anchor có cả ?name=... và &url=...
    const re = new RegExp('<a\\b[^>]*href=["\\x27]([^"\\x27]+)["\\x27][^>]*>([\\s\\S]*?)<\\/a>', 'gi');
  let m;

  while ((m = re.exec(html)) !== null) {
    let href = unescapeHtml(m[1]);
    const label = stripTags(m[2]);
    let poster = null;

const n = label.toUpperCase().trim();

// Tên dài thì tách thành nhiều dòng
const words = n.split(/\s+/);
let lines = [];
let line = "";

for (const word of words) {
  const test = line ? `${line} ${word}` : word;

  if (test.length > 12 && line) {
    lines.push(line);
    line = word;
  } else {
    line = test;
  }
}

if (line) lines.push(line);

// Tối đa 3 dòng
const logoText = lines.slice(0, 3).join("\n");

poster =
  `https://placehold.co/600x600/202020/FFFFFF.png?` +
  `text=${encodeURIComponent(logoText)}`;


    try {
      const pageUrl = new URL(href, SOURCE);
      const name = pageUrl.searchParams.get("name") || label;
      const streamUrl = pageUrl.searchParams.get("url");
      if (!name || !streamUrl) continue;
      if (!/^https?:\/\//i.test(streamUrl)) continue;

      const key = `${name}|${streamUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);

    items.push({
  name: name.trim(),
  url: streamUrl,
  poster
});
    } catch {}
  }

  if (!items.length) {
    throw new Error("Không đọc được kênh từ Tinhlagi. Có thể cấu trúc trang đã thay đổi.");
  }

  cache = { at: Date.now(), items };
  return items;
}

function toMeta(item) {
  const poster = item.poster || 
    `https://placehold.co/512x512/202020/FFFFFF.png?text=${encodeURIComponent(item.name)}`;

  return {
    id: encodeId(item),
    type: "tv",
    name: item.name,
    description: "Nguồn: tinhlagi.pro",
    poster: poster,
    background: poster,
    posterShape: "square"
  };
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== "tv" || id !== "tinhlagi") return { metas: [] };

  try {
    let items = await loadItems();
    const q = (extra && extra.search ? String(extra.search) : "").trim().toLowerCase();
    if (q) items = items.filter(x => x.name.toLowerCase().includes(q));

    return { metas: items.map(toMeta) };
  } catch (err) {
    console.error("catalog:", err);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "tv") return { meta: null };
  const item = decodeId(id);
  if (!item) return { meta: null };
  return { meta: toMeta(item) };
});

builder.defineStreamHandler(async ({ type, id }) => {
  if (type !== "tv") return { streams: [] };
  const item = decodeId(id);
  if (!item) return { streams: [] };

  return {
    streams: [
      {
        name: "Tinhlagi",
        title: item.name,
        url: item.url,
        behaviorHints: {
          notWebReady: false,
          proxyHeaders: {
            request: {
              "User-Agent": "Mozilla/5.0 (Android) AppleWebKit/537.36 Chrome/126 Safari/537.36",
              "Referer": "https://tinhlagi.pro/"
            }
          }
        }
      }
    ]
  };
});

serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Tinhlagi Stremio addon: http://127.0.0.1:${PORT}/manifest.json`);

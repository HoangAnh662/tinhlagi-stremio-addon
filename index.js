const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 7000);

const manifest = {
  id: "org.tinhlagi.live",
  version: "1.0.0",
  name: "HoàngAnh",
  description: "Danh sách kênh TV từ coban66.m3u",
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

function encodeId(item) {
  const payload = JSON.stringify({
    n: item.name,
    u: item.url
  });

  return "tinhlagi:" +
    Buffer.from(payload, "utf8").toString("base64url");
}

function decodeId(id) {
  if (!id || !id.startsWith("tinhlagi:")) {
    return null;
  }

  try {
    const raw = Buffer.from(
      id.slice("tinhlagi:".length),
      "base64url"
    ).toString("utf8");

    const obj = JSON.parse(raw);

    if (
      !obj ||
      typeof obj.n !== "string" ||
      typeof obj.u !== "string"
    ) {
      return null;
    }

    return {
      name: obj.n,
      url: obj.u
    };
  } catch {
    return null;
  }
}

async function loadItems() {
  const m3uPath = path.join(__dirname, "coban66.m3u");

  const content = fs.readFileSync(m3uPath, "utf8");
  const lines = content.split(/\r?\n/);

  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("#EXTINF:")) {
      const name =
        line.substring(line.lastIndexOf(",") + 1).trim();

      const logoMatch =
        line.match(/tvg-logo="([^"]*)"/i);

      current = {
        name,
        poster: logoMatch ? logoMatch[1] : null
      };

      continue;
    }

    if (
      current &&
      line &&
      !line.startsWith("#")
    ) {
      items.push({
        name: current.name,
        url: line,
        poster: current.poster
      });

      current = null;
    }
  }

  if (!items.length) {
    throw new Error(
      "Không đọc được kênh từ coban66.m3u"
    );
  }

  return items;
}

function toMeta(item) {
  const poster =
    item.poster ||
    `https://placehold.co/512x512/202020/FFFFFF.png?text=${encodeURIComponent(item.name)}`;

  return {
    id: encodeId(item),
    type: "tv",
    name: item.name,
    description: "Nguồn: coban66.m3u",
    poster,
    background: poster,
    posterShape: "square"
  };
}

builder.defineCatalogHandler(
  async ({ type, id, extra }) => {
    if (type !== "tv" || id !== "tinhlagi") {
      return { metas: [] };
    }

    try {
      let items = await loadItems();

      const q =
        (extra && extra.search
          ? String(extra.search)
          : "")
          .trim()
          .toLowerCase();

      if (q) {
        items = items.filter(item =>
          item.name.toLowerCase().includes(q)
        );
      }

      return {
        metas: items.map(toMeta)
      };
    } catch (err) {
      console.error("catalog:", err);
      return { metas: [] };
    }
  }
);

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "tv") {
    return { meta: null };
  }

  const item = decodeId(id);

  if (!item) {
    return { meta: null };
  }

  return {
    meta: toMeta(item)
  };
});

builder.defineStreamHandler(async ({ type, id }) => {
  if (type !== "tv") {
    return { streams: [] };
  }

  const item = decodeId(id);

  if (!item) {
    return { streams: [] };
  }

  return {
    streams: [
      {
        name: "HoàngAnh TV",
        title: item.name,
        url: item.url
      }
    ]
  };
});

serveHTTP(
  builder.getInterface(),
  { port: PORT }
);

console.log(
  `Stremio addon: http://127.0.0.1:${PORT}/manifest.json`
);

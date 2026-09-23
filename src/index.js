// Cloudflare Worker: path-prefix router in front of the static assets, plus the
// WebSocket entry point for two-player rooms (one Durable Object per room).
//
// `run_worker_first: true` (wrangler.jsonc) sends every request here before
// asset matching, so we can strip the prefix and still serve from
// the bare *.workers.dev root (or `wrangler dev`) while testing.
//
// The public path segment is independent of the repo / Worker name; change
// PREFIX alone to move the site to a different path.
export { Room } from "./room.js";
import { withRange } from "./range.js";

const PREFIX = "/zongheng";
const CANONICAL = "https://games.csiesheep.com" + PREFIX + "/";
// #108: went live (landing page's noindex removed) 2026-09-22. Prefix-scoped
// sitemap. Game modes are query strings on the one page and carry a
// canonical back to it, so the page and the rules are all there is -- the
// landing page is listed once per language, same convention as the hub's
// own sitemap (games/src/index.js SITEMAP_URLS), since each version names
// the other through <link rel="alternate" hreflang"> and listing both here
// just makes sure a crawler finds the Chinese one without following links.
const LAST_MOD = "2026-09-22";
const SITEMAP_URLS = [
  { loc: CANONICAL, lastmod: LAST_MOD },
  { loc: CANONICAL + "?lang=zh-Hant", lastmod: LAST_MOD },
  { loc: CANONICAL + "rules", lastmod: LAST_MOD },
];
const SITEMAP_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...SITEMAP_URLS.map((u) =>
    ["  <url>", "    <loc>" + u.loc + "</loc>", "    <lastmod>" + u.lastmod + "</lastmod>", "  </url>"].join(String.fromCharCode(10))
  ),
  "</urlset>",
  "",
].join(String.fromCharCode(10));
// ---- The Chinese head, server-rendered ------------------------------------
//
// Both pages carry both languages client-side (landing.js / rules.js switch
// the visible half by CSS), so to a crawler that runs no script -- and to a
// link preview, which never does -- there is only one page, and it is
// English. /?lang=zh-Hant (and /rules?lang=zh-Hant) are that same file, with
// <html lang> and the head rewritten here before it leaves, same pattern as
// toChinese in the hub's own src/index.js. The body needs nothing: the
// landing page's CSS already shows the Chinese half whenever
// <html lang="zh-Hant">, and the rules page is built entirely by rules.js
// after load regardless of language, so there is nothing in the body for a
// crawler to read either way.
const ZH = "zh-Hant";
const OG_IMAGE = CANONICAL + "art/og-zongheng.jpg";
const ZH_HEAD = {
  "/": {
    url: CANONICAL + "?lang=" + ZH,
    title: "縱橫 Zongheng — 戰國兩人卡牌策略遊戲",
    description: "縱橫 Zongheng:戰國時期兩人對戰的卡牌策略遊戲,秦對楚。單人對戰機器人,或與朋友開房間對戰。",
  },
  "/rules": {
    url: CANONICAL + "rules?lang=" + ZH,
    title: "縱橫 Zongheng 規則 — 怎麼玩這個兩人卡牌遊戲",
    description: "縱橫 Zongheng 的完整規則與七十二張牌:戰國時期兩人對戰的卡牌策略遊戲,秦對楚。",
  },
};

function set(attr, value) {
  return { element(e) { e.setAttribute(attr, value); } };
}

function toChinese(res, sub) {
  const type = res.headers.get("content-type") || "";
  if (res.status !== 200 || !type.includes("text/html")) return res;
  const head = ZH_HEAD[sub];
  if (!head) return res;

  const out = new HTMLRewriter()
    .on("html", set("lang", ZH))
    .on("title", { element(e) { e.setInnerContent(head.title); } })
    .on('meta[name="description"]', set("content", head.description))
    .on('link[rel="canonical"]', set("href", head.url))
    .on('meta[property="og:url"]', set("content", head.url))
    .on('meta[property="og:title"]', set("content", head.title))
    .on('meta[property="og:description"]', set("content", head.description))
    .on('meta[property="og:locale"]', set("content", "zh_TW"))
    .on('meta[property="og:locale:alternate"]', set("content", "en_US"))
    .on('meta[name="twitter:title"]', set("content", head.title))
    .on('meta[name="twitter:description"]', set("content", head.description))
    .transform(res);

  // The asset's ETag describes the English bytes. These are not those bytes,
  // so it must not be offered back for a 304.
  const headers = new Headers(out.headers);
  headers.delete("etag");
  return new Response(out.body, { status: out.status, headers });
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

// /zongheng/ws?create=1&name=Alice&lang=en    opens a fresh room
// /zongheng/ws?room=ABCD&name=Bob&token=…     joins (or reconnects to) a room
async function connectRoom(request, env, url) {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected a WebSocket", { status: 426 });
  }
  let code = (url.searchParams.get("room") || "").toUpperCase();
  if (url.searchParams.get("create") === "1") {
    // Pick a code nobody holds. Rooms are named by their code, so ask the
    // object whether it already has state.
    for (let i = 0; i < 20; i++) {
      code = newCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const res = await stub.fetch("https://room/status");
      if (!(await res.json()).exists) break;
    }
    url.searchParams.set("room", code);
  } else if (!/^[A-Z0-9]{4}$/.test(code)) {
    return new Response("Bad room code", { status: 400 });
  }
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  return stub.fetch(new Request(url.toString(), request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === PREFIX) {
      url.pathname = PREFIX + "/";
      return Response.redirect(url.toString(), 301);
    }

    if (!url.pathname.startsWith(PREFIX + "/")) {
      return new Response("Not found", { status: 404 });
    }

    const sub = url.pathname.slice(PREFIX.length);
    if (sub === "/ws") return connectRoom(request, env, url);
    if (sub === "/sitemap.xml") {
      return new Response(SITEMAP_XML, { headers: { "content-type": "application/xml; charset=utf-8" } });
    }

    url.pathname = sub;
    // The asset handler ignores Range; iPhones will not play media without 206
    // (#70). withRange only touches a 200, so it is placed before the Location
    // fix, which only touches redirects: the two never act on the same response.
    let response = await withRange(request, await env.ASSETS.fetch(new Request(url, request)));

    // Only this exact value. ?lang=en and every other query get the page
    // untouched, whose canonical already points at the English URL.
    if (url.searchParams.get("lang") === ZH) response = toChinese(response, sub);

    // The static-asset handler builds Location from the url we just stripped
    // the prefix off, so a same-origin redirect would escape this Worker and
    // 404 on the hub. Put the prefix back on.
    const location = response.headers.get("location");
    if (location) {
      const target = new URL(location, url);
      if (
        target.origin === url.origin &&
        target.pathname !== PREFIX &&
        !target.pathname.startsWith(PREFIX + "/")
      ) {
        target.pathname = PREFIX + target.pathname;
        const headers = new Headers(response.headers);
        headers.set("location", target.toString());
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
    return response;
  },
};

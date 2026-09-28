// #138: a local stand-in for DeepSeek's chat completions, for developing and
// checking the 戰報 without the real key. Not part of the Worker (nothing
// imports it).
//
//   node src/dev/deepseek-stub.mjs [--port N] [--mode M]
//
// Prints `STUB http://127.0.0.1:<port>` once it listens (port 0 = pick one).
// Point the Worker at it with a .dev.vars (not committed):
//   DEEPSEEK_BASE_URL=http://127.0.0.1:<port>
//   DEEPSEEK_API_KEY=stub
//
// POST /chat/completions  answers like DeepSeek: the zh or en half of
//   stub-report.json (the orchestrator's hand-written sample), fitted to the
//   request -- one chapter per year it asks for, cards taken from that year's
//   list. It refuses (400) a body without thinking disabled, json_object output
//   or an Authorization header, so the Worker's request shape is checked too.
// GET  /hits              {total, calls: [{model, lang, at}]}
// POST /reset             hits back to 0
// POST /mode {"mode": M}  M: ok | banned (zh adds 「楚王打出九鼎」, en "Chu played a card")
//                         | banned-pro (only deepseek-v4-pro replies are banned; flash is clean)
//                         | banned-once (the first call per language is banned)
//                         | error500 | badjson | empty
// Any mode may end in "+slow<ms>", e.g. "ok+slow3000", to answer late.
import http from "node:http";
import fs from "node:fs";

const sample = JSON.parse(fs.readFileSync(new URL("./stub-report.json", import.meta.url), "utf8"));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
let mode = arg("--mode", "ok");
let calls = [];
const seen = {};

function fit(lang, user) {
  const years = Number((user.match(/^YEARS: (\d+)/m) || [])[1]) || sample[lang].chapters.length;
  const allowed = {};
  for (const m of user.matchAll(/^year (\d+): (.*)$/gm)) allowed[m[1]] = m[2] ? m[2].split(", ").map((p) => p.split("=")[0]) : [];
  const src = sample[lang];
  const chapters = [];
  for (let i = 0; i < years; i++) {
    const c = JSON.parse(JSON.stringify(src.chapters[i % src.chapters.length]));
    c.turn = i + 1;
    const ok = allowed[i + 1] || [];
    const keep = c.cards.filter((id) => ok.includes(id));
    c.cards = (keep.length ? keep : ok.slice(0, 2)).slice(0, 4);
    chapters.push(c);
  }
  return { title: src.title, intro: src.intro, chapters, ending: src.ending };
}

function banned(side, lang) {
  side.chapters[Math.min(1, side.chapters.length - 1)].paragraphs[0] += lang === "zh" ? "楚王打出九鼎。" : " Chu played a card.";
  return side;
}

const send = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/hits") return send(res, 200, { total: calls.length, calls });
  if (req.method === "POST" && url.pathname === "/reset") { calls = []; for (const k in seen) delete seen[k]; return send(res, 200, { ok: true }); }
  if (req.method === "POST" && url.pathname === "/mode") { mode = JSON.parse(raw || "{}").mode || "ok"; return send(res, 200, { mode }); }
  if (req.method !== "POST" || url.pathname !== "/chat/completions") return send(res, 404, { error: { message: "not found" } });
  let body;
  try { body = JSON.parse(raw); } catch { return send(res, 400, { error: { message: "bad json" } }); }
  if (!/^Bearer \S+/.test(req.headers.authorization || "")) return send(res, 401, { error: { message: "no key" } });
  if (!body.thinking || body.thinking.type !== "disabled") return send(res, 400, { error: { message: "thinking must be disabled" } });
  if (!body.response_format || body.response_format.type !== "json_object") return send(res, 400, { error: { message: "json_object required" } });
  const user = (body.messages || []).find((m) => m.role === "user")?.content || "";
  const lang = (user.match(/^LANG: (zh|en)/m) || [])[1] || "en";
  calls.push({ model: body.model, lang, at: new Date().toISOString() });
  const [base, slow] = mode.split("+slow");
  if (slow) await new Promise((r) => setTimeout(r, Number(slow)));
  if (base === "error500") return send(res, 500, { error: { message: "stub: server error" } });
  let content;
  if (base === "badjson") content = "{ not json";
  else if (base === "empty") content = "";
  else {
    let side = fit(lang, user);
    const first = !seen[lang]; seen[lang] = true;
    if (base === "banned" || (base === "banned-pro" && body.model === "deepseek-v4-pro") || (base === "banned-once" && first)) side = banned(side, lang);
    content = JSON.stringify(side);
  }
  send(res, 200, {
    id: "stub-" + calls.length, object: "chat.completion", model: body.model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: Math.ceil(user.length / 2), completion_tokens: Math.ceil((content || "").length / 2), total_tokens: 0 },
  });
});
server.listen(Number(arg("--port", 0)), "127.0.0.1", () => console.log(`STUB http://127.0.0.1:${server.address().port} mode=${mode}`));

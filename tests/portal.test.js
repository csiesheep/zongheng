// Guard for #149 (orchestrator-owned): the 遊戲路口 (try-our-games.vercel.app) result reporting.
//
// Owner, 2026-09-29: 「check …csiesheep串接用\csiesheep\zongheng, to apply the api」 -- the platform's integration guide:
// a player who arrives with ?gp_token=… gets each game registered (start) and its result reported; without a token the
// game is untouched. Rules from the guide: the token lives in memory or sessionStorage only (never localStorage or a
// cookie), only the spec's fields are sent, a restart is ONE end_and_restart request, failures only console.warn.
// Three states: public/portal.js missing -> todo; present -> every check runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const P = new URL("../public/portal.js", import.meta.url);
const ready = existsSync(P);
const T = (name, fn) => (ready ? test(name, fn) : test.todo(name + " (not implemented yet)"));

function env(search = "", referrer = "") {
  const calls = [], local = new Map(), sess = new Map(), beacons = [], listeners = {};
  globalThis.location = { search, href: "https://games.csiesheep.com/zongheng/play" + search };
  globalThis.document = { referrer };
  globalThis.sessionStorage = { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)) };
  globalThis.localStorage = { getItem: (k) => (local.has(k) ? local.get(k) : null), setItem: (k, v) => local.set(k, String(v)) };
  globalThis.window = { addEventListener: (t, f) => { listeners[t] = f; } };
  Object.defineProperty(globalThis, "navigator", { value: { sendBeacon: (u, b) => { beacons.push([u, b]); return true; } }, configurable: true });
  let n = 0;
  globalThis.fetch = async (url, init) => {
    calls.push([url, JSON.parse(init.body)]);
    const path = new URL(url).pathname;
    const sid = `s${++n}`;
    const body = path.endsWith("/start") ? { session_id: sid, player: { id: "p_x", display_name: "x" } }
      : path.endsWith("/end_and_restart") ? { session_id: sid, player: {}, previous: null } : { recorded: true };
    return { ok: true, status: 200, json: async () => body };
  };
  return { calls, local, sess, beacons, listeners };
}
const load = async () => import(P.href + "?v=" + Math.random());
const tick = () => new Promise((r) => setTimeout(r, 0));

T("#149 portal: no token -> no request at all, nothing stored", async () => {
  const e = env("");
  const m = await load();
  assert.equal(await m.portalStart(), null);
  m.portalResult("win");
  await m.portalRestart("lose");
  await tick();
  assert.equal(e.calls.length, 0);
  assert.equal(e.local.size, 0);
});

T("#149 portal: start, result, restart send only the spec's fields; the token never goes to localStorage", async () => {
  const e = env("?play=1&gp_token=" + "t".repeat(43));
  const m = await load();
  await m.portalStart();
  assert.deepEqual(Object.keys(e.calls[0][1]), ["token"]);
  assert.match(e.calls[0][0], /^https:\/\/try-our-games\.vercel\.app\/v1\/session\/start$/);
  m.portalResult("win");
  await tick();
  const r = e.calls[1][1];
  assert.match(e.calls[1][0], /\/v1\/session\/result$/);
  assert.equal(r.outcome, "win");
  for (const k of Object.keys(r)) assert.ok(["session_id", "outcome", "score", "duration_ms"].includes(k), `result field ${k}`);
  await m.portalRestart("win");
  await tick();
  assert.match(e.calls[2][0], /\/v1\/session\/end_and_restart$/);
  assert.equal(e.calls.length, 3, "a restart is one request, never result + start");
  assert.equal(e.local.size, 0, "nothing in localStorage");
  assert.equal(e.sess.get("gp_token"), "t".repeat(43), "the token may live in sessionStorage");
});

T("#149 wiring: the game imports the portal, never awaits it, and the GA allow-lists never carry gp_token", async () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /from\s+["']\.\/portal\.js["']/, "app.js imports portal.js");
  assert.doesNotMatch(app, /await\s+(Portal\.)?portal(Start|Restart|Result)/, "no await on a portal call");
  // A restart is ONE end_and_restart (guide section 5): the game has exactly one start call site (the first game) and
  // exactly one result call site (the end), and every later game goes through portalRestart. A restart wired as
  // result + start adds a call site of each.
  const calls = (name) => (app.match(new RegExp(`\\b${name}\\(`, "g")) || []).length;
  assert.equal(calls("portalStart"), 1, "portalStart is called from exactly one place");
  assert.equal(calls("portalResult"), 1, "portalResult is called from exactly one place");
  assert.ok(calls("portalRestart") >= 1, "later games go through portalRestart");
  for (const f of ["ga-safe-location.js", "index.html", "rules.html", "devlog.html", "play.html"]) {
    const s = readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
    assert.doesNotMatch(s, /ALLOW[^\n]*gp_token|GA_SAFE_PARAMS[^\n]*gp_token/, `${f}: gp_token is not allow-listed for GA`);
  }
});

// #111: every sibling game on games.csiesheep.com carries the same GA4 tag
// (G-Q4VS3P3T58); zongheng had none. Pins the tag id on the three real pages
// (index.html, play.html, rules.html) -- vp.html is a throwaway measuring
// page and stays out on purpose (see the #111 brief).
//
// Sent back twice already.
//
// 1st bounce: GA4's automatic page_view sent document.location.href
// verbatim, and play.html?room=CODE is a real, shareable URL, so the room
// code reached Google. Answered with an allow-list (ga-safe-location.js's
// sanitizeGaLocation) applied to page_location on every hit.
//
// 2nd bounce: that wasn't enough. GA4 Enhanced Measurement's own listeners
// (scroll, form_start, and page_view triggered by a history.replaceState
// call -- onRoomMsg() used to rewrite the address bar to ?room=CODE once a
// room was joined) read location.href directly; no page_location parameter
// on any gtag() call reaches them. The only fix that holds is keeping the
// room code out of the address bar completely: play.html's own inline
// <head> script (before the gtag tag, before app.js) moves a shared link's
// ?room=CODE into sessionStorage and cleans the URL; onRoomMsg() no longer
// writes it back. sanitizeGaLocation stays on as a second line of defence
// for the hits this app does send on purpose (the view_* funnel events).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanitizeGaLocation, GA_SAFE_PARAMS } from "../public/ga-safe-location.js";
import { stripRoomFromUrl, buildRoomShareUrl, readAndConsume } from "../public/room-url.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const GTAG_SRC = /<script[^>]*async[^>]*src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-Q4VS3P3T58"[^>]*><\/script>/;
const GTAG_CONFIG = /gtag\(\s*['"]config['"]\s*,\s*['"]G-Q4VS3P3T58['"]/;

for (const page of ["index.html", "play.html", "rules.html"]) {
  test(`${page} carries the G-Q4VS3P3T58 tag, loaded async`, () => {
    const html = readFileSync(path.join(here, `../public/${page}`), "utf8");
    assert.match(html, GTAG_SRC, "the gtag.js script tag must be present and async, so it can't block first paint");
    assert.match(html, GTAG_CONFIG, "gtag('config', ...) must be called with the same id");
  });
}

test("vp.html (a throwaway measuring page) carries no analytics tag", () => {
  const html = readFileSync(path.join(here, "../public/vp.html"), "utf8");
  assert.doesNotMatch(html, /googletagmanager\.com/);
});

test("app.js fires a named view event for setup, table and the end screen", () => {
  const js = readFileSync(path.join(here, "../public/app.js"), "utf8");
  assert.match(js, /view_setup/);
  assert.match(js, /view_table/);
  assert.match(js, /view_end/);
});

test("play.html's automatic page_view is off -- its own URL can carry a room code, live", () => {
  const html = readFileSync(path.join(here, "../public/play.html"), "utf8");
  assert.match(html, /send_page_view\s*:\s*false/, "play.html must not let GA4's default automatic page_view read the live (possibly ?room=CODE) URL");
});

test("app.js stamps every view_* event with a sanitized page_location, not the raw URL", () => {
  const js = readFileSync(path.join(here, "../public/app.js"), "utf8");
  assert.match(js, /sanitizeGaLocation\(location\.href\)/, "trackView() must sanitize location.href before handing it to gtag");
  assert.doesNotMatch(js, /page_location:\s*location\.href[^)]*\)/, "must not pass the raw location.href as page_location anywhere");
});

test("index.html and rules.html's config-time page_location allow-lists never include room", () => {
  for (const page of ["index.html", "rules.html"]) {
    const html = readFileSync(path.join(here, `../public/${page}`), "utf8");
    const m = html.match(/var ALLOW = (\[[^\]]*\]);/);
    assert.ok(m, `${page} must build page_location from an explicit ALLOW list`);
    const allow = JSON.parse(m[1].replace(/'/g, '"'));
    assert.ok(!allow.includes("room"), `${page}'s allow-list must not include room`);
  }
});

test("sanitizeGaLocation: an allow-list, not a strip-list -- room and any unlisted param are dropped", () => {
  assert.equal(
    sanitizeGaLocation("https://games.csiesheep.com/zongheng/play.html?room=SECRET7"),
    "https://games.csiesheep.com/zongheng/play.html",
  );
  assert.equal(
    sanitizeGaLocation("https://games.csiesheep.com/zongheng/play.html?create=1&room=SECRET7"),
    "https://games.csiesheep.com/zongheng/play.html?create=1",
  );
  assert.equal(
    sanitizeGaLocation("https://games.csiesheep.com/zongheng/play.html?room=SECRET7&side=qin&lang=en"),
    "https://games.csiesheep.com/zongheng/play.html?side=qin&lang=en",
  );
  // a param nobody put on the allow-list yet -- proves this drops by
  // default rather than needing to learn each new name -- and the hash,
  // which is always dropped.
  assert.equal(
    sanitizeGaLocation("https://x.example/play.html?room=ABCD&spy=1#room=ABCD"),
    "https://x.example/play.html",
  );
});

test("GA_SAFE_PARAMS itself never includes room or name", () => {
  assert.ok(!GA_SAFE_PARAMS.includes("room"));
  assert.ok(!GA_SAFE_PARAMS.includes("name"));
});

// ---------- 2nd bounce: the room code must never reach the address bar ----------

test("stripRoomFromUrl: pulls ?room= out, keeps everything else (other params, hash)", () => {
  assert.deepEqual(
    stripRoomFromUrl("https://games.csiesheep.com/zongheng/play.html?room=SECRET7"),
    { code: "SECRET7", cleanUrl: "https://games.csiesheep.com/zongheng/play.html" },
  );
  assert.deepEqual(
    stripRoomFromUrl("https://games.csiesheep.com/zongheng/play.html?create=1&room=secret7&side=qin"),
    { code: "SECRET7", cleanUrl: "https://games.csiesheep.com/zongheng/play.html?create=1&side=qin" },
  );
  assert.deepEqual(
    stripRoomFromUrl("https://x.example/play.html?room=ABCD#lobby"),
    { code: "ABCD", cleanUrl: "https://x.example/play.html#lobby" },
  );
});

test("stripRoomFromUrl: a URL with no room param is returned unchanged", () => {
  const href = "https://games.csiesheep.com/zongheng/play.html?play&side=qin";
  assert.deepEqual(stripRoomFromUrl(href), { code: null, cleanUrl: href });
});

test("buildRoomShareUrl: the share link is built from the code in state, nothing else", () => {
  assert.equal(
    buildRoomShareUrl("https://games.csiesheep.com", "/zongheng/play.html", "ABCD"),
    "https://games.csiesheep.com/zongheng/play.html?room=ABCD",
  );
});

test("readAndConsume: a sessionStorage round trip that only ever fires once", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  storage.setItem("zh.joinRoom", "SECRET7");
  assert.equal(readAndConsume(storage, "zh.joinRoom"), "SECRET7");
  // consumed: reading again (e.g. some other code path booting later, or a
  // second call by mistake) must not still find it and silently rejoin.
  assert.equal(readAndConsume(storage, "zh.joinRoom"), null);
});

test("readAndConsume: a key that was never set returns null and touches nothing", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("must not write"); }, removeItem: () => { throw new Error("must not remove"); } };
  assert.equal(readAndConsume(storage, "zh.joinRoom"), null);
});

test("play.html's own inline <head> script strips ?room= before the gtag tag loads", () => {
  const html = readFileSync(path.join(here, "../public/play.html"), "utf8");
  const gtagIdx = html.indexOf("googletagmanager.com");
  const stripIdx = html.indexOf('sessionStorage.setItem("zh.joinRoom"');
  assert.ok(stripIdx !== -1, "play.html must strip the room code into sessionStorage before anything else");
  assert.ok(stripIdx < gtagIdx, "the room-code stripping script must come before the gtag tag in document order");
  assert.match(html, /u\.searchParams\.delete\("room"\)/, "must actually remove ?room= from the URL object");
  assert.match(html, /history\.replaceState\(/, "must rewrite the address bar, not just read it");
});

test("app.js's onRoomMsg no longer writes the room code back into the address bar", () => {
  const js = readFileSync(path.join(here, "../public/app.js"), "utf8");
  assert.doesNotMatch(js, /history\.replaceState\([^)]*room/i, "no history.replaceState call may reference a room code");
  assert.match(js, /buildRoomShareUrl\(/, "the copy-link button must build its URL from state, via room-url.js");
});

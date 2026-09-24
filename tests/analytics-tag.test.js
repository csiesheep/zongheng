// #111: every sibling game on games.csiesheep.com carries the same GA4 tag
// (G-Q4VS3P3T58); zongheng had none. Pins the tag id on the three real pages
// (index.html, play.html, rules.html) -- vp.html is a throwaway measuring
// page and stays out on purpose (see the #111 brief).
//
// Sent back once already: the first pass let GA4's automatic page_view send
// document.location.href verbatim, and play.html?room=CODE is a real,
// shareable URL, so the room code reached Google. The fix is an allow-list
// (public/ga-safe-location.js's sanitizeGaLocation) applied to page_location
// on every hit -- config-time for index.html/rules.html, event-time for
// play.html's own view_setup/view_table/view_end (whose page_location can't
// be fixed at config time, since onRoomMsg() rewrites the address bar to
// ?room=CODE with history.replaceState well after that config call ran, see
// app.js). play.html's own automatic page_view is switched off outright
// (send_page_view: false) since no page_location override, config-time or
// not, can un-see a URL that changes after it fires.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanitizeGaLocation, GA_SAFE_PARAMS } from "../public/ga-safe-location.js";

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

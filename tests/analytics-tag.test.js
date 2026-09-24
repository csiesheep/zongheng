// #111: every sibling game on games.csiesheep.com carries the same GA4 tag
// (G-Q4VS3P3T58); zongheng had none. Pins the tag id on the three real pages
// (index.html, play.html, rules.html) -- vp.html is a throwaway measuring
// page and stays out on purpose (see the #111 brief).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const GTAG_SRC = /<script[^>]*async[^>]*src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-Q4VS3P3T58"[^>]*><\/script>/;
const GTAG_CONFIG = /gtag\(\s*['"]config['"]\s*,\s*['"]G-Q4VS3P3T58['"]\s*\)/;

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

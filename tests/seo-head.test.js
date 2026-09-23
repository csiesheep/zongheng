// #108: the landing page was noindex while the game was unlisted from the
// hub's front page; it is going live there, so it must be findable. Pins the
// three things a regression would most easily undo: the noindex removal
// itself, and the two tags a crawler needs to treat en/zh-Hant as one page
// (canonical, hreflang) rather than two duplicates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, "../public/index.html"), "utf8");

test("landing page has no noindex", () => {
  assert.doesNotMatch(html, /<meta[^>]*name="robots"[^>]*noindex/i, "the landing page must be indexable now that it's linked from the hub");
});

test("landing page has a canonical link", () => {
  assert.match(html, /<link[^>]*rel="canonical"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/"/);
});

test("landing page has both hreflang links (en and zh-Hant)", () => {
  assert.match(html, /<link[^>]*rel="alternate"[^>]*hreflang="en"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/"/);
  assert.match(html, /<link[^>]*rel="alternate"[^>]*hreflang="zh-Hant"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/\?lang=zh-Hant"/);
});

// play.html and vp.html are a room / a live game state and a throwaway
// measuring page respectively -- neither has unique content worth ranking,
// and both must stay out of the index.
const playHtml = readFileSync(path.join(here, "../public/play.html"), "utf8");
const vpHtml = readFileSync(path.join(here, "../public/vp.html"), "utf8");

test("play.html and vp.html keep noindex", () => {
  assert.match(playHtml, /<meta[^>]*name="robots"[^>]*noindex/i);
  assert.match(vpHtml, /<meta[^>]*name="robots"[^>]*noindex/i);
});

test("rules.html has no noindex, its own canonical and both hreflang links", () => {
  const rulesHtml = readFileSync(path.join(here, "../public/rules.html"), "utf8");
  assert.doesNotMatch(rulesHtml, /<meta[^>]*name="robots"[^>]*noindex/i);
  assert.match(rulesHtml, /<link[^>]*rel="canonical"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/rules"/);
  assert.match(rulesHtml, /<link[^>]*rel="alternate"[^>]*hreflang="en"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/rules"/);
  assert.match(rulesHtml, /<link[^>]*rel="alternate"[^>]*hreflang="zh-Hant"[^>]*href="https:\/\/games\.csiesheep\.com\/zongheng\/rules\?lang=zh-Hant"/);
});

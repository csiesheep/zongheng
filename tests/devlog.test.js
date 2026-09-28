// Guard for #146 (orchestrator-owned): the 開發日誌 / Dev log page.
//
// Owner, 2026-09-28: 「at the bottom of landing page, add a link to a new page of 開發日誌」, 「用 A，數字拿掉，英文照翻」.
// The page is static HTML carrying both languages, so a crawler reads every entry without running script.
// Three states: public/devlog.html missing -> todo; present -> every check runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const P = new URL("../public/devlog.html", import.meta.url);
const ready = existsSync(P);
const T = (name, fn) => (ready ? test(name, fn) : test.todo(name + " (not implemented yet)"));
const html = () => readFileSync(P, "utf8");
const DATES = ["2026.09.28", "2026.09.27", "2026.09.22", "2026.09.21", "2026.09.20", "2026.09.18"];

T("#146 devlog: every entry is in the HTML itself, newest first, in both languages", () => {
  const h = html();
  const seen = DATES.map((d) => h.indexOf(d));
  seen.forEach((i, k) => assert.ok(i >= 0, `date ${DATES[k]} is in the page`));
  for (let k = 1; k < seen.length; k++) assert.ok(seen[k] > seen[k - 1], `newest first: ${DATES[k - 1]} before ${DATES[k]}`);
  for (const zh of ["說書人上場", "擲骰遊說", "下載紀錄", "正式上線", "烽火開場", "開工"]) assert.ok(h.includes(zh), `zh entry: ${zh}`);
  for (const en of ["battle report", "dice", "replay", "Foster", "beacon", "Twilight Struggle"]) assert.ok(h.toLowerCase().includes(en.toLowerCase()), `en entry: ${en}`);
  assert.ok(!/484|734 次|11 天/.test(h), "the owner took the numbers out");
});

T("#146 devlog: the landing links to it, and it links back and to the blog post", () => {
  const land = readFileSync(new URL("../public/index.html", import.meta.url), "utf8") + readFileSync(new URL("../public/landing.js", import.meta.url), "utf8");
  assert.match(land, /href="?devlog(\.html)?"?/, "the landing links to the dev log");
  const h = html();
  assert.match(h, /csiesheep\.com\/2026\/09\/23\//, "links the blog's 縱橫 dev diary post");
  assert.match(h, /href="\.\/"|href="\/zongheng\/"|href="index\.html"/, "a way back to the game");
  assert.match(h, /privacy-policy/, "the privacy link, as on every page");
});

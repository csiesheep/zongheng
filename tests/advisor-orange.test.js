// Guard for #100 (owner, UX audit item 4): the advisor gets exactly one
// colour (#f5892a), defined once as a CSS custom property and used
// everywhere it marks anything -- never the page's own gold, and never a
// second, independently-chosen orange. Also guards the "pick a use first"
// warning string existing in both language files (app.js's
// flashUseWarning()/renderPromptAndSheet() read `sheet.pickUseFirst`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

const PUBLIC = new URL("../public/", import.meta.url);
const read = (name) => readFileSync(new URL(name, PUBLIC), "utf8");

// #100's own ruling: the advisor's one colour, from the design canvas
// (AdvCol_Orange), copied here by hand -- never read back out of the
// product, same convention advisor.test.js already uses for its constants.
const ADVISOR_HEX = "#f5892a";
const OLD_GOLD_HEX = "#e9b92e";
const OLD_GOLD_RGB = "233, 185, 46";

test("the advisor colour is defined exactly once, as a single CSS custom property", () => {
  const files = readdirSync(PUBLIC).filter((f) => f.endsWith(".css"));
  const defs = [];
  for (const f of files) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    const re = /--advisor\s*:\s*([^;]+);/g;
    let m;
    while ((m = re.exec(css))) defs.push({ file: f, value: m[0].trim() });
  }
  // --advisor (the colour itself, not --advisor-rgb) must be declared exactly once.
  const onlyColour = defs.filter((d) => /^--advisor\s*:/.test(d.value));
  assert.equal(onlyColour.length, 1, `--advisor should be declared exactly once, found: ${JSON.stringify(onlyColour)}`);
  assert.match(onlyColour[0].value, new RegExp(ADVISOR_HEX, "i"), "the one --advisor declaration should be #f5892a");
});

test("no advisor rule still uses the old gold literal (#e9b92e or its rgb triple)", () => {
  // Strip comments first (the old value is legitimately named in a couple of
  // historical /* ... */ notes -- see advisor.css's own top comment and
  // style.css's lastmove-frame note); only a literal left in a real
  // declaration after that is a regression.
  const files = readdirSync(PUBLIC).filter((f) => f.endsWith(".css"));
  const bad = [];
  for (const f of files) {
    const withoutComments = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    if (withoutComments.includes(OLD_GOLD_HEX) || withoutComments.includes(OLD_GOLD_RGB)) bad.push(f);
  }
  assert.deepEqual(bad, [], "an active CSS declaration still uses the old gold literal instead of var(--advisor)");
});

test("the advisor's suggested-use mark is a dashed outline, never a border-color/box-shadow fill (suggested != selected)", () => {
  const css = read("advisor.css");
  const rule = /\.sheet-grid button\.adv-pick[\s\S]*?\{([^}]*)\}/.exec(css);
  assert.ok(rule, "expected a .sheet-grid button.adv-pick rule in advisor.css");
  const body = rule[1];
  assert.match(body, /outline\s*:\s*2px dashed var\(--advisor\)/, "the suggested-use mark should be a dashed outline");
  assert.doesNotMatch(body, /border-color\s*:/, "the suggested-use mark should not repaint the button's border (that's the real-selection look)");
  assert.doesNotMatch(body, /box-shadow\s*:/, "the suggested-use mark should not glow like the hand card (that reads as filled/selected)");
});

test("the suggested-use mark and the suggested hand card both carry a localized 「軍師」/Advisor tab", () => {
  const css = read("advisor.css");
  assert.match(css, /content:\s*"軍師"/, "expected a zh-Hant 軍師 tab");
  assert.match(css, /:root\[lang="en"\][^{]*\{\s*content:\s*"Advisor"/, "expected an English Advisor tab");
});

test("sheet.pickUseFirst exists in both language files and is non-empty", () => {
  for (const [name, dict] of [["en", EN], ["zh-Hant", ZH]]) {
    assert.equal(typeof dict.sheet?.pickUseFirst, "string", `${name}.sheet.pickUseFirst should be a string`);
    assert.ok(dict.sheet.pickUseFirst.trim().length > 0, `${name}.sheet.pickUseFirst should not be empty`);
  }
  assert.notEqual(EN.sheet.pickUseFirst, ZH.sheet.pickUseFirst);
});

test("the collapsed history toggle button has no border/background of its own (no box-inside-a-box)", () => {
  const css = read("style.css");
  const rule = /\.sheet-history-toggle\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, "expected a .sheet-history-toggle rule in style.css");
  assert.match(rule[1], /border\s*:\s*none/, "the toggle button should not draw its own border inside .sheet-textbox's border");
});

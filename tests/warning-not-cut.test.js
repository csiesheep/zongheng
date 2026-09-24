// Guard for #110 (orchestrator-owned): a warning that can lose the game is
// never truncated.
//
// #97 put a line in the prompt area — "a scoring card is still in your hand;
// play it before the turn ends or you lose" — and #24's compact sheet shows a
// single `nowrap` + `ellipsis` line when the lower block runs out of room. The
// two met: the warning and the state's own sentence were concatenated into
// that one line, and the tail was cut. At 375 en the player read "…play it…"
// and never saw "or you lose"; at 390 zh 「負。」 was gone (measured 555/339
// and 373/354 by the #109 checker, screenshots in _orch_keep/shots/109).
//
// #110's fix moved the clipping off `.sheet-title` onto a new `.sheet-rest`
// wrapper, and lets the warning wrap. These checks read the stylesheet, the
// way tests/css-viewport.test.js does, because the bug is a cascade fact: the
// source can say the right thing and the screen still cut the words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("../public/style.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const APP = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

// Flat `selector { declarations }` blocks, as css-viewport.test.js reads them.
function rules() {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(CSS))) out.push({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] });
  return out;
}
const decl = (body, prop) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(body);
  return m ? m[1].trim() : null;
};

test("#110: the compact sheet's warning is allowed to wrap, and is not clipped", () => {
  const warn = rules().filter((r) => /\.sheet-title\s*>\s*\.prompt-warn/.test(r.sel));
  assert.ok(warn.length, "no rule targets the warning inside the compact title");
  const last = warn[warn.length - 1];
  assert.equal(decl(last.body, "white-space"), "normal", "the warning must wrap, not stay on one line");
  assert.equal(decl(last.body, "overflow"), "visible", "the warning must not be clipped");
  assert.match(decl(last.body, "text-overflow") || "", /clip/, "the warning must not end in an ellipsis");
});

test("#110: the one-line ellipsis lives on .sheet-rest, not on the title itself", () => {
  const rest = rules().filter((r) => /\.sheet-rest\b/.test(r.sel) && decl(r.body, "text-overflow"));
  assert.ok(rest.length, "nothing gives .sheet-rest the single-line treatment");
  assert.equal(decl(rest[rest.length - 1].body, "white-space"), "nowrap");
  // The title itself must not re-impose the clipping on everything inside it:
  // if it does, the warning's own rule above is fighting the cascade again.
  const title = rules().filter((r) => /\.sheet-compact\s+\.sheet-title\s*$/.test(r.sel) && /ellipsis/.test(r.body));
  assert.equal(title.length, 0, "the compact title itself still clips its children: " + title.map((t) => t.sel).join(", "));
});

test("#110: the warning is rendered outside the clipped wrapper", () => {
  // setPrompt() must keep the warning a direct child of the title and put
  // everything else in .sheet-rest; if a later edit wraps the warning too,
  // the CSS above stops protecting anything.
  assert.match(APP, /sheet-rest/, "app.js no longer builds the .sheet-rest wrapper");
  const i = APP.indexOf("sheet-rest");
  const near = APP.slice(Math.max(0, i - 1200), i + 1200);
  assert.match(near, /roundWarn|prompt-warn/, "the .sheet-rest wrapper is built without keeping the warning out of it");
});

// Guard for #127 (orchestrator-owned): no log row ever shows a raw
// placeholder, and a finished game's log ends with its game-over row.
//
// The log panel renders each engine entry type through its own template. When
// a type had no case — a turn-end score row, a game-over entry, or a move's
// steps orphaned by the engine's 400-entry cap (#128) — the generic path
// printed the template unfilled, and players saw 「{q}」「{mandate}」「{target}」.
// The #127 checker counted 742 such braces over 100 games on 0e558a8, and 0
// after the fix. This test plays real bot games and renders every full log in
// both languages, the way the panel does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playGame } from "./sim.js";
import { renderRows } from "../public/log-view.js";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const BRACE = /\{[A-Za-z_][\w.]*\}/g;

test("#127: no log row shows a raw {placeholder}, in either language", () => {
  const found = new Map();
  for (const seed of SEEDS) {
    const { st } = playGame(seed);
    for (const lang of ["zh-Hant", "en"]) {
      const { html } = renderRows(st.log, { lang });
      for (const m of html.match(BRACE) || []) found.set(m, (found.get(m) || 0) + 1);
    }
  }
  assert.deepEqual([...found.entries()], [], "raw placeholders in the log: " + [...found.entries()].map(([k, n]) => `${k}×${n}`).join(", "));
});

test("#127: a finished game's log ends with its game-over row", () => {
  for (const seed of SEEDS.slice(0, 4)) {
    const { st } = playGame(seed);
    assert.ok(st.winner != null, `seed ${seed} did not finish`);
    const { html } = renderRows(st.log, { lang: "zh-Hant" });
    assert.match(html, /logrow-over/, `seed ${seed}: the log has no game-over row`);
    const last = html.lastIndexOf("logrow-over"), lastRow = html.lastIndexOf('class="logrow');
    assert.ok(last >= lastRow, `seed ${seed}: the game-over row is not the last row`);
  }
});

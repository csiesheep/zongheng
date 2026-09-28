// Guard for #145 (orchestrator-owned): the 戰報 waiting page's 本局回顧 -- one line of highlights per year, from the
// digest's own 「本年要事」, in both languages, with no game words and no bookkeeping.
//
// Owner, 2026-09-28: 「做 A，廣告先留空位」 -- design A: while the report is being written, the page shows this game's
// Mandate line and each year's key events, with an ad slot between them (left empty until AdSense is approved).
// Three states: `yearHighlights` not exported yet -> todo; exported -> every check runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { exportGame } from "../public/shared/export.js";
import * as D from "../public/shared/report-digest.js";

function botGame(seed, level) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(710000000 + seed);
  for (let k = 0; st.winner == null && k < 4000; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const a = level === "easy" ? B.randomAction(st, side, rng) : B.decide(E.view(st, side), side, level, rng);
    st = E.apply(st, a);
  }
  return st;
}
const GAMES = [[1, "normal"], [2, "hard"], [3, "easy"]].map(([s, l]) => botGame(s, l));
const exp = (st, viewer) => exportGame(E.view(st, viewer), { mode: "solo", viewer, level: "normal", lang: "zh" });
const ready = typeof D.yearHighlights === "function";
const T = (name, fn) => (ready ? test(name, fn) : test.todo(name + " (not implemented yet)"));

const ZH_BANNED = /打出|出牌|手牌|抽牌|棄牌|牌庫|記分|計分|得分|分數|扶植|奇襲|行動點|回合|骰|其事見/;
const EN_BANNED = /\b(cards?|ops|scor(e|ed|es|ing)|points|dice|discard(ed|s)?|deck)\b|see the affair|\(in the days of/i;

T("#145 highlights: one entry per year, 1 or 2 short lines, both languages, the same for every seat", () => {
  for (const st of GAMES) {
    for (const lang of ["zh", "en"]) {
      const h = D.yearHighlights(exp(st, E.QIN), lang);
      assert.equal(JSON.stringify(D.yearHighlights(exp(st, E.CHU), lang)), JSON.stringify(h), "the seat does not change it");
      assert.equal(h.length, st.turn, "one entry per year");
      h.forEach((y, i) => {
        assert.equal(y.turn, i + 1);
        assert.ok(Array.isArray(y.items) && y.items.length >= 1 && y.items.length <= 2, `year ${y.turn}: 1-2 items`);
        for (const s of y.items) {
          assert.equal(typeof s, "string");
          assert.ok(s.length > 0 && s.length <= (lang === "zh" ? 40 : 140), `year ${y.turn} ${lang}: short line (${s.length}): ${s}`);
          assert.doesNotMatch(s, lang === "zh" ? ZH_BANNED : EN_BANNED, `year ${y.turn} ${lang}: no game words or bookkeeping: ${s}`);
        }
      });
    }
  }
});

T("#145 highlights: the last year names how the game ended", () => {
  for (const st of GAMES) {
    const last = D.yearHighlights(exp(st, E.QIN), "zh").at(-1).items.join(" ");
    const who = st.winner === E.QIN ? "秦" : "楚";
    assert.match(last, new RegExp(who), `the last year's highlight names the winner ${who}: ${last}`);
  }
});

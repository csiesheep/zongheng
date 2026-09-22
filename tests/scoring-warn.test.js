// Guard for #102 item 3 (orchestrator, iPhone screenshot: "1 action(s) left
// this round; 1 scoring card(s) in hand" isn't real English -- {n}/{m} can
// each be 1 or more independently; round 2: "...play THEM..." is also wrong
// with exactly one scoring card, needs "play IT"). app.js's own
// scoringWarnText() (not importable here -- it's a plain top-level browser
// script with DOM side effects on import, not a module) picks one/other per
// count and stitches prompt.scoringWarn.{action,card,verb}.{one,other} +
// .full together; this test mirrors that same small pick-and-substitute by
// hand, the same convention advisor-orange.test.js already uses for its own
// copied-by-hand constants, so a broken i18n key (or a reintroduced "(s)"/
// "them" literal) goes red here without needing a DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

// Mirrors app.js's own `t(key, params)` exactly (key.split(".").reduce(...),
// then a {placeholder} substitution) against a plain dict instead of the
// live S/lang globals.
const t = (dict, key, p = {}) =>
  String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), dict) ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));

// Mirrors app.js's own scoringWarnText() composition (minus the two engine
// lookups that decide left/m -- this test picks those directly). The verb
// pronoun ("play it"/"play them") pluralizes on the SAME {m} count as
// `card`, not on `left` -- it is a pronoun for the scoring cards, not the
// actions.
function scoringWarn(dict, left, m) {
  const action = t(dict, `prompt.scoringWarn.action.${left === 1 ? "one" : "other"}`, { n: left });
  const card = t(dict, `prompt.scoringWarn.card.${m === 1 ? "one" : "other"}`, { m });
  const verb = t(dict, `prompt.scoringWarn.verb.${m === 1 ? "one" : "other"}`);
  return t(dict, "prompt.scoringWarn.full", { action, card, verb });
}

test("en: the always-on scoring-card warning uses real singular/plural, independently for actions and cards", () => {
  assert.equal(
    scoringWarn(EN, 1, 1),
    "1 action left this round; 1 scoring card in hand: play it before the turn ends, or you lose.",
  );
  assert.equal(
    scoringWarn(EN, 2, 2),
    "2 actions left this round; 2 scoring cards in hand: play them before the turn ends, or you lose.",
  );
  // The two counts are independent -- one can be singular while the other
  // isn't (the exact case the old "(s)" template got wrong).
  assert.equal(
    scoringWarn(EN, 1, 2),
    "1 action left this round; 2 scoring cards in hand: play them before the turn ends, or you lose.",
  );
  assert.equal(
    scoringWarn(EN, 2, 1),
    "2 actions left this round; 1 scoring card in hand: play it before the turn ends, or you lose.",
  );
  assert.doesNotMatch(scoringWarn(EN, 1, 1), /\(s\)/, "no leftover \"(s)\" template");
  // Round 2's own regression: exactly one scoring card must say "play it",
  // never "play them" (the pronoun follows `card`'s count, not `action`'s --
  // scoringWarn(EN, 2, 1) above already covers 2 actions/1 card too).
  assert.doesNotMatch(scoringWarn(EN, 1, 1), /play them/, "one scoring card should say \"play it\", not \"play them\"");
});

test("zh-Hant: the warning's wording is unchanged by the en-only pluralization refactor", () => {
  assert.equal(
    scoringWarn(ZH, 1, 1),
    "還剩 1 次行動,手上有 1 張記分卡:要在回合結束前打出,否則判負。",
  );
  assert.equal(
    scoringWarn(ZH, 2, 2),
    "還剩 2 次行動,手上有 2 張記分卡:要在回合結束前打出,否則判負。",
  );
});

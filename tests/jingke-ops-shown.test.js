// #122, BE. 荊軻刺秦王 played by Qin event first: the card page shows the ops Qin
// will really get. #119 made the engine read this card's own ops after its
// event (owner 裁決 #119:「其他照牌文字面改」), so the ops prompt that follows
// asks for 1; the card page kept showing the play-time 2.
// Rulebook card table: 荊軻刺秦王 (63, Chu, 2 ops)
//   「秦本回合剩餘所有牌行動點 −1(最低 1);楚須棄掉手中行動點最高的牌,事件不觸發。」
// 商鞅變法: 「本回合秦所有牌行動點 +1」; 逐客令 −1; 四、細則: 持續效果疊加,最低為 1.
// 田單復國 (41, Chu, 3 ops) changes no ops. Expected numbers are read off these, not off the code.
//
// app.js is a browser script with DOM side effects (not importable here, see
// scoring-warn.test.js): the number the page shows comes from bots.js's
// opsForOrder, which this file pins; app.js's use of it and the page's line
// in both languages are pinned by reading the source, the same convention
// warning-not-cut.test.js uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

function firstAction(seed) {
  let st = E.createGame(seed);
  const rng = E.makeRng(seed);
  for (let g = 0; g < 50 && (st.phase !== "action" || st.pending); g++) {
    const who = E.mustAct(st)[0];
    st = E.apply(st, B.decide(E.view(st, who), who, "easy", rng));
  }
  assert.equal(st.phase, "action");
  return st;
}
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((c) => c !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((c) => c !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((c) => c !== card);
  st.hands[side].push(card);
}
const SHANGYANG = { card: "shangyang", side: E.QIN, kind: "opsAll", target: E.QIN, delta: 1, until: "turn" };
const ZHUKELING = { card: "zhukeling", side: E.CHU, kind: "opsAll", target: E.QIN, delta: -1, until: "turn" };
function qinWith(card, lasting = []) {
  const st = firstAction(3);
  for (const e of lasting) E.addEffect(st, e);
  give(st, E.QIN, card);
  st.actor = E.QIN; st.phasing = E.QIN;
  return st;
}

const CASES = [
  { name: "荊軻, nothing else lasting", card: "jingke", lasting: [], opsFirst: 2, eventFirst: 1 },
  { name: "荊軻 with 商鞅變法", card: "jingke", lasting: [SHANGYANG], opsFirst: 3, eventFirst: 2 },
  { name: "荊軻 with 逐客令", card: "jingke", lasting: [ZHUKELING], opsFirst: 1, eventFirst: 1 },
  { name: "田單復國 (its event changes no ops)", card: "tiandan", lasting: [], opsFirst: 3, eventFirst: 3 },
];
for (const c of CASES) {
  test(`the ops shown for Qin's chosen order -- ${c.name}: ops first ${c.opsFirst}, event first ${c.eventFirst}`, () => {
    const st = qinWith(c.card, c.lasting);
    const v = E.view(st, E.QIN); // what the page renders from: Chu's hand is hidden
    assert.equal(B.opsForOrder(v, E.QIN, c.card, "opsFirst"), c.opsFirst, "ops first");
    assert.equal(B.opsForOrder(v, E.QIN, c.card, "eventFirst"), c.eventFirst, "event first");
    // And it is what the engine then asks for.
    const s = E.apply(st, { type: "play", side: E.QIN, card: c.card, use: "place", order: "eventFirst" });
    assert.ok(s.pending && s.pending.tag === "ops", "the ops prompt follows the event");
    assert.equal(s.pending.ops, c.eventFirst, "the engine's ops prompt agrees");
  });
}

test("the view the page renders from is not changed by asking", () => {
  const v = E.view(qinWith("jingke"), E.QIN);
  const before = JSON.stringify(v);
  B.opsForOrder(v, E.QIN, "jingke", "eventFirst");
  assert.equal(JSON.stringify(v), before);
});

const APP = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
test("app.js: the card page's ops for an enemy card come from the chosen order", () => {
  assert.match(APP, /B\.opsForOrder\(/, "app.js reads the ops through opsForOrder");
});

const t = (dict, key, p = {}) =>
  String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), dict) ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
for (const [name, dict] of [["zh-Hant", ZH], ["en", EN]]) {
  test(`${name}: the card page says how many ops an event-first play leaves`, () => {
    for (const [form, n] of [["one", 1], ["other", 2]]) {
      const s = t(dict, `sheet.hint.enemyOps.${form}`, { ops: n });
      assert.notEqual(s, `sheet.hint.enemyOps.${form}`, `sheet.hint.enemyOps.${form} exists`);
      assert.ok(s.includes(String(n)), `the line names the number: ${s}`);
      assert.doesNotMatch(s, /\{\w+\}/, "no placeholder left over");
    }
  });
}

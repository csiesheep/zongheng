// #119, BE. 田單復國 (tiandan, 41, Chu). Rulebook card table:
//   「移除秦在臨淄 2;楚在即墨、莒各放 2;若齊已滅,移除滅國標記。」
// Rulebook 三、滅國與相印: 「事件寫「若某國已滅,移除滅國標記」是唯一的例外復國方式(田單復國)。」
// owner 裁決(#119):「其他照牌文字面改」 -- the marker is removed and the card
// must not be undone by the very state it acted on. Until now, when Qin still
// controlled every Qi space after the event, the marker check right after it
// destroyed Qi again at once and the card did nothing.
// orchestrator's reading (#119 brief): after 田單復國 lifts 滅, Qi falls again
// only to a NEW conquest -- Qin gains control of a Qi space it did not control
// at the moment of the restore, then holds all of Qi. The 滅 VP stays one-time
// (三、滅國與相印: 「每國一局只給一次」). No other state changes.
//
// Control and cap from 三、影響力與控制 (control = own >= enemy + S; cap S + 2);
// Qi: 臨淄 S3, 即墨 S3, 莒 S3, 薛 S2 (二、棋盤). Expectations from these, not the engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

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
  st.actor = side; st.phasing = side;
}
const QI = ["linzi", "jimo", "ju", "xue"];
const qinHolds = (st) => QI.every((id) => E.controller(st, id) === E.QIN);
// Qi destroyed earlier (marker down, its 3 VP already paid), Qin's influence in
// Qi as given, Chu none there.
function destroyedQi(qin) {
  const st = firstAction(9);
  for (const id of QI) st.inf[id] = [qin[id], 0];
  st.mie.qi = true; st.mieVp.qi = true;
  return st;
}
const AT_CAP = { linzi: 5, jimo: 5, ju: 5, xue: 4 };
function playTiandan(st, by) {
  give(st, by, "tiandan");
  const action = by === E.CHU ? { type: "play", side: by, card: "tiandan", use: "event" } : { type: "play", side: by, card: "tiandan", use: "place", order: "eventFirst" };
  return E.apply(st, action);
}

for (const by of [E.CHU, E.QIN]) {
  const who = by === E.CHU ? "Chu as its event" : "Qin for ops, event first";
  test(`tiandan played by ${who}, Qin still holding all of Qi after it: 滅 is lifted and stays lifted`, () => {
    const st = destroyedQi(AT_CAP);
    const mandate = st.mandate;
    const s = playTiandan(st, by);
    // 臨淄 5-2 = 3 vs 0 (S3), 即墨 / 莒 5 vs 2 (S3), 薛 4 vs 0: Qin still controls every Qi space.
    assert.ok(qinHolds(s), "the setup: Qin controls all of Qi after the event");
    assert.ok(!s.mie.qi, "the 滅 marker is gone after the event");
    assert.ok(s.log.some((l) => l.type === "restore" && l.state === "qi"), "the restore is logged");
    assert.ok(!s.log.some((l, i) => l.type === "mie" && l.state === "qi" && i > s.log.findIndex((m) => m.type === "restore" && m.state === "qi")), "and not undone by a 滅 right after");
    assert.equal(s.mandate, mandate, "no VP either way");
    // More marker checks with Qin still holding the same spaces: not a new conquest.
    E.checkMarkers(s); E.checkMarkers(s);
    assert.ok(!s.mie.qi, "holding what Qin held at the restore does not destroy Qi again");
  });
}

test("tiandan: Qin loses one Qi space it held at the restore and takes it back -- a new conquest, Qi falls again, no second VP", () => {
  const s = playTiandan(destroyedQi(AT_CAP), E.CHU);
  const mandate = s.mandate;
  s.inf.xue = [4, 2]; // 4 vs 2, S2: Qin keeps 薛
  E.checkMarkers(s);
  assert.ok(!s.mie.qi, "still the spaces Qin held at the restore");
  s.inf.xue = [3, 2]; // 3 vs 2, S2: nobody controls 薛
  E.checkMarkers(s);
  assert.ok(!s.mie.qi, "Qin does not hold all of Qi");
  s.inf.xue = [4, 2]; // Qin controls 薛 again: gained after the restore
  E.checkMarkers(s);
  assert.ok(s.mie.qi, "Qi is destroyed again by the new conquest");
  assert.equal(s.mandate, mandate, "the 滅 VP is one-time");
});

test("tiandan: a Qi space Qin did not control at the restore, taken afterwards -- Qi falls again", () => {
  // 臨淄 Qin 4 at cap-1: 4-2 = 2 vs 0 < S3, so the event itself costs Qin 臨淄.
  const s = playTiandan(destroyedQi({ ...AT_CAP, linzi: 4 }), E.CHU);
  assert.ok(!s.mie.qi, "lifted");
  assert.notEqual(E.controller(s, "linzi"), E.QIN, "Qin lost 臨淄 to the event");
  s.inf.linzi = [5, 0];
  E.checkMarkers(s);
  assert.ok(s.mie.qi, "retaking 臨淄 is a new conquest");
});

test("tiandan: other states are destroyed as always while Qi is held after its restore", () => {
  const s = playTiandan(destroyedQi(AT_CAP), E.CHU);
  const han = E.spacesOfState("han");
  for (const id of han) s.inf[id] = [E.capOf(s, id), 0];
  E.checkMarkers(s);
  assert.ok(s.mie.han, "韓 falls the moment Qin holds all of it");
  assert.ok(!s.mie.qi, "齊 still lifted");
});

test("without 田單復國, a state Qin holds entirely is destroyed at once (unchanged)", () => {
  const st = firstAction(9);
  for (const id of QI) st.inf[id] = [AT_CAP[id], 0];
  E.checkMarkers(st);
  assert.ok(st.mie.qi, "齊 falls");
});

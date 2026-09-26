// #122, BE. The advisor and the bots read 田單復國's restore the way the engine does.
// Rulebook card table, 田單復國 (41): 「移除秦在臨淄 2;楚在即墨、莒各放 2;若齊已滅,移除滅國標記。」
// owner 裁決(#119):「其他照牌文字面改」; orchestrator's reading (#119 brief): after the
// restore Qi falls again only to a NEW conquest -- Qin gains control of a Qi space it
// did not control at the moment of the restore, then holds all of Qi.
// So right after a restore with Qin still holding every Qi space, 齊 is not "0 away
// from falling": nothing Qin does next can destroy it until Qin first loses a space.
//
// Expectations come from that reading and from 三、影響力與控制 (control = own >= enemy
// + S; cap S + 2; 臨淄/即墨/莒 S3, 薛 S2), not from the advisor or the evaluation.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";

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
const QI = ["linzi", "jimo", "ju", "xue"];
const AT_CAP = { linzi: 5, jimo: 5, ju: 5, xue: 4 };
const CAPITALS = new Set(Object.values(E.STATES).map((s) => s.capital));

// Qi destroyed earlier (marker down, VP paid), Qin at the cap in every Qi space.
// Qin's hand is 田單復國 alone, so whatever Qin does this action, the event fires
// (an enemy card played for ops fires its event in either order) -- except a 變法 play.
// The rest of the board leaves Qin nothing else to take or break with 3 ops:
// the non-state spaces and 遼東 are Qin's at the cap; every other state space is
// Chu's at the cap (capitals one below it, so no 相印 and no alliance win); at
// 疲敝 2 奇襲 is locked out of the home regions, 三晉, 周室 and every 要衝.
function qinHoldsTiandan(seed) {
  const st = firstAction(seed);
  for (const sp of E.SPACES) {
    st.inf[sp.id] = sp.state ? [0, E.capOf(st, sp.id) - (CAPITALS.has(sp.id) ? 1 : 0)] : [E.capOf(st, sp.id), 0];
  }
  for (const id of QI) st.inf[id] = [AT_CAP[id], 0];
  st.inf.liaodong = [E.capOf(st, "liaodong"), 0];
  st.mie.qi = true; st.mieVp.qi = true;
  st.weariness = 2;
  st.draw.push(...st.hands[E.QIN]); st.hands[E.QIN] = [];
  give(st, E.QIN, "tiandan");
  st.actor = E.QIN; st.phasing = E.QIN;
  return st;
}

test("advisor: Qin playing 田單復國 restores Qi while holding all of it -- the reason never says 齊 is about to fall", () => {
  const claims = [], restores = [];
  for (let seed = 1; seed <= 8; seed++) {
    const st = qinHoldsTiandan(seed);
    for (let r = 1; r <= 3; r++) {
      const a = advise(E.view(st, E.QIN), E.QIN, E.makeRng(r));
      assert.ok(a, `advice for seed ${seed} rng ${r}`);
      if (a.card === "tiandan" && ["place", "campaign", "lobby"].includes(a.use)) restores.push(`${seed}/${r}`);
      if (a.reason.key === "nearDestroy" && a.reason.params.state === "qi") {
        claims.push(`seed ${seed} rng ${r}: ${a.use} ${a.order} -> nearDestroy ${JSON.stringify(a.reason.params)}`);
      }
    }
  }
  assert.deepEqual(claims, [], "no advice says 齊 is n away from falling after a restore Qin cannot follow with a new conquest");
  assert.ok(restores.length > 0, "the setup: at least one advised move plays 田單復國 for its ops, so the restore happens");
});

test("advisor setup: the restore Qin's move makes leaves Qin holding all of Qi, and Qi standing", () => {
  const st = qinHoldsTiandan(2);
  let s = E.apply(st, { type: "play", side: E.QIN, card: "tiandan", use: "place", order: "eventFirst" });
  assert.ok(!s.mie.qi, "滅 lifted");
  assert.ok(QI.every((id) => E.controller(s, id) === E.QIN), "臨淄 5−2 = 3 vs 0 (S3), 即墨 / 莒 5 vs 2 (S3), 薛 4 vs 0 (S2): all Qin's");
  E.checkMarkers(s);
  assert.ok(!s.mie.qi, "and no marker check destroys it again");
});

// Chu restores Qi with its own event; Qin still controls all four spaces.
function restoredByChu() {
  const st = firstAction(9);
  for (const id of QI) st.inf[id] = [AT_CAP[id], 0];
  st.mie.qi = true; st.mieVp.qi = true;
  give(st, E.CHU, "tiandan");
  st.actor = E.CHU; st.phasing = E.CHU;
  const s = E.apply(st, { type: "play", side: E.CHU, card: "tiandan", use: "event" });
  assert.ok(!s.mie.qi && QI.every((id) => E.controller(s, id) === E.QIN), "the setup: 滅 lifted, Qin holds all of Qi");
  return s;
}
const qiRoad = (st, side) => { const t = {}; B.evaluate(st, side, t); return t["mieRoad:qi"] ?? 0; };

test("bots: Qi held entirely since its restore is further from 滅 than Qi one new conquest away", () => {
  const held = restoredByChu();
  // Chu breaks 薛: Qin 3 vs Chu 2 (S2) -- nobody controls it, it leaves the restore's list,
  // and Qin retaking 薛 (1 point: 4 vs 2) is a new conquest that destroys Qi.
  const open = E.clone(held);
  open.inf.xue = [3, 2];
  E.checkMarkers(open);
  assert.ok(!open.mie.qi, "not destroyed by the break itself");
  const retaken = E.clone(open);
  retaken.inf.xue = [4, 2];
  E.checkMarkers(retaken);
  assert.ok(retaken.mie.qi, "the rule this evaluation must follow: retaking 薛 destroys Qi");
  const a = qiRoad(held, E.QIN), b = qiRoad(open, E.QIN);
  assert.ok(a < b, `Qin's road to 滅 of 齊: held since the restore ${a} must be below one conquest away ${b}`);
});

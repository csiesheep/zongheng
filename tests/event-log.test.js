// #115, BE. The owner: 「在只用敵國的事件卡時,有時似乎沒有發生事件」. The engine
// fired the event (tests/event-audit/audit.js: every sided card, both orders),
// but it logged nothing of its own: an enemy card spent for ops showed its
// ops and nothing else, so an event the opponent resolved -- or one that had
// nothing to do -- looked exactly like one that never happened.
// Now every event logs `event` (card, the event's owner, who played it) before
// its effect, and `eventEnd` after it: whether it changed anything, and when it
// did not, why. The expected values come from each card's text in the
// rulebook (五、牌表), not from the engine's own diff.
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
  return st;
}
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((x) => x !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((x) => x !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((x) => x !== card);
  st.hands[side].push(card);
  st.actor = side; st.phasing = side;
}
const after = (s, seq) => s.log.filter((l) => l.i > seq);
function settle(s) {
  for (let g = 0; s.pending && g < 10; g++) s = E.apply(s, { type: "choose", side: s.pending.who, choice: B.answer(s, s.pending, s.pending.who, E.makeRng(g)) });
  return s;
}

test("收復河西 played by Chu for ops, ops first: the ops, then 秦's event, logged with who played it and what it did", () => {
  const st = firstAction(3);
  st.inf.hedong = [0, 0];
  give(st, E.CHU, "hexi");
  const seq = st.logSeq;
  const points = B.greedyPlacement(st, E.CHU, E.opsOf(st, E.CHU, "hexi"), (id) => id !== "hedong");
  const s = settle(E.apply(st, { type: "play", side: E.CHU, card: "hexi", use: "place", order: "opsFirst", points }));
  const L = after(s, seq);
  const iPlace = L.findIndex((l) => l.type === "place" && l.side === E.CHU);
  const iEvent = L.findIndex((l) => l.type === "event");
  const iEnd = L.findIndex((l) => l.type === "eventEnd");
  assert.ok(iEvent >= 0, "an `event` entry is logged");
  assert.ok(iEnd > iEvent, "an `eventEnd` entry follows it");
  assert.ok(iPlace >= 0 && iPlace < iEvent, "ops first: the placement is logged before the event");
  assert.deepEqual({ card: L[iEvent].card, side: L[iEvent].side, by: L[iEvent].by }, { card: "hexi", side: E.QIN, by: E.CHU });
  assert.equal(L[iEnd].effect, true);
  // 「秦在河東放 2」 on an empty 河東: Qin +2 there.
  assert.deepEqual(L[iEnd].inf.find((x) => x[0] === "hedong"), ["hedong", 2, 0]);
});

test("收復河西 played by Chu for ops, event first: the event is logged before the ops", () => {
  const st = firstAction(3);
  st.inf.hedong = [0, 0];
  give(st, E.CHU, "hexi");
  const seq = st.logSeq;
  let s = E.apply(st, { type: "play", side: E.CHU, card: "hexi", use: "place", order: "eventFirst" });
  s = settle(s);
  const L = after(s, seq);
  const iEnd = L.findIndex((l) => l.type === "eventEnd");
  const iOps = L.findIndex((l) => ["place", "campaign", "lobby", "opsLost"].includes(l.type) && l.side === E.CHU);
  assert.ok(iEnd >= 0 && iOps > iEnd, "event first: the event resolves (and says so) before the ops");
});

test("宜陽之戰 played by Chu with no Chu influence in the Three Jin: logged as an event with no target", () => {
  const st = firstAction(3);
  for (const sp of E.SPACES) if (sp.region === "jin") st.inf[sp.id] = [E.infOf(st, sp.id)[0], 0];
  give(st, E.CHU, "yiyang");
  const seq = st.logSeq;
  const s = settle(E.apply(st, { type: "play", side: E.CHU, card: "yiyang", use: "place", order: "eventFirst" }));
  const end = after(s, seq).find((l) => l.type === "eventEnd");
  assert.ok(end, "an `eventEnd` entry is logged");
  // 「秦對三晉任一據點發動免費征伐」 needs Chu influence to hit; there is none.
  assert.deepEqual({ card: end.card, side: end.side, by: end.by, effect: end.effect, why: end.why }, { card: "yiyang", side: E.QIN, by: E.CHU, effect: false, why: "noTarget" });
});

test("李信伐楚敗績 played by Qin with no Qin influence in the South at 承平: logged as an event that changed nothing", () => {
  const st = firstAction(3);
  for (const sp of E.SPACES) if (sp.region === "south") st.inf[sp.id] = [0, E.infOf(st, sp.id)[1]];
  st.weariness = 5;
  give(st, E.QIN, "lixin");
  const seq = st.logSeq;
  const s = settle(E.apply(st, { type: "play", side: E.QIN, card: "lixin", use: "place", order: "eventFirst" }));
  const end = after(s, seq).find((l) => l.type === "eventEnd");
  assert.ok(end, "an `eventEnd` entry is logged");
  // 「移除秦在南方每個據點各 1;疲敝軌後退 1」: nothing of Qin's there, and 承平 is the top of the track.
  assert.deepEqual({ card: end.card, side: end.side, by: end.by, effect: end.effect, why: end.why }, { card: "lixin", side: E.CHU, by: E.QIN, effect: false, why: "noChange" });
});

// The owner's own case (orchestrator, #115): Chu played 連橫使節 (envoy, Qin's:
// 「移除楚在任一據點 1 點影響力」) for 扶植 1. The log showed 「楚打出連橫使節 · 扶植 1 ·
// 邯鄲 +1」 and nothing else -- Qin had been asked, had chosen, and a Chu point was
// gone. Ops first, the removal here is taken from the very space just placed
// in: the map then looks unchanged, and only the log can say what happened.
for (const order of ["opsFirst", "eventFirst"]) {
  test(`連橫使節 played by Chu for 扶植, ${order}: the log names Qin's event, that Qin chose, and the Chu point it removed`, () => {
    const st = firstAction(3);
    give(st, E.CHU, "envoy");
    const seq = st.logSeq;
    const placeAt = E.opsOptions(st, E.CHU).placeOptions.find((o) => o.cost === 1).id;
    let s = E.apply(st, { type: "play", side: E.CHU, card: "envoy", use: "place", order, ...(order === "opsFirst" ? { points: [placeAt] } : {}) });
    let removedAt = null;
    for (let g = 0; s.pending && g < 5; g++) {
      const p = s.pending;
      if (p.tag === "event") {
        assert.equal(p.card, "envoy");
        assert.equal(p.who, E.QIN, "Qin answers its own event's choice");
        removedAt = order === "opsFirst" && p.options.includes(placeAt) ? placeAt : p.options[0];
        s = E.apply(s, { type: "choose", side: E.QIN, choice: [removedAt] });
      } else {
        assert.equal(p.kind, "ops");
        assert.equal(p.who, E.CHU, "event first: Chu spends the ops after the event");
        s = E.apply(s, { type: "choose", side: E.CHU, choice: { use: "place", points: [E.opsOptions(s, E.CHU).placeOptions.find((o) => o.cost === 1).id] } });
      }
    }
    assert.ok(removedAt, "Qin was asked where to remove");
    const L = after(s, seq);
    const ev = L.find((l) => l.type === "event"), end = L.find((l) => l.type === "eventEnd");
    assert.ok(ev && end, "the event is logged");
    assert.deepEqual({ card: ev.card, side: ev.side, by: ev.by }, { card: "envoy", side: E.QIN, by: E.CHU });
    assert.equal(end.effect, true);
    assert.deepEqual(end.chose, [E.QIN], "the log says Qin chose");
    assert.deepEqual(end.inf, [[removedAt, 0, -1]], `Chu −1 in ${removedAt}, nothing else`);
    const iOps = L.findIndex((l) => l.type === "place" && l.side === E.CHU), iEv = L.indexOf(ev);
    assert.ok(order === "opsFirst" ? iOps < iEv : iOps > iEv, `${order}: the order in the log is the order played`);
  });
}

test("an owner's own event is logged the same way (楚滅越 by Chu: 吳越 +2)", () => {
  const st = firstAction(3);
  st.inf.wuyue = [0, 0];
  give(st, E.CHU, "chumieyue");
  const seq = st.logSeq;
  const s = settle(E.apply(st, { type: "play", side: E.CHU, card: "chumieyue", use: "event" }));
  const L = after(s, seq);
  const ev = L.find((l) => l.type === "event"), end = L.find((l) => l.type === "eventEnd");
  assert.deepEqual({ side: ev.side, by: ev.by }, { side: E.CHU, by: E.CHU });
  assert.deepEqual(end.inf, [["wuyue", 0, 2]]);
});

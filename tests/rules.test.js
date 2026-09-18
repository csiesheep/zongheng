// One test per rule of the rulebook (Projects/zongheng/zongheng - rulebook.md),
// on hand-built positions. The fuzz test covers what these forgot.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";

const { QIN, CHU, JIUDING } = E;

// A game past setup, parked at Qin's first action with an empty plan and the
// hands replaced by what the test needs. Headlines are skipped on purpose.
function atAction(hands = [[], []], patch = {}) {
  let st = E.createGame(11);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["huaisi", "chencai"] });
  assert.equal(st.phase, "headline");
  // Put the cards the test wants into the hands and the rest back on the pile.
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !hands.flat().includes(c));
  st.hands = [hands[0].slice(), hands[1].slice()];
  Object.assign(st, { phase: "action", round: 1, actor: QIN, phasing: QIN, plan: [], pending: null, headline: [null, null] }, patch);
  return st;
}
const inf = (st, id) => E.infOf(st, id);
const setInf = (st, id, q, c) => { st.inf[id] = [q, c]; };

// ---------- influence, control, placement ----------
test("control needs stability more than the enemy; the cap eats the excess", () => {
  const st = atAction();
  setInf(st, "shangdang", 2, 1);
  assert.equal(E.controller(st, "shangdang"), null);
  setInf(st, "shangdang", 3, 1);
  assert.equal(E.controller(st, "shangdang"), QIN, "3 against 1 at stability 2 is control");
  setInf(st, "guanzhong", 4, 1);
  assert.equal(E.controller(st, "guanzhong"), null, "stability 4 needs four more");
  assert.equal(E.place(st, QIN, "shangdang", 5), 1); // cap 4
  assert.deepEqual(inf(st, "shangdang"), [4, 1]);
});

test("placement: reachable only from own influence or a controlled neighbour; 2 ops per point into enemy control, re-priced per point", () => {
  const st = atAction([["keqing"], []]);
  // Qin controls yiyang (2) and hedong (2); shangdang is adjacent to both.
  assert.ok(E.canPlaceAt(st, QIN, "shangdang"));
  assert.ok(!E.canPlaceAt(st, QIN, "linzi"));
  setInf(st, "shangdang", 0, 2); // Chu controls it
  assert.equal(E.placeCost(st, QIN, "shangdang"), 2);
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "keqing", use: "place", points: ["linzi"] }), /not reachable/);
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "keqing", use: "place", points: ["shangdang", "shangdang"] }), /not enough ops/);
  const after = E.apply(st, { type: "play", side: QIN, card: "keqing", use: "place", points: ["shangdang"] });
  assert.deepEqual(inf(after, "shangdang"), [1, 2]);
  // Once control is broken the next point costs 1 again: 3 ops = 2 + 1.
  const st3 = atAction([["shangyang"], []]);
  setInf(st3, "shangdang", 1, 2);
  const a3 = E.apply(st3, { type: "play", side: QIN, card: "shangyang", use: "place", points: ["shangdang", "shangdang"] });
  assert.deepEqual(inf(a3, "shangdang"), [3, 2]);
});

// ---------- campaign ----------
test("campaign removes then places, tires only on a battleground, and respects the locks", () => {
  const st = atAction([["shangyang", "keqing"], []]);
  setInf(st, "shangdang", 0, 2);
  const a = E.apply(st, { type: "play", side: QIN, card: "shangyang", use: "campaign", target: "shangdang" });
  assert.deepEqual(inf(a, "shangdang"), [1, 0]);
  assert.equal(a.weariness, 4, "a battleground tires the realm by one");
  assert.equal(a.actor, CHU);
  const st2 = atAction([["keqing"], []]);
  setInf(st2, "yiyang", 2, 1);
  const b = E.apply(st2, { type: "play", side: QIN, card: "keqing", use: "campaign", target: "yiyang" });
  assert.equal(b.weariness, 5, "a non-battleground does not tire");
  assert.deepEqual(inf(b, "yiyang"), [3, 0]);
  // Locks: home at 4, the Three Jin at 3, every battleground at 2.
  const st3 = atAction([["keqing"], []], { weariness: 4 });
  setInf(st3, "chencai", 1, 2); setInf(st3, "yiyang", 2, 1); setInf(st3, "ju", 0, 1);
  assert.ok(E.campaignLocked(st3, "chencai"), "Chu's home locks at 兵連");
  assert.ok(!E.campaignLocked(st3, "yiyang"));
  st3.weariness = 3;
  assert.ok(E.campaignLocked(st3, "yiyang"), "the Three Jin lock at 禍結");
  assert.ok(!E.campaignLocked(st3, "linzi"));
  st3.weariness = 2;
  assert.ok(E.campaignLocked(st3, "linzi"), "battlegrounds lock at 民困");
  assert.ok(!E.campaignLocked(st3, "ju"));
  assert.throws(() => E.apply(st3, { type: "play", side: QIN, card: "keqing", use: "campaign", target: "yiyang" }), /locked/);
});

test("campaign modifiers stack: 冶鐵 +1 this turn, 白起 +1 in the Three Jin and the South, 函谷關天險 −2 for Chu in the West, 軍功爵 once a turn", () => {
  const st = atAction();
  setInf(st, "shangdang", 0, 4);
  E.addEffect(st, { card: "yetie", side: QIN, kind: "campaign", who: QIN, delta: 1, regions: null, until: "turn" });
  E.addEffect(st, { card: "baiqi", side: QIN, kind: "campaign", who: QIN, delta: 1, regions: ["jin", "south"], until: "game" });
  assert.equal(E.campaignMod(st, QIN, "shangdang"), 2);
  assert.equal(E.campaignMod(st, QIN, "linzi"), 1);
  assert.equal(E.campaignMod(st, CHU, "shangdang"), 0);
  E.addEffect(st, { card: "hangu", side: QIN, kind: "campaign", who: CHU, delta: -2, regions: ["west"], until: "game" });
  assert.equal(E.campaignMod(st, CHU, "hangu"), -2);
  st.reform[QIN] = 3;
  const r = E.campaign(st, QIN, "shangdang", 2); // 2 +2 mods +1 perk = 5: remove 4, place 1
  assert.deepEqual([r.ops, r.removed, r.placed], [5, 4, 1]);
  assert.ok(st.perkUsed[QIN]);
  setInf(st, "handan", 0, 3);
  assert.equal(E.campaign(st, QIN, "handan", 2).ops, 4, "the perk is spent for the turn");
});

test("campaign refuses a space with no enemy influence and a space under 墨者守城", () => {
  const st = atAction([["keqing"], ["mozhe"]]);
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "keqing", use: "campaign", target: "linzi" }), /no enemy influence/);
  E.addEffect(st, { card: "mozhe", side: CHU, kind: "protect", space: "song", until: "turn" });
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "keqing", use: "campaign", target: "song" }), /protected/);
  assert.ok(!E.legal(st, QIN).cards[0].uses.campaign.targets.includes("song"));
});

// ---------- lobby ----------
test("lobby removes up to the edge, never tires, works under any lock", () => {
  const st = atAction([["shangyang"], []], { weariness: 2 });
  // shangdang's neighbours: yiyang (Qin), hedong (Qin), handan, xinzheng.
  setInf(st, "shangdang", 1, 3); setInf(st, "xinzheng", 0, 2);
  assert.equal(E.edge(st, QIN, "shangdang"), 1);
  const a = E.apply(st, { type: "play", side: QIN, card: "shangyang", use: "lobby", target: "shangdang" });
  assert.deepEqual(inf(a, "shangdang"), [1, 2]);
  assert.equal(a.weariness, 2);
  setInf(st, "xinzheng", 0, 0);
  assert.equal(E.edge(st, QIN, "shangdang"), 2);
  assert.equal(E.lobby(st, QIN, "shangdang", 3), 2);
  setInf(st, "handan", 0, 2); setInf(st, "xinzheng", 0, 2);
  assert.equal(E.edge(st, QIN, "shangdang"), 0);
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "shangyang", use: "lobby", target: "shangdang" }), /no edge/);
});

// ---------- weariness ----------
test("pushing the realm to 土崩 loses, even through the other side's event played for ops", () => {
  const st = atAction([[], ["changping"]], { weariness: 2, actor: CHU, phasing: CHU });
  setInf(st, "shangdang", 2, 0); setInf(st, "xinzheng", 3, 0); // some Qin influence in the Three Jin, but 禍結 locks it
  // Chu plays Qin's 長平之戰 for ops; the event needs no target (all locked), and its extra step collapses the realm.
  const a = E.apply(st, { type: "play", side: CHU, card: "changping", use: "place", points: ["ying"] });
  assert.equal(a.winner, QIN);
  assert.equal(a.reason, "collapse");
});

test("weariness recovers one box at the end of the turn", () => {
  const st = atAction([[], []], { weariness: 3, round: 6, rounds: 6, actor: CHU, phasing: CHU });
  st.hands = [[], []];
  const a = E.run(Object.assign(st, { plan: [{ do: "endAction" }] }));
  assert.equal(a.turn, 2);
  assert.equal(a.weariness, 4);
});

// ---------- markers ----------
test("滅: all of a state's spaces under Qin control, paid once; 復國 when Chu takes the capital back", () => {
  const st = atAction();
  setInf(st, "yiyang", 2, 0); setInf(st, "xinzheng", 3, 1);
  E.checkMarkers(st);
  assert.ok(st.mie.han);
  assert.equal(st.mandate, 2);
  setInf(st, "xinzheng", 1, 3);
  E.checkMarkers(st);
  assert.ok(!st.mie.han, "the capital restores the state");
  assert.ok(st.seals.han, "and gives Chu the seal");
  assert.equal(st.mandate, 1);
  setInf(st, "xinzheng", 3, 1);
  E.checkMarkers(st);
  assert.ok(st.mie.han && !st.seals.han);
  assert.equal(st.mandate, 1, "the second 滅 pays nothing");
});

test("three 滅 win for Qin; four 相印 win for Chu; 田單 lifts 滅 齊", () => {
  const st = atAction();
  for (const id of ["yiyang", "xinzheng", "hedong", "daliang", "ji", "liaodong"]) setInf(st, id, 4, 0);
  E.checkMarkers(st);
  assert.equal(st.winner, QIN);
  assert.equal(st.reason, "unification");
  const st2 = atAction();
  for (const id of ["xinzheng", "daliang", "handan", "linzi"]) setInf(st2, id, 0, 4);
  E.checkMarkers(st2);
  assert.equal(st2.winner, CHU);
  assert.equal(st2.reason, "alliance");
  const st3 = atAction([[], ["tiandan"]], { actor: CHU, phasing: CHU });
  for (const id of ["linzi", "jimo", "ju", "xue"]) setInf(st3, id, 4, 0);
  E.checkMarkers(st3);
  assert.ok(st3.mie.qi);
  const a = E.apply(st3, { type: "play", side: CHU, card: "tiandan", use: "event" });
  assert.ok(!a.mie.qi);
  assert.deepEqual(inf(a, "jimo"), [4, 2]);
  assert.ok(a.removed.includes("tiandan"));
});

// ---------- scoring ----------
test("scoring: presence, domination (more spaces and more battlegrounds), control; +1 per battleground; 楚滅越 bonus", () => {
  const st = atAction();
  // East: Chu controls song (bg) and xue; Qin controls jimo, ju.
  setInf(st, "song", 0, 2); setInf(st, "xue", 0, 2); setInf(st, "jimo", 3, 0); setInf(st, "ju", 3, 0); setInf(st, "linzi", 0, 0);
  let [q, c] = E.regionTally(st, "east");
  assert.equal(q.level, "presence"); assert.equal(c.level, "presence");
  assert.equal(c.total, 3 + 1); assert.equal(q.total, 3);
  setInf(st, "linzi", 0, 3);
  [q, c] = E.regionTally(st, "east");
  assert.equal(c.level, "domination"); assert.equal(c.total, 6 + 2);
  for (const id of ["jimo", "ju"]) setInf(st, id, 0, 3);
  [q, c] = E.regionTally(st, "east");
  assert.equal(c.level, "control"); assert.equal(c.total, 8 + 2); assert.equal(q.level, "none");
  E.addEffect(st, { card: "chumieyue", side: CHU, kind: "score", region: "south", who: CHU, delta: 1, until: "game" });
  const [, s] = E.regionTally(st, "south");
  assert.equal(s.bonus, 1 + 1, "郢 plus 楚滅越");
  E.scoreRegion(st, "east");
  assert.equal(st.mandate, -10);
});

test("the Mandate at 20 ends the game at once", () => {
  const st = atAction();
  st.mandate = 18;
  E.vp(st, QIN, 3);
  assert.equal(st.winner, QIN); assert.equal(st.reason, "mandate");
});

// ---------- reform ----------
test("reform: threshold by the next box, one advance a turn until 廢井田, first-arrival points, 稱帝 recovers", () => {
  const st = atAction([["shangyang", "ximu", "keqing"], []]);
  assert.equal(E.reformThreshold(st, QIN), 2);
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: "ximu", use: "reform" }), /below the threshold/);
  let a = E.apply(st, { type: "play", side: QIN, card: "shangyang", use: "reform" });
  assert.equal(a.reform[QIN], 1); assert.equal(a.mandate, 1);
  assert.ok(a.discard.includes("shangyang"), "used for reform, the card is not removed");
  assert.equal(E.reformUsesLeft(a, QIN), 0);
  a.actor = QIN; a.plan = [];
  assert.throws(() => E.apply(a, { type: "play", side: QIN, card: "keqing", use: "reform" }), /no advances left/);
  a.reform = [2, 0]; a.reformUsed = [1, 0];
  assert.equal(E.reformUsesLeft(a, QIN), 1, "廢井田 allows two a turn");
  const b = atAction();
  b.reform = [5, 5]; b.reformFirst = { 1: QIN, 2: QIN, 3: QIN, 4: QIN, 5: QIN }; b.weariness = 3;
  E.reformAdvance(b, CHU, 1);
  assert.equal(b.mandate, -3); assert.equal(b.weariness, 4, "稱帝 recovers one box");
  E.reformAdvance(b, QIN, 1);
  assert.equal(b.mandate, -2, "second arrival at 稱帝 pays 1");
  E.reformAdvance(b, QIN, 1);
  assert.equal(b.reform[QIN], 6, "the track ends at 6");
});

test("明法令: at the end of the turn its holder may discard one card without its event", () => {
  const st = atAction([["hexi", "keqing"], []], { round: 6, rounds: 6, actor: CHU, phasing: CHU });
  st.reform = [5, 0];
  st.plan = [{ do: "endAction" }];
  const a = E.run(st);
  assert.equal(a.pending.kind, "card"); assert.equal(a.pending.who, QIN); assert.equal(a.pending.min, 0);
  const b = E.apply(a, { type: "choose", side: QIN, choice: ["hexi"] });
  assert.ok(b.discard.includes("hexi")); assert.ok(!b.removed.includes("hexi"));
  assert.equal(b.turn, 2);
});

// ---------- the Nine Cauldrons ----------
test("九鼎: 4 ops, 5 when all of it lands in the Three Jin or Zhou, then face down with the other side until next turn", () => {
  const st = atAction([["hexi"], ["mozhe"]]);
  st.jiuding = { holder: QIN, faceDown: false };
  assert.ok(E.legal(st, QIN).jiuding);
  const a = E.apply(st, { type: "play", side: QIN, card: JIUDING, use: "place", points: ["yiyang", "yiyang", "shangdang", "shangdang", "hedong"] });
  assert.deepEqual(inf(a, "shangdang"), [2, 0]);
  assert.deepEqual(a.jiuding, { holder: CHU, faceDown: true });
  assert.ok(!E.jiudingUsable(a, CHU));
  assert.throws(() => E.apply(st, { type: "play", side: QIN, card: JIUDING, use: "place", points: ["yiyang", "yiyang", "shangdang", "shangdang", "guanzhong"] }), /not enough ops/);
  assert.throws(() => E.apply(Object.assign(st, { phase: "headline" }), { type: "headline", side: QIN, card: JIUDING }), /may not be headlined/);
});

// ---------- headline ----------
test("headline: higher ops resolves first, ties to Qin, a scoring headline scores, then the action rounds begin", () => {
  const st = atAction([["shangyang", "keqing"], ["score_jin", "mozhe"]], { phase: "headline" });
  setInf(st, "shangdang", 0, 3);
  let a = E.apply(st, { type: "headline", side: QIN, card: "shangyang" });
  assert.equal(E.view(a, CHU).headline[QIN], "hidden");
  a = E.apply(a, { type: "headline", side: CHU, card: "score_jin" });
  assert.equal(a.phase, "action"); assert.equal(a.actor, QIN); assert.equal(a.round, 1);
  assert.equal(a.reform[QIN], 1, "商鞅 resolved");
  const score = a.log.find((l) => l.type === "score");
  assert.equal(score.region, "jin");
  assert.equal(a.mandate, 1 + (4 - (4 + 1)), "Qin +1 from 徙木, then Chu's presence with one battleground");
  const first = a.log.find((l) => l.type === "headline");
  assert.equal(first.first, QIN, "3 ops beats a scoring card's 0");
});

// ---------- turn end, eras, final scoring ----------
test("holding a scoring card at the end of the turn loses; both holding it goes to Chu", () => {
  const st = atAction([["score_east"], []], { round: 6, rounds: 6, actor: CHU, phasing: CHU });
  const a = E.run(Object.assign(st, { plan: [{ do: "endAction" }] }));
  assert.equal(a.winner, CHU); assert.equal(a.reason, "scoring");
  const st2 = atAction([["score_east"], ["score_jin"]], { round: 6, rounds: 6, actor: CHU, phasing: CHU });
  const b = E.run(Object.assign(st2, { plan: [{ do: "endAction" }] }));
  assert.equal(b.winner, CHU); assert.equal(b.reason, "scoringBoth");
});

test("turn end: 洛邑 pays its controller, turn effects expire, hands refill to the era's size, later eras shuffle in", () => {
  const st = atAction([[], []], { round: 6, rounds: 6, actor: CHU, phasing: CHU });
  setInf(st, "luoyi", 3, 0);
  E.addEffect(st, { card: "yetie", side: QIN, kind: "campaign", who: QIN, delta: 1, regions: null, until: "turn" });
  E.addEffect(st, { card: "baiqi", side: QIN, kind: "campaign", who: QIN, delta: 1, regions: ["jin"], until: "game" });
  const before = st.draw.length + st.discard.length;
  const a = E.run(Object.assign(st, { plan: [{ do: "endAction" }] }));
  assert.equal(a.mandate, 1);
  assert.deepEqual(a.effects.map((e) => e.card), ["baiqi"]);
  assert.equal(a.turn, 2); assert.equal(a.phase, "headline");
  assert.equal(a.hands[0].length, 8); assert.equal(a.hands[1].length, 8);
  assert.equal(a.draw.length + a.discard.length + 16, before);
  // Straight to turn 4: the alliance deck joins the pile, hands grow to 9.
  const b = atAction([[], []], { turn: 3, round: 6, rounds: 6, actor: CHU, phasing: CHU });
  const pile = b.draw.length + b.discard.length;
  const c = E.run(Object.assign(b, { plan: [{ do: "endAction" }] }));
  assert.equal(c.era, "alliance"); assert.equal(c.rounds, 7);
  assert.equal(c.hands[0].length, 9);
  assert.equal(c.draw.length + c.discard.length + 18, pile + 24);
  assert.equal(c.later.alliance, undefined);
});

test("after turn 8 every region scores once; the Mandate decides, a tie goes to Chu", () => {
  const st = atAction([[], []], { turn: 8, era: "conquest", round: 7, rounds: 7, actor: CHU, phasing: CHU });
  st.later = {};
  const a = E.run(Object.assign(E.clone(st), { plan: [{ do: "endAction" }] }));
  assert.ok(a.winner != null); assert.equal(a.log.filter((l) => l.type === "score").length, 5);
  // Wipe the board: nothing scores, 0 to 0, Chu wins the tie.
  const b = E.clone(st); b.inf = {};
  const c = E.run(Object.assign(b, { plan: [{ do: "endAction" }] }));
  assert.equal(c.winner, CHU); assert.equal(c.reason, "tie");
});

// ---------- playing the other side's card ----------
test("an enemy card played for ops triggers its event; ops-first takes the payload now, event-first asks afterwards; * cards leave the game", () => {
  const st = atAction([["suqin"], ["mozhe"]]);
  const a = E.apply(st, { type: "play", side: QIN, card: "suqin", use: "place", order: "opsFirst", points: ["yiyang", "yiyang", "hedong", "hedong"] });
  assert.deepEqual(inf(a, "linzi"), [0, 1], "蘇秦 put Chu in every capital");
  assert.ok(a.removed.includes("suqin"));
  assert.equal(a.actor, CHU);
  const st2 = atAction([["hexi"], ["yueyi", "mozhe"]], { actor: CHU, phasing: CHU });
  setInf(st2, "linzi", 0, 3);
  const b = E.apply(st2, { type: "play", side: CHU, card: "yueyi", use: "place", order: "eventFirst" });
  assert.deepEqual(inf(b, "linzi"), [0, 1], "樂毅 struck first");
  assert.equal(b.pending.kind, "ops"); assert.equal(b.pending.who, CHU); assert.equal(b.pending.ops, 3);
  const c = E.apply(b, { type: "choose", side: CHU, choice: { use: "place", points: ["linzi", "linzi", "song"] } });
  assert.deepEqual(inf(c, "linzi"), [0, 3]);
  assert.equal(c.pending, null); assert.equal(c.actor, QIN);
});

test("說客 pairs with an enemy card: its ops, no event, both cards discarded", () => {
  const st = atAction([["shuoke", "suqin"], []]);
  const a = E.apply(st, { type: "play", side: QIN, card: "shuoke", pair: "suqin", use: "place", points: ["yiyang", "yiyang", "hedong", "hedong"] });
  assert.deepEqual(inf(a, "linzi"), [0, 0]);
  assert.ok(a.discard.includes("shuoke") && a.discard.includes("suqin"));
  assert.equal(a.hands[0].length, 0);
});

test("細作 names the card the other side must play next; 頓兵堅城 costs an action and a 2+ ops card", () => {
  const st = atAction([["xizuo"], ["wuqi", "mozhe"]]);
  let a = E.apply(st, { type: "play", side: QIN, card: "xizuo", use: "event" });
  assert.equal(a.pending.kind, "card"); assert.ok(a.pending.showHand);
  assert.deepEqual(E.view(a, QIN).hands[CHU], ["wuqi", "mozhe"], "the hand is shown while choosing");
  a = E.apply(a, { type: "choose", side: QIN, choice: ["wuqi"] });
  assert.equal(a.forced[CHU], "wuqi");
  assert.deepEqual(E.legal(a, CHU).cards.map((c) => c.id), ["wuqi"]);
  assert.throws(() => E.apply(a, { type: "play", side: CHU, card: "mozhe", use: "event" }), /must play the named card/);
  const st2 = atAction([["dunbing", "hexi"], ["wuqi", "mozhe"]]);
  let b = E.apply(st2, { type: "play", side: QIN, card: "dunbing", use: "event" });
  assert.deepEqual(E.legal(b, CHU).bog, ["wuqi"]);
  assert.throws(() => E.apply(b, { type: "play", side: CHU, card: "mozhe", use: "event" }), /頓兵堅城/);
  b = E.apply(b, { type: "play", side: CHU, card: "wuqi", use: "bog" });
  assert.ok(b.discard.includes("wuqi")); assert.equal(b.reform[CHU], 0, "no event");
  assert.equal(b.effects.length, 0); assert.equal(b.actor, QIN);
});

test("event draws skip scoring cards; 春申君 draws two and discards one", () => {
  const st = atAction([[], ["chunshenjun"]], { actor: CHU, phasing: CHU });
  st.draw = ["score_jin", "keqing", "hexi", "score_east"]; // top is the end of the array
  let a = E.apply(st, { type: "play", side: CHU, card: "chunshenjun", use: "event" });
  assert.equal(a.pending.kind, "card");
  assert.equal(a.hands[CHU].length, 2);
  assert.ok(a.hands[CHU].every((c) => !E.CARD[c].scoring));
  a = E.apply(a, { type: "choose", side: CHU, choice: [a.hands[CHU][0]] });
  assert.equal(a.hands[CHU].length, 1);
  assert.ok(a.discard.includes("chunshenjun"), "not a * card");
});

test("秦滅周 pays 3 with 洛邑, ends its income, and hands the cauldrons to Qin face up", () => {
  const st = atAction([["miezhou"], []]);
  setInf(st, "luoyi", 3, 0);
  const a = E.apply(st, { type: "play", side: QIN, card: "miezhou", use: "event" });
  assert.equal(a.mandate, 3); assert.equal(a.luoyiYields, false);
  assert.deepEqual(a.jiuding, { holder: QIN, faceDown: false });
});

test("the view hides the other hand and the draw order; 完璧歸趙 reveals Qin's hand to Chu", () => {
  const st = atAction([["hexi"], ["wanbi"]]);
  const v = E.view(st, CHU);
  assert.equal(v.hands[QIN], null); assert.deepEqual(v.handCounts, [1, 1]);
  assert.equal(v.draw, undefined); assert.equal(typeof v.drawCount, "number"); assert.equal(v.rngState, undefined);
  st.actor = CHU; st.phasing = CHU;
  const a = E.apply(st, { type: "play", side: CHU, card: "wanbi", use: "event" });
  assert.deepEqual(E.view(a, CHU).hands[QIN], ["hexi"]);
  assert.equal(E.view(a, QIN).hands[CHU], null);
});

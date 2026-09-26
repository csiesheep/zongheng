// #123 (owner, with a screenshot of a lost game): as Chu at 民困 (weariness
// 2), 楚懷王入秦 (a Qin card) was played for 扶植 (ops); its event -- which
// fires for any use of an enemy card, place/campaign/lobby included -- pushed
// weariness to 土崩 and Chu (the acting player) lost at once. The rule is
// right (rulebook 五 / TS 8.1.3: the acting player answers for weariness even
// through the opponent's event) but nothing warned the player, and the
// engine had no way for the UI to ask "would this collapse it?" ahead of
// time other than reading the card's text by hand. This file pins the two
// things #123 adds to close that gap: `E.actionWouldCollapse`/
// `E.eventWouldCollapse` (a real simulation, not a card-text lookup) and the
// bots/advisor never choosing a self-collapsing play while a safe one sits
// in hand -- 變法 here, always.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { decide } from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";

// Reproduces the owner's board shape: Chu to act at 民困 (weariness 2) with
// 楚懷王入秦 (huaiwang, a Qin card, ops 2, qualifies for 變法 at reform box 0)
// in hand. Everything else about the state is whatever createGame(1) landed
// on turn 1's first action round -- the collapse only depends on weariness
// and the card, not on the board around it.
function ownerCase() {
  let st = E.createGame(1);
  let guard = 0;
  while (st.phase !== "action" && guard++ < 50) {
    const who = E.mustAct(st);
    if (!who.length) break;
    if (st.phase === "headline") {
      st = E.apply(st, { type: "headline", side: who[0], card: st.hands[who[0]].find((c) => c !== E.JIUDING) ?? null });
      continue;
    }
    break;
  }
  st.weariness = 2; // 民困
  st.actor = E.CHU;
  st.phase = "action";
  st.pending = null;
  st.plan = [];
  for (const s of [E.QIN, E.CHU]) st.hands[s] = st.hands[s].filter((c) => c !== "huaiwang");
  st.draw = st.draw.filter((c) => c !== "huaiwang");
  st.discard = st.discard.filter((c) => c !== "huaiwang");
  st.removed = st.removed.filter((c) => c !== "huaiwang");
  st.hands[E.CHU].push("huaiwang");
  st.forced[E.CHU] = null;
  return st;
}

test("#123: playing 楚懷王入秦's event for ops at 民困 really does collapse the realm on the acting player (sanity: the rule itself, not the new check)", () => {
  const st = ownerCase();
  let s = E.apply(st, { type: "play", side: E.CHU, card: "huaiwang", use: "place", order: "opsFirst", points: [] });
  for (let guard = 0; s.pending && guard++ < 10; ) {
    s = E.apply(s, { type: "choose", side: s.pending.who, choice: (s.pending.options || []).slice(0, s.pending.min || 0) });
  }
  assert.equal(s.winner, E.QIN); // Chu (the phasing/acting side) loses
  assert.equal(s.reason, "collapse");
  assert.equal(s.weariness, 1);
});

test("#123: E.eventWouldCollapse says so BEFORE the card is played, from a simulation, without mutating the real state", () => {
  const st = ownerCase();
  const before = JSON.stringify(st);
  assert.equal(E.eventWouldCollapse(st, E.CHU, "huaiwang"), true);
  assert.equal(JSON.stringify(st), before, "must not mutate the state it was handed");
});

test("#123: every use that fires 楚懷王入秦's event reads as collapsing -- 扶植 (place) and 事件 itself, either order", () => {
  const st = ownerCase();
  assert.equal(E.actionWouldCollapse(st, E.CHU, { type: "play", side: E.CHU, card: "huaiwang", use: "event" }), true);
  assert.equal(E.actionWouldCollapse(st, E.CHU, { type: "play", side: E.CHU, card: "huaiwang", use: "place", order: "opsFirst", points: [] }), true);
});

test("#123: 變法 on the same card never fires the event, and reads as safe", () => {
  const st = ownerCase();
  assert.equal(E.CARD.huaiwang.ops >= E.reformThreshold(st, E.CHU), true, "test setup: huaiwang must actually qualify for reform here");
  assert.equal(E.actionWouldCollapse(st, E.CHU, { type: "play", side: E.CHU, card: "huaiwang", use: "reform" }), false);
});

test("#123: a raid on a battleground that would ALSO push weariness to 土崩 reads as collapsing, even when the card itself is Chu's own (no event involved)", () => {
  // A Chu-owned card raiding a battleground while already at 民困: locked out
  // by campaignLocked() as a normal move (the UI would never offer the
  // target), but the check itself is asked here directly, as a raid
  // confirm's own preview would -- it must not blindly say "safe" just
  // because no card event is involved.
  const st = ownerCase();
  const ownCard = st.hands[E.CHU].find((c) => E.CARD[c].side === E.CHU);
  assert.ok(ownCard, "test setup: Chu needs an own card in hand");
  const bg = E.SPACES.find((s) => s.battleground && E.infOf(st, s.id)[E.QIN] > 0);
  assert.ok(bg, "test setup: needs a battleground with Qin influence to raid");
  assert.equal(
    E.actionWouldCollapse(st, E.CHU, { type: "play", side: E.CHU, card: ownCard, use: "campaign", target: bg.id }),
    true,
  );
});

test("#123: actionWouldCollapse never throws and reads \"safe\" for a bad/illegal action", () => {
  const st = ownerCase();
  assert.equal(E.actionWouldCollapse(st, E.CHU, { type: "play", side: E.CHU, card: "no-such-card", use: "event" }), false);
  assert.equal(E.actionWouldCollapse(st, E.CHU, { type: "nonsense" }), false);
});

test("#123: the advisor never recommends 楚懷王入秦's event/ops while 變法 (or anything else) is legal, across many rng seeds", () => {
  const st = ownerCase();
  const view = E.view(st, E.CHU);
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = advise(view, E.CHU, E.makeRng(seed));
    if (!a) continue;
    checked++;
    assert.equal(E.actionWouldCollapse(st, E.CHU, a.action), false, `advisor suggested a self-collapsing play: ${JSON.stringify(a.action)}`);
  }
  assert.ok(checked > 0, "test setup: the advisor must actually answer for this position");
});

test("#123: normal and hard bots never choose 楚懷王入秦's event/ops here while 變法 is legal, across many rng seeds", () => {
  const st = ownerCase();
  const view = E.view(st, E.CHU);
  for (const level of ["normal", "hard"]) {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const a = decide(view, E.CHU, level, E.makeRng(seed * 97 + 1));
      if (!a) continue;
      checked++;
      assert.equal(E.actionWouldCollapse(st, E.CHU, a), false, `${level} bot chose a self-collapsing play: ${JSON.stringify(a)}`);
    }
    assert.ok(checked > 0, `test setup: the ${level} bot must actually answer for this position`);
  }
});

test("#123: the easy (random) bot also never chooses a self-collapsing play here while anything else is legal, across many rng seeds", () => {
  const st = ownerCase();
  for (let seed = 1; seed <= 60; seed++) {
    const a = decide(E.view(st, E.CHU), E.CHU, "easy", E.makeRng(seed * 131 + 1));
    if (!a) continue;
    assert.equal(E.actionWouldCollapse(st, E.CHU, a), false, `easy bot chose a self-collapsing play: ${JSON.stringify(a)}`);
  }
});

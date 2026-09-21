// Guard for #73 (orchestrator-owned). An opponent's card played for its ops (place / campaign / lobby) must say which comes
// first, its ops or its event. The owner ruled that the player chooses (#71); the engine used to treat a missing `order` as
// ops first, so an old client, a bug or a hand-made room message could skip the choice silently.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { decide } from "../public/shared/bots.js";

function findEnemyPlay() {
  for (let seed = 1; seed < 60; seed++) {
    let st = E.createGame(seed);
    for (let n = 0; n < 2000 && st.winner == null; n++) {
      let moved = false;
      for (const s of [0, 1]) {
        const L = E.legal(st, s);
        if (!L || !["action", "headline", "pending"].includes(L.kind)) continue;
        const act = decide(E.view(st, s), s, "normal", E.makeRng(seed * 1000 + n));
        if (!act) continue;
        const card = act.type === "play" ? E.CARD[act.card] : null;
        if (card && card.side != null && card.side !== s && !act.pair && ["place", "campaign", "lobby"].includes(act.use) && act.order === "opsFirst") return { st, act: { ...act, side: s } };
        st = E.apply(st, { ...act, side: s }); moved = true; break;
      }
      if (!moved) break;
    }
  }
  return null;
}

test("an opponent's card played for ops without an order is refused; with either order it goes through", () => {
  const found = findEnemyPlay();
  assert.ok(found, "no enemy-card ops play found in 60 seeds");
  const { st, act } = found;
  assert.doesNotThrow(() => E.apply(st, act), "ops first must still work");
  assert.doesNotThrow(() => E.apply(st, { type: "play", side: act.side, card: act.card, use: act.use, order: "eventFirst" }), "event first must still work");
  const { order, ...noOrder } = act;
  assert.throws(() => E.apply(st, noOrder), "no order: refused");
  assert.throws(() => E.apply(st, { ...act, order: null }), "order null: refused");
  assert.throws(() => E.apply(st, { ...act, order: "sideways" }), "an unknown order: refused");
});

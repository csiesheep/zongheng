// #131: `view()` no longer carries the seed, and the advisor seeded its own rng
// with it (advisor.js `stableRng`: `view.seed ?? 0`) so that the advice does
// not flicker between renders. Without the seed the rest of the mix (turn,
// round, actor, side, phase, logSeq, pending, hand size) must still give the
// same advice for the same position: asked twice, and asked on a view that
// came through JSON the way a room's view does.
//
// Not a red-first test: this was stable on main as well (the seed is constant
// within a game). It pins that dropping the seed did not make it unstable.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { advise } from "../public/shared/advisor.js";
import { playRandomGame } from "./driver.js";

const POSITIONS = 12;

test("#131: without the seed, the same position gets the same advice", () => {
  let n = 0;
  for (let seed = 1; seed <= 3 && n < POSITIONS; seed++) {
    let k = 0;
    playRandomGame(seed, {}, {
      onStep: (s) => {
        if (n >= POSITIONS || s.winner != null || k++ % 15) return;
        for (const side of E.mustAct(s)) {
          const v = E.view(s, side);
          assert.equal(v.seed, undefined, "the view is seedless");
          const wire = JSON.parse(JSON.stringify(E.view(E.clone(s), side)));
          const a = advise(v, side);
          assert.ok(a, `seed ${seed} t${s.turn} ${s.phase}: some advice`);
          assert.deepEqual(advise(v, side), a, `seed ${seed} t${s.turn} ${s.phase}: asked twice`);
          assert.deepEqual(advise(wire, side), a, `seed ${seed} t${s.turn} ${s.phase}: asked on the view as sent`);
          n++;
        }
      },
    });
  }
  assert.ok(n >= POSITIONS, `only ${n} positions checked`);
});

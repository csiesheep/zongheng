// Guard for the seal-progress marks (orchestrator-owned, #89). Owner, 2026-09-21: 楚 controlled four capitals but 相印 read
// 2/4, because a seal needs Chu's control of the capital AND a full stack there (stability + options.cap). The map now
// shows the progress; public/seal-progress.js computes it without a DOM, so this pins the numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { sealProgress } from "../public/seal-progress.js";

function ownerState() {
  const st = E.createGame(1);
  st.inf = {
    xinzheng: [1, 4], // Han: Chu controls, 4 of cap 4 -> sealed
    handan: [2, 4],   // Zhao: Chu controls, 4 of 4 -> sealed
    daliang: [0, 3],  // Wei: Chu controls, 3 of 4 -> one short
    linzi: [1, 4],    // Qi: Chu controls, 4 of cap 5 -> one short
    ji: [0, 0],       // Yan: nobody
  };
  st.seals = { han: true, zhao: true };
  return st;
}

test("each state's capital: who controls it, Chu's stack against the cap, and the seal", () => {
  const p = sealProgress(ownerState());
  assert.deepEqual(Object.keys(p).sort(), ["han", "qi", "wei", "yan", "zhao"]);
  assert.deepEqual(p.han, { capital: "xinzheng", chuControls: true, have: 4, need: 4, sealed: true });
  assert.deepEqual(p.zhao, { capital: "handan", chuControls: true, have: 4, need: 4, sealed: true });
  assert.deepEqual(p.wei, { capital: "daliang", chuControls: true, have: 3, need: 4, sealed: false });
  assert.deepEqual(p.qi, { capital: "linzi", chuControls: true, have: 4, need: 5, sealed: false });
  assert.deepEqual(p.yan, { capital: "ji", chuControls: false, have: 0, need: 5, sealed: false });
});

test("need follows the rule options: stability + cap, and never throws on odd input", () => {
  const st = ownerState();
  st.options = { ...st.options, cap: 3 };
  assert.equal(sealProgress(st).wei.need, 5, "Daliang stability 2 + cap 3");
  assert.doesNotThrow(() => sealProgress(null));
  assert.deepEqual(sealProgress(null), {});
});

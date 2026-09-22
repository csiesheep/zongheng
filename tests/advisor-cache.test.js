// Pins the #99 item 7 fix (the advisor banner sometimes showed the previous
// move's text) against the two hypotheses the brief named:
//   (a) two different pending questions for the same actor, same hand, same
//       turn/round/logSeq gave the SAME fingerprint, so the second
//       question's render reused the first question's cached answer;
//   (b) an advise() answer that started computing for an OLDER position
//       arrives (async) after a NEWER render has moved the cache on, and
//       gets written to the banner anyway.
// public/advisor-cache.js is the DOM-free split of advisor-ui.js's caching
// core specifically so these can be tested without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { advise } from "../public/shared/advisor.js";
import { fingerprint, StaleGuard, AdvisorCache } from "../public/advisor-cache.js";

const { QIN, CHU } = E;

function drainAllExcept(st, keepGoing) {
  while (st.pending && keepGoing(st.pending)) {
    const p = st.pending;
    if (p.kind === "points") st = E.apply(st, { type: "choose", side: p.who, choice: p.options.slice(0, p.min) });
    else if (p.kind === "card") st = E.apply(st, { type: "choose", side: p.who, choice: p.min === 0 ? [] : [p.options[0]] });
    else if (p.kind === "option") st = E.apply(st, { type: "choose", side: p.who, choice: p.options[0].id });
    else if (p.kind === "ops") st = E.apply(st, { type: "choose", side: p.who, choice: { use: p.allowed[0], points: [], target: null } });
    else break;
  }
  return st;
}

// Reaches the exact repro from the issue: 遠交近攻 (yuanjiao, shared/cards.js)
// is a Qin card whose effect() asks Qin for a space TWICE in a row -- first
// in east/north, then in the Three Jin -- with no log() call in between (see
// engine.js's "event" case in exec(), and choose(), which never logs). Turn,
// round, actor, phasing, phase, side, logSeq and hand are identical across
// the two asks; only view.pending differs.
function twoStagePendingPair() {
  let st = E.createGame(1);
  st = drainAllExcept(st, () => true);
  st.hands[QIN] = ["yuanjiao", ...st.hands[QIN].slice(1)];
  st = E.apply(st, { type: "headline", side: QIN, card: st.hands[QIN].find((c) => c !== "yuanjiao") || st.hands[QIN][1] });
  st = drainAllExcept(st, () => true);
  st = E.apply(st, { type: "headline", side: CHU, card: st.hands[CHU][0] });
  st = drainAllExcept(st, () => true);
  if (st.actor !== QIN) {
    const L = E.legal(st, CHU);
    st = E.apply(st, { type: "play", side: CHU, card: L.cards[0].id, use: "event" });
    st = drainAllExcept(st, () => true);
  }
  st = E.apply(st, { type: "play", side: QIN, card: "yuanjiao", use: "event" });
  const view1 = E.view(st, QIN);
  const pending1 = st.pending;
  assert.equal(pending1.who, QIN, "sanity: the same side answers the first ask");
  const afterFirst = E.apply(st, { type: "choose", side: QIN, choice: [pending1.options[0]] });
  const view2 = E.view(afterFirst, QIN);
  const pending2 = afterFirst.pending;
  assert.equal(pending2.who, QIN, "sanity: the same side answers the second ask, per the brief");
  assert.notDeepEqual(pending1.options, pending2.options, "sanity: the two asks are genuinely different questions");
  return { view1, view2 };
}

test("(a) two same-side pending questions with identical turn/round/actor/phase/logSeq/hand still get different fingerprints", () => {
  const { view1, view2 } = twoStagePendingPair();
  // Confirm the sanity condition the whole bug depends on: everything BUT
  // pending is identical between the two views.
  for (const key of ["turn", "round", "actor", "phasing", "phase", "logSeq"]) {
    assert.equal(view1[key], view2[key], `expected ${key} to stay the same across the two asks (that's the whole bug)`);
  }
  assert.deepEqual(view1.hands[QIN], view2.hands[QIN], "expected the hand to stay the same (yuanjiao doesn't touch it while the event resolves)");
  assert.notEqual(fingerprint(view1, QIN), fingerprint(view2, QIN),
    "fingerprint() must tell these two pending questions apart, or the second one's render will reuse the first one's cached answer");
});

test("(a) advise() actually answers the two questions differently (so a collision is a real, not cosmetic, bug)", () => {
  const { view1, view2 } = twoStagePendingPair();
  const adv1 = advise(view1, QIN);
  const adv2 = advise(view2, QIN);
  assert.ok(adv1 && adv2, "advise() should answer both pending questions");
  assert.notDeepEqual(adv1.targets, adv2.targets, "the two questions have different correct answers");
});

test("(a) AdvisorCache: the second question is a cache MISS, not a hit reusing the first answer", () => {
  const { view1, view2 } = twoStagePendingPair();
  const cache = new AdvisorCache();
  const { hit: hit1, token: token1 } = cache.begin(view1, QIN);
  assert.equal(hit1, false, "first render of a fresh position is always a miss");
  const adv1 = advise(view1, QIN);
  assert.ok(cache.accept(token1, adv1));
  // Second, genuinely different question -- must NOT reuse cache.adv (adv1).
  const { hit: hit2 } = cache.begin(view2, QIN);
  assert.equal(hit2, false, "a fingerprint collision would show this as a (wrong) cache hit here");
  assert.equal(cache.hasResult, false, "begin() on a miss must clear hasResult so the caller knows to recompute, not paint the stale adv1 as final");
});

test("(b) StaleGuard: starting a newer computation invalidates any token handed out before it", () => {
  const guard = new StaleGuard();
  const older = guard.start();
  const newer = guard.start();
  assert.equal(guard.isCurrent(newer), true);
  assert.equal(guard.isCurrent(older), false, "an older in-flight computation must never look current once a newer one has started");
});

test("(b) AdvisorCache.accept(): an answer for an older, superseded position is dropped and never reaches cache.adv", () => {
  const cache = new AdvisorCache();
  const { view1, view2 } = twoStagePendingPair();
  const { token: tokenOld } = cache.begin(view1, QIN); // advise(view1) "starts computing" (slow, in the real code an async setTimeout)
  // Before that resolves, a NEWER render happens (the position moved on).
  const { token: tokenNew } = cache.begin(view2, QIN);
  const advOld = advise(view1, QIN);
  const advNew = advise(view2, QIN);
  // The OLD computation finally resolves, after the NEW one already started.
  const acceptedOld = cache.accept(tokenOld, advOld);
  assert.equal(acceptedOld, false, "an answer for the superseded position must be rejected");
  assert.notDeepEqual(cache.adv, advOld, "the superseded answer must never be written into the cache/banner");
  // The new computation resolves normally.
  const acceptedNew = cache.accept(tokenNew, advNew);
  assert.equal(acceptedNew, true);
  assert.deepEqual(cache.adv, advNew);
});

// #99 follow-up investigation (owner's checker, round 2): does hypothesis
// (b) reproduce as a bug INDEPENDENT of (a), i.e. is there a real path where
// accept()'s own guard check is what's missing, rather than the fingerprint?
// Answer: no exploitable path was found. A cache HIT (AdvisorCache.begin()
// returning hit:true) can only happen once some earlier computation for that
// exact fingerprint has already resolved via accept() -- so by the time a
// hit occurs, there is never a still-open OLDER token left to protect
// against; nothing schedules a new computation on a hit, so nothing can go
// stale on that path. Every constructible interleaving of misses (including
// ones that share a fingerprint by collision) already bumps the guard at
// the moment each miss starts, which is the only moment a stale write could
// originate from. So the guard check in accept() is a correctness invariant
// worth pinning on its own (this test), but it was not, on inspection, an
// independent second cause of the reported bug -- (a)'s fingerprint
// collision is the whole story. This test shows the invariant IS load-
// bearing (turn the check into a no-op and it goes red) even though no
// pre-#99 code path was found that could exploit its absence.
test("(b) accept()'s guard check is load-bearing: removing it lets a stale answer overwrite a newer one", () => {
  class UnguardedCache extends AdvisorCache {
    accept(_token, adv) { this.adv = adv; this.hasResult = true; return true; } // no isCurrent() check
  }
  const cache = new UnguardedCache();
  const { view1, view2 } = twoStagePendingPair();
  const { token: tokenOld } = cache.begin(view1, QIN);
  const { token: tokenNew } = cache.begin(view2, QIN);
  const advOld = advise(view1, QIN);
  const advNew = advise(view2, QIN);
  cache.accept(tokenNew, advNew); // the newer computation resolves first
  cache.accept(tokenOld, advOld); // then the stale one arrives late
  assert.deepEqual(cache.adv, advOld, "demonstrates the failure mode: without the guard, the stale answer wins the race");
  assert.notDeepEqual(cache.adv, advNew, "...and the correct, newer answer is the one that gets overwritten");
});

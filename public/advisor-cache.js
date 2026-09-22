// The pure, DOM-free core of advisor-ui.js's caching contract (#99 item 7):
// don't recompute advise() on every render (it can take real time), but
// never show an answer that doesn't belong to the position on screen right
// now. Split out on its own so both halves of that contract can be pinned
// directly in tests/, with no DOM: see tests/advisor-cache.test.js.
//
// Two hypotheses were both plausible causes of the reported bug (the banner
// still showing an earlier move's advice one action after it resolved):
//   (a) two different pending questions for the same actor, same hand,
//       same turn/round/logSeq collapsed onto the same cache entry, so the
//       second question's render reused the first question's answer.
//   (b) an advise() answer that started computing for an OLDER position
//       arrived (asynchronously) after a NEWER render had already moved
//       the cache on, and got written to the banner anyway.
// fingerprint() below is (a)'s fix; StaleGuard/AdvisorCache.accept() below
// is (b)'s -- they're independent, so each gets its own test.

// A fingerprint of everything advise()'s answer can depend on, EXCLUDING the
// player's own in-progress UI picks (which card sheet is open, which target
// is tentatively chosen) -- those change on almost every click, and none of
// them change what the best move is, so recomputing on every one of them
// would be wasted work and would flash "thinking" for no reason.
//
// #99 item 7: this used to fold `view.pending` down to a bare 0/1, on the
// theory that turn/round/actor/phase/logSeq/hand already changed whenever
// the position really moved on. That's true across a full action, but NOT
// within one -- engine.js's own event step (the "event" case in exec()) can
// call a card's effect() more than once for the SAME step, each time
// returning a fresh ask() with no log() in between (choose() itself never
// logs; see shared/cards.js's own two-stage effects, e.g. 質子交換/遠交近攻/
// 徙民實邊: the SAME side is asked twice in a row, with different options
// each time). Turn, round, actor, phasing, phase, side, logSeq and hand are
// ALL identical across those two asks -- only `pending` itself differs --
// so the old fingerprint collided and the second, genuinely different
// question reused the first one's cached answer. Confirmed with a direct
// repro (yuanjiao's two placement asks): identical old-fingerprint string,
// different advise() targets ("song" vs "daliang"). Serializing the pending
// object itself (kind/tag/card/who/options/...) instead of a boolean closes
// this -- it's small (at most a couple dozen space ids) and always plain
// data, since `view` is JSON-cloned by engine.js's own view().
export function fingerprint(view, side) {
  const hand = view && view.hands ? view.hands[side] : null;
  let pendingSig = "-";
  if (view?.pending) { try { pendingSig = JSON.stringify(view.pending); } catch { pendingSig = "1"; } }
  return [view?.turn, view?.round, view?.actor, view?.phasing, view?.phase, side,
    view?.logSeq || 0, pendingSig, hand ? hand.join(",") : "-",
    view?.winner].join("|");
}

// Guards a value that arrives asynchronously against staleness: only the
// most recently started computation may ever be accepted. `start()` is
// called SYNCHRONOUSLY on every decision (a cache hit, a cache miss, or the
// advisor going inactive) -- not only on a cache miss.
//
// Investigated as hypothesis (b) for #99 item 7 and NOT found independently
// exploitable: a hit can only happen once an earlier computation for that
// exact fingerprint has already resolved through accept(), so there is
// never a still-open older token left to protect against at the moment a
// hit occurs -- nothing schedules a new computation on a hit, so nothing on
// that path can go stale. (a)'s fingerprint collision is the whole story
// for the reported bug. This class (and accept()'s own check) is kept as a
// load-bearing correctness invariant regardless -- see
// tests/advisor-cache.test.js's own "accept()'s guard check is load-
// bearing" test, which goes red the moment the check is removed.
export class StaleGuard {
  constructor() { this.gen = 0; }
  start() { return ++this.gen; }
  isCurrent(token) { return token === this.gen; }
}

// The cache: decides hit/miss from the fingerprint, and only ever accepts a
// write for the generation token it handed out at the matching miss.
export class AdvisorCache {
  constructor() {
    this.fp = null;
    this.adv = null;
    this.hasResult = false;
    this.guard = new StaleGuard();
  }
  // Call synchronously on every decision. `force` (the advisor switch's own
  // click) always treats it as a miss, even if the position hasn't moved,
  // so toggling on/off always shows the true current answer. Returns
  // { hit, token }: on a hit, `this.adv`/`this.hasResult` are already the
  // right answer for `view`. On a miss, the caller must schedule advise()
  // and later call accept(token, ...) with the SAME token -- never write
  // an answer straight into the banner without going through accept().
  begin(view, side, force = false) {
    const token = this.guard.start();
    const fp = fingerprint(view, side);
    const hit = !force && this.fp === fp && this.hasResult;
    if (!hit) { this.fp = fp; this.hasResult = false; }
    return { hit, token, fp };
  }
  // Call from the async advise() callback. Returns false when a newer
  // begin() has happened since `token` was handed out -- the caller must
  // drop `adv` on the floor and never paint it: an old answer arriving late
  // must never reach the banner just because nothing else has replaced it
  // in the DOM yet.
  accept(token, adv) {
    if (!this.guard.isCurrent(token)) return false;
    this.adv = adv;
    this.hasResult = true;
    return true;
  }
}

// 軍師, the advisor. One call, `advise(view, side, rng?)`, answering the three
// questions the advisor panel asks in order: which card, what to do with it,
// where to click -- plus a "why" that is a number, not a sentence.
//
// Two things it deliberately does NOT do.
//
// It does not evaluate anything of its own. The hand it points at is whatever
// `decide(view, side, "hard", rng)` returns: the advisor hands the caller's rng
// straight to the bot, so `advise(v, s, rng).action` is bit for bit the move
// the hard bot would have played from the same rng state. If the bot changes,
// the advice changes with it, which is the point -- a coach that disagrees
// with the opponent is not coaching this game.
//
// It does not look at anything the player cannot see. The input is a `view`,
// the same one the seat is rendered from; the hidden cards are filled in by
// `determinize` exactly as the bot fills them, from a guess, not from the
// truth.
//
// The reason. `evaluate` can hand back its value split into named buckets
// (bots.js). The advisor takes those buckets for the position before the move
// and for the position after it has fully resolved, subtracts, and attributes
// each bucket's movement to one of the reason keys below; the largest positive
// contribution wins. So every reason is a real number of the same evaluation
// points the bot was maximising, and `best` is what is left when nothing moved
// enough to name.
import * as E from "./engine.js";
import { decide, determinize, evaluate, heldSinceRestore, simulate } from "./bots.js";

const { QIN, CHU, SPACE, SPACES, STATES, SCORED_REGIONS, CARD, JIUDING, REFORM } = E;

// The fixed set the copy is written against (issue #17; `bogDiscard` added
// 2026-09-19; `emperor` by #125, the win by 稱帝). `best` is the floor and is
// always available.
export const REASON_KEYS = [
  "takeControl", "breakControl", "battleground", "scoringSoon", "destroyState",
  "nearDestroy", "seal", "denySeal", "mandate", "reform", "dumpEnemyEvent",
  "mustPlayScoring", "avoidCollapse", "bogDiscard", "emperor", "best",
];
// `params` vocabulary, per key:
//   space    a board space id                  takeControl breakControl battleground best
//   state    a state id (韓魏趙齊燕)            destroyState nearDestroy seal denySeal
//   region   a region id                       scoringSoon mustPlayScoring + the space keys
//   card     a card id                         scoringSoon dumpEnemyEvent mustPlayScoring bogDiscard
//   perk     a 變法 perk id or null            reform
//   n        a count: spaces changed / markers held / spaces still to take /
//            the region's net / the Mandate swing / the 變法 box / rounds
//            left / cards left. Each key's `n` is whatever its line of copy
//            reads out (public/i18n/en.js, advisor.reasons).
//   need     points still needed on that road  nearDestroy seal denySeal destroyState
//   total    the Mandate after the move        mandate
//   weariness  the 疲敝 track after the move   avoidCollapse
const WIN_KEY = {
  unification: "destroyState", alliance: "seal", mandate: "mandate", final: "mandate",
  tie: "mandate", collapse: "avoidCollapse", scoring: "mustPlayScoring", scoringBoth: "mustPlayScoring",
  emperor: "emperor",
};

export function advise(view, side, rng) {
  if (!view || view.winner != null) return null;
  if (!Array.isArray(view.hands?.[side])) return null; // a spectator has nothing to be advised on
  const L = E.legal(view, side);
  if (!["action", "headline", "pending"].includes(L.kind)) return null;
  const r = rng ?? stableRng(view, side);
  const at = r.getState();
  const action = decide(view, side, "hard", r);
  if (!action) return null;
  // The same guess the bot just worked from: `decide` determinizes first, from
  // this rng state, so replaying it from `at` reproduces that exact position.
  const aux = E.makeRng(0);
  aux.setState(at);
  const st = determinize(view, side, aux);
  const targets = targetsOf(action);
  return {
    action,
    card: action.type === "choose" ? null : action.card,
    use: useOf(action),
    order: orderOf(action, side),
    // #117: 說客's own pairing choice (bots.js's candidate list already
    // builds paired place/campaign/lobby moves for it -- see its own
    // comment there) used to be dropped here, so the banner could only ever
    // say "play 說客", never name the enemy card it was paired with, even
    // when that pairing was the entire point of the recommended move.
    pair: action.type === "play" ? action.pair ?? null : null,
    targets,
    reason: reasonFor(st, action, side, aux, targets, L),
  };
}

// ---------- reading the action ----------
function targetsOf(action) {
  if (action.type === "play") return fromOps(action);
  if (action.type !== "choose") return []; // a headline names no space
  const c = action.choice;
  if (Array.isArray(c)) return c.filter((x) => SPACE[x]); // points; a card choice filters away
  if (c && typeof c === "object") return fromOps(c);
  return []; // an option choice
}
function fromOps(o) {
  if (o.use === "place") return Array.isArray(o.points) ? o.points.slice() : [];
  if (o.use === "campaign" || o.use === "lobby") return o.target ? [o.target] : [];
  return [];
}
function useOf(action) {
  if (action.type === "headline") return "headline";
  if (action.type !== "play") return null; // a pending choice is not a use
  if (action.card !== JIUDING && CARD[action.card]?.scoring) return "score";
  return action.use ?? null;
}
// Only an opponent's card played for its ops has an order to choose.
function orderOf(action, side) {
  if (action.type !== "play" || action.pair || action.card === JIUDING) return null;
  const card = CARD[action.card];
  if (!card || card.side == null || card.side === side) return null;
  if (!["place", "campaign", "lobby"].includes(action.use)) return null;
  return action.order === "eventFirst" ? "eventFirst" : "opsFirst";
}

// Without an rng the advice must not flicker between renders, so seed from the
// position itself: `logSeq` moves whenever the game moves.
function stableRng(view, side) {
  let h = 2166136261 ^ ((view.seed ?? 0) >>> 0);
  const mix = (n) => { h = Math.imul(h ^ (n >>> 0), 16777619); };
  const phases = { setup: 1, headline: 2, action: 3, over: 4 };
  for (const n of [view.turn, view.round, view.actor, side, phases[view.phase] ?? 0,
    view.logSeq || 0, view.pending ? 1 : 0, view.hands[side].length]) mix(n);
  return E.makeRng(h >>> 0);
}

// ---------- the reason ----------
function reasonFor(st, action, side, rng, targets, L) {
  // 頓兵堅城 leaves exactly one kind of move, so the rule is the reason; the
  // only judgement left is which card to let go, and that is what `card` says.
  if (action.type === "play" && action.use === "bog") {
    return { key: "bogDiscard", params: { card: action.card, n: (L.bog ?? []).length } };
  }
  // A headline sits face down until both are in, so everything the position
  // would say about how this turn resolves rests on a guess at the other
  // side's card. A guess is not a reason (orchestrator, #17).
  if (action.type === "headline") return floor(targets);
  let st1;
  try { st1 = simulate(st, action, rng); } catch { return floor(targets); }
  if (st1.winner != null) return st1.winner === side ? winReason(st1, side) : floor(targets);

  const t0 = {}, t1 = {};
  evaluate(st, side, t0);
  evaluate(st1, side, t1);
  const d = (k) => (t1[k] || 0) - (t0[k] || 0);
  const opp = 1 - side;

  // Playing the scoring card is not "getting the region ready": the region is
  // being scored right now. What it pays decides which it is -- a region that
  // pays says Mandate, a region that costs says the card simply had to go
  // before the turn ended (orchestrator, #17).
  if (useOf(action) === "score") {
    const region = CARD[action.card].scoring;
    const net = t1[`$net:${region}`] ?? 0;
    return net > 0
      ? { key: "mandate", params: { region, card: action.card, n: d("mandate"), total: st1.mandate } }
      : { key: "mustPlayScoring", params: { card: action.card, region, n: Math.max(0, st.rounds - st.round) } };
  }

  // Which spaces changed hands, by the engine's own control rule.
  const gained = [], broke = [];
  for (const sp of SPACES) {
    const a = E.controller(st, sp.id), b = E.controller(st1, sp.id);
    if (a === b) continue;
    if (b === side) gained.push(sp.id);
    else if (a === opp) broke.push(sp.id);
  }
  // A space changing hands outranks everything else that can be said about
  // the move, 要衝 included (orchestrator, #17): the region's whole movement,
  // control level and battleground bonus together, goes to the key that owns
  // the space that moved. `battleground` is then only for a move that aims at
  // a 要衝 without taking it.
  const scored = (ids) => [...new Set(ids.map((id) => SPACE[id].region))].filter((x) => SCORED_REGIONS.includes(x));
  const gainRegions = scored(gained);
  const breakRegions = scored(broke).filter((x) => !gainRegions.includes(x));
  const worth = (rs) => rs.reduce((a, x) => a + d(`region:${x}:base`) + d(`region:${x}:bg`), 0);
  const bgBonus = SCORED_REGIONS.reduce((a, x) => a + d(`region:${x}:bg`), 0);
  const name = (ids) => ids.find((id) => SPACE[id].battleground) ?? ids[0];

  const cand = [];
  const add = (key, value, params) => { if (value > 1e-9) cand.push({ key, value, params }); };
  const bgTargets = targets.filter((id) => SPACE[id].battleground);

  const mieFell = Object.keys(st1.mie).length < Object.keys(st.mie).length;
  if (gained.length) {
    const space = name(gained);
    let v = worth(gainRegions);
    if (gained.includes("luoyi")) v += d("luoyi"); // 洛邑 pays in Mandate, not in a region
    if (side === CHU && mieFell) v += d("mie"); // Chu back in the capital undoes a 滅
    add("takeControl", v, { space, region: SPACE[space].region, n: gained.length });
  }
  if (broke.length) {
    const space = name(broke);
    let v = worth(breakRegions);
    if (side === CHU && mieFell && !gained.length) v += d("mie");
    add("breakControl", v, { space, region: SPACE[space].region, n: broke.length });
  }
  if (!gained.length && !broke.length && bgTargets.length) {
    // Nothing changed hands, so the evaluation paid nothing for the 要衝
    // itself. It is still the one thing worth saying about where this lands,
    // so it stands just above `best` and below every real contribution.
    add("battleground", Math.max(1e-6, bgBonus),
      { space: bgTargets[0], region: SPACE[bgTargets[0]].region, n: bgTargets.length });
  }
  {
    let region = null, v = 0;
    for (const x of SCORED_REGIONS) {
      if (!st.hands[side].includes("score_" + x)) continue; // the player's own hand, not a guess
      if (d(`region:${x}:card`) > v) { v = d(`region:${x}:card`); region = x; }
    }
    if (region) add("scoringSoon", v, { region, card: "score_" + region, n: t1[`$net:${region}`] ?? 0 });
  }
  if (side === QIN) {
    const fresh = Object.keys(st1.mie).filter((id) => !st.mie[id]);
    if (fresh.length) {
      add("destroyState", d("mie"), { state: fresh[0], n: Object.keys(st1.mie).length, need: 0 });
    }
    // A state held whole since 田單復國 lifted its 滅 is on no road at all: it
    // falls again only to a new conquest (bots.js heldSinceRestore, the engine's own
    // condition), so it is never "{n} away from falling" (#122).
    let state = null, top = 0, sum = 0;
    for (const id of Object.keys(STATES)) {
      const dv = d(`mieRoad:${id}`);
      if (dv > 0 && !st1.mie[id] && !heldSinceRestore(st1, id)) { sum += dv; if (dv > top) { top = dv; state = id; } }
    }
    // 滅國 is every space of the state under Qin, so the distance the copy
    // reads out ("{state} is {n} away from falling") is spaces, not points;
    // `need` keeps the evaluation's own measure, which is in points.
    const short = state ? E.spacesOfState(state).filter((x) => E.controller(st1, x) !== QIN).length : 0;
    if (state && short <= 2) {
      add("nearDestroy", sum, { state, n: short, need: t1[`$mieNeed:${state}`] });
    }
  }
  {
    let state = null, top = 0, sum = 0;
    for (const id of Object.keys(STATES)) {
      const dv = d(`sealRoad:${id}`);
      if (dv > 0) { sum += dv; if (dv > top) { top = dv; state = id; } }
    }
    const fresh = Object.keys(st1.seals).filter((id) => !st.seals[id]);
    const lost = Object.keys(st.seals).filter((id) => !st1.seals[id]);
    const held = Object.keys(st1.seals).length;
    if (side === CHU && (fresh.length || state)) {
      const id = fresh[0] ?? state;
      add("seal", Math.max(0, d("seals")) + sum, { state: id, n: held, need: t1[`$sealNeed:${id}`] ?? 0 });
    }
    if (side === QIN && (lost.length || state)) {
      const id = lost[0] ?? state;
      add("denySeal", Math.max(0, d("seals")) + sum, { state: id, n: held, need: t1[`$sealNeed:${id}`] ?? 0 });
    }
  }
  add("mandate", d("mandate"), { n: d("mandate"), total: st1.mandate });
  if (st1.reform[side] > st.reform[side]) {
    const box = st1.reform[side];
    add("reform", d("reform"), { n: box, perk: REFORM[box - 1]?.perk ?? null });
  }
  {
    const played = action.type === "play" ? action.card : null;
    const paired = action.pair && CARD[action.pair]?.side === opp ? action.pair : null;
    const enemy = played && played !== JIUDING && CARD[played]?.side === opp;
    if (enemy || paired) {
      add("dumpEnemyEvent", d("enemyCards"), { card: paired ?? played, n: t1.$enemyCards ?? 0 });
    }
  }
  {
    const c = action.card;
    const dumped = c && c !== JIUDING && CARD[c]?.scoring ? c : null;
    add("mustPlayScoring", d("scoringPain"),
      { card: dumped, region: dumped ? CARD[dumped].scoring : null, n: Math.max(0, st.rounds - st.round) });
  }
  if (st.weariness <= 2 && st1.weariness >= st.weariness) {
    add("avoidCollapse", d("tiring"), { weariness: st1.weariness, n: t1.$tiring ?? 0 });
  }

  if (!cand.length) return floor(targets);
  cand.sort((a, b) => b.value - a.value);
  return { key: cand[0].key, params: cand[0].params };
}

// The move ends the game: the engine's own reason for the win is the reason.
function winReason(st1, side) {
  const key = WIN_KEY[st1.reason] ?? "best";
  const params = { n: 0, total: st1.mandate };
  if (key === "destroyState") {
    const ids = Object.keys(st1.mie);
    Object.assign(params, { state: ids[ids.length - 1] ?? null, n: ids.length, need: 0 });
  } else if (key === "seal") {
    const ids = Object.keys(st1.seals);
    Object.assign(params, { state: ids[ids.length - 1] ?? null, n: ids.length, need: 0 });
  } else if (key === "mandate") {
    params.n = Math.abs(st1.mandate);
  } else if (key === "avoidCollapse") {
    Object.assign(params, { weariness: st1.weariness, n: 0 });
  }
  return { key, params };
}

function floor(targets) {
  const space = targets[0] ?? null;
  return { key: "best", params: { space, region: space ? SPACE[space].region : null, n: targets.length } };
}

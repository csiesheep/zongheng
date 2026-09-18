// Turns `legal()` into one concrete random action. Used by the fuzz test and,
// until the bots exist, by the harness. Every action it returns must be
// accepted by `apply`; if it is not, that is an engine bug worth a test.
import * as E from "../public/shared/engine.js";

const pickOne = (arr, rng) => arr[rng.int(arr.length)];

// A legal sequence of placement points for `ops`, replayed on a copy so the
// cost per point tracks control as it changes.
export function randomPoints(st, side, ops, rng) {
  const trial = E.clone(st);
  const points = [];
  let left = ops;
  for (let i = 0; i < ops; i++) {
    const cands = E.SPACES.filter((s) => E.canPlaceAt(trial, side, s.id) && E.infOf(trial, s.id)[side] < E.capOf(trial, s.id) && E.placeCost(trial, side, s.id) <= left);
    if (!cands.length) break;
    const id = pickOne(cands, rng).id;
    left -= E.placeCost(trial, side, id);
    E.place(trial, side, id, 1);
    points.push(id);
    if (left <= 0) break;
  }
  return points;
}

export function randomOps(st, side, ops, allowed, rng) {
  const o = E.opsOptions(st, side);
  const uses = allowed.filter((u) => (u === "place" ? o.placeOptions.length : u === "campaign" ? o.campaignTargets.length : o.lobbyTargets.length) > 0);
  if (!uses.length) return null;
  const use = pickOne(uses, rng);
  if (use === "place") return { use, points: randomPoints(st, side, ops, rng) };
  if (use === "campaign") return { use, target: pickOne(o.campaignTargets, rng) };
  return { use, target: pickOne(o.lobbyTargets, rng).id };
}

export function randomChoice(st, p, rng) {
  switch (p.kind) {
    case "points": {
      const n = p.min + (p.n > p.min ? rng.int(p.n - p.min + 1) : 0);
      const counts = {}, out = [];
      const room = (id) => {
        let r = Infinity;
        if (p.distinct) r = Math.min(r, 1);
        if (p.maxPer) r = Math.min(r, p.maxPer);
        if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
        if (p.side != null) r = Math.min(r, E.capOf(st, id) - E.infOf(st, id)[p.side]);
        return r - (counts[id] || 0);
      };
      for (let i = 0; i < n; i++) {
        const cands = p.options.filter((id) => room(id) > 0);
        if (!cands.length) break;
        const id = pickOne(cands, rng);
        counts[id] = (counts[id] || 0) + 1;
        out.push(id);
      }
      return out;
    }
    case "card": {
      const n = (p.min ?? 1) + ((p.n ?? 1) > (p.min ?? 1) ? rng.int((p.n ?? 1) - (p.min ?? 1) + 1) : 0);
      const pool = p.options.slice(), out = [];
      while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
      return out;
    }
    case "option": return pickOne(p.options, rng).id;
    case "ops": return randomOps(st, p.who, p.ops, p.allowed, rng);
    default: throw new Error(`randomChoice: ${p.kind}`);
  }
}

export function randomAction(st, side, rng) {
  const L = E.legal(st, side);
  switch (L.kind) {
    case "pending": return { type: "choose", side, choice: randomChoice(st, L.pending, rng) };
    case "headline": return { type: "headline", side, card: pickOne(L.cards, rng) };
    case "action": {
      if (L.bog && L.bog.length) return { type: "play", side, card: pickOne(L.bog, rng), use: "bog" };
      // Not quite random: a scoring card in hand is played at once, so games
      // reach the later turns instead of ending on the holding rule.
      const scoring = L.cards.find((c) => E.CARD[c.id].scoring);
      if (scoring) return { type: "play", side, card: scoring.id, use: "event" };
      const opts = [];
      for (const c of L.cards) {
        const u = c.uses;
        if (u.event) opts.push({ type: "play", side, card: c.id, use: "event" });
        if (u.reform) opts.push({ type: "play", side, card: c.id, use: "reform" });
        const enemy = u.enemy;
        const order = () => (enemy ? (rng.next() < 0.5 ? "eventFirst" : "opsFirst") : undefined);
        if (u.place) opts.push(() => { const o = order(); return { type: "play", side, card: c.id, use: "place", order: o, points: o === "eventFirst" ? undefined : randomPoints(st, side, u.place.ops, rng) }; });
        if (u.campaign) opts.push(() => { const o = order(); return { type: "play", side, card: c.id, use: "campaign", order: o, target: pickOne(u.campaign.targets, rng) }; });
        if (u.lobby) opts.push(() => { const o = order(); return { type: "play", side, card: c.id, use: "lobby", order: o, target: pickOne(u.lobby.targets, rng).id }; });
        if (u.pair && u.pair.length) opts.push(() => {
          const pair = pickOne(u.pair, rng), pops = E.opsOf(st, side, pair);
          const ops = randomOps(st, side, pops, ["place", "campaign", "lobby"], rng);
          return ops ? { type: "play", side, card: c.id, pair, ...ops } : { type: "play", side, card: c.id, use: "event" };
        });
      }
      if (L.jiuding) {
        const j = L.jiuding;
        if (j.place) opts.push(() => ({ type: "play", side, card: E.JIUDING, use: "place", points: randomPoints(st, side, 4, rng) }));
        if (j.campaign) opts.push(() => ({ type: "play", side, card: E.JIUDING, use: "campaign", target: pickOne(j.campaign.targets, rng) }));
        if (j.lobby) opts.push(() => ({ type: "play", side, card: E.JIUDING, use: "lobby", target: pickOne(j.lobby.targets, rng).id }));
      }
      if (!opts.length) return null;
      const o = pickOne(opts, rng);
      return typeof o === "function" ? o() : o;
    }
    default: return null;
  }
}

// Play a whole game with random legal actions. Returns the final state and
// the number of actions taken.
export function playRandomGame(seed, options = {}, { maxActions = 4000, onStep } = {}) {
  const rng = E.makeRng(seed ^ 0x9e3779b9);
  let st = E.createGame(seed, options);
  let n = 0;
  while (st.winner == null) {
    if (++n > maxActions) throw new Error(`game ${seed} did not end in ${maxActions} actions (turn ${st.turn}, phase ${st.phase})`);
    const who = E.mustAct(st);
    if (!who.length) throw new Error(`game ${seed}: nobody must act (turn ${st.turn}, phase ${st.phase}, plan ${JSON.stringify(st.plan[0])})`);
    const side = pickOne(who, rng);
    const action = randomAction(st, side, rng);
    if (!action) throw new Error(`game ${seed}: no action for side ${side} (turn ${st.turn}, phase ${st.phase})`);
    st = E.apply(st, action);
    if (onStep) onStep(st, action);
  }
  return { st, actions: n };
}

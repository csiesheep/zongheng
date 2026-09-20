// The fallback a refused bot is carried by (#25), shared by the room (the
// Worker) and the solo game in the browser (#53). DOM-free on purpose: it
// imports the engine and nothing else, so it loads in a Durable Object, in a
// module script and in `node --test` alike.
//
// Nothing in here is trusted. The candidates are only guesses about what the
// position allows; `fallbackFor` hands each one to the engine and keeps the
// first the engine does not refuse. That is why a wrong guess costs nothing
// and why this file never needs to repeat a rule the engine already owns.
import * as E from "./engine.js";

// How many more of `id` this pending still allows. The limits are the ones the
// pending itself carries, so this reads what the engine published rather than
// keeping a second copy of the rule.
export function roomFor(st, p, id, counts) {
  let r = Infinity;
  if (p.distinct) r = Math.min(r, 1);
  if (p.maxPer) r = Math.min(r, p.maxPer);
  if (p.maxOf) r = Math.min(r, p.maxOf[id] ?? 0);
  if (p.side != null) r = Math.min(r, E.capOf(st, id) - E.infOf(st, id)[p.side]);
  return r - (counts[id] || 0);
}
export function* pendingCandidates(st, side, p) {
  const mk = (choice) => ({ type: "choose", side, choice });
  switch (p.kind) {
    case "points": {
      const min = p.min ?? 0;
      if (min === 0) yield mk([]);
      const counts = {}, out = [], want = Math.max(min, 1);
      for (const id of p.options) {
        while (out.length < want && roomFor(st, p, id, counts) > 0) { counts[id] = (counts[id] || 0) + 1; out.push(id); }
        if (out.length >= want) break;
      }
      if (out.length >= min) yield mk(out);
      if (min <= 1) for (const id of p.options) yield mk([id]);
      break;
    }
    case "card": {
      const min = p.min ?? 1;
      if (min === 0) yield mk([]);
      if (p.options.length >= min) yield mk(p.options.slice(0, Math.max(min, 1)));
      if (min <= 1) for (const c of p.options) yield mk([c]);
      break;
    }
    case "option":
      for (const o of p.options) yield mk(o.id);
      break;
    case "ops": {
      const o = E.opsOptions(st, side);
      if (p.allowed.includes("campaign")) for (const t of o.campaignTargets) yield mk({ use: "campaign", target: t });
      if (p.allowed.includes("lobby")) for (const t of o.lobbyTargets) yield mk({ use: "lobby", target: t.id });
      if (p.allowed.includes("place")) for (const x of o.placeOptions) if (x.cost <= p.ops) yield mk({ use: "place", points: [x.id] });
      break;
    }
  }
}
// Candidates for the seat, simplest first. `event` leads because it has no
// payload to get wrong and always spends a card, so the table moves.
//
// A scoring card goes before everything else in an action round. It has to
// leave the hand before the turn ends -- a side still holding one when the
// turn ends loses (`win(st, other(holding[0]), "scoring")` in engine.js) --
// and a safety net must not lose the game by its own neglect: carried only by
// the hand-order fallback, seeds 1, 7 and 42 all ended in turn 1 or 2 with
// reason "scoring" (#53). A scoring card is one with `E.CARD[id].scoring`
// (its region), and the engine takes it only as its event ("a scoring card
// must be played as its event"), which is also how `bots.js` plays one.
export function* fallbackCandidates(st, side) {
  const L = E.legal(st, side);
  if (L.kind === "pending") { yield* pendingCandidates(st, side, L.pending); return; }
  if (L.kind === "headline") { for (const card of L.cards) yield { type: "headline", side, card }; return; }
  if (L.kind !== "action") return;
  if (L.bog && L.bog.length) { for (const card of L.bog) yield { type: "play", side, card, use: "bog" }; return; }
  for (const c of L.cards) if (E.CARD[c.id] && E.CARD[c.id].scoring) yield { type: "play", side, card: c.id, use: "event" };
  for (const c of L.cards) {
    const u = c.uses || {};
    yield { type: "play", side, card: c.id, use: "event" };
    if (u.place) for (const o of u.place.options) if (o.cost <= u.place.ops) yield { type: "play", side, card: c.id, use: "place", order: "opsFirst", points: [o.id] };
    if (u.campaign) for (const t of u.campaign.targets) yield { type: "play", side, card: c.id, use: "campaign", order: "opsFirst", target: t };
    if (u.lobby) for (const t of u.lobby.targets) yield { type: "play", side, card: c.id, use: "lobby", order: "opsFirst", target: t.id };
    if (u.reform) yield { type: "play", side, card: c.id, use: "reform" };
  }
  const j = L.jiuding;
  if (j) {
    if (j.place) for (const o of j.place.options) if (o.cost <= 4) yield { type: "play", side, card: E.JIUDING, use: "place", points: [o.id] };
    if (j.campaign) for (const t of j.campaign.targets) yield { type: "play", side, card: E.JIUDING, use: "campaign", target: t };
    if (j.lobby) for (const t of j.lobby.targets) yield { type: "play", side, card: E.JIUDING, use: "lobby", target: t.id };
  }
}

// The first candidate the ENGINE accepts for `side` in `state`, or null.
// Never throws: it is the last thing standing between a refused bot and a
// table that stops moving, so a bad state has to come back as null, not as a
// second error on top of the first. A finished game, a side that does not
// have to act and a position where nothing is accepted all give null.
export function fallbackFor(state, side) {
  try {
    for (const action of fallbackCandidates(state, side)) {
      try { return { action, state: E.apply(state, action) }; } catch { /* not that one */ }
    }
  } catch { /* the position itself could not be read */ }
  return null;
}

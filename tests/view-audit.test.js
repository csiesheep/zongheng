// #131 audit sweep: every position of many random games, seen by Qin, by Chu
// and by a spectator. What a viewer may not find in its view:
//   - the seed, the rng state, the draw pile, the not-yet-shuffled eras;
//   - a card of a hand it cannot see, in `pending` or in `plan`;
//   - during the headline phase, the other side's committed headline, unless
//     行縣制 (reform box 4, "peek") lets this side see it (a spectator never);
//   - in the log entries the last move wrote, a card of a hand it cannot see
//     or an unrevealed headline.
// The sweep counts what it visited (phases, pending kinds and tags, hidden
// hands met), so a sweep that visits nothing fails instead of passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { playRandomGame } from "./driver.js";

const { QIN, CHU } = E;
const GAMES = Number(process.env.VIEW_AUDIT_GAMES || 80);
// 奪將 is handed to the other side by its own text (「並將本牌交給對手」), in
// front of everybody: the one card a log entry names as it enters a hand.
const GIVEN_OPENLY = new Set(["duojiang"]);

// Two card ids are also board ids (函谷關天險 `hangu` / the space 函谷關,
// 宜陽 `yiyang`); a string under a key that holds spaces is not a card.
const BOARD = new Set([...E.SPACES.map((s) => s.id), ...Object.keys(E.REGIONS), ...Object.keys(E.STATES)]);
const SPACE_KEYS = new Set(["points", "target", "inf", "regions", "region", "space", "state", "choices", "placeOptions", "campaignTargets", "lobbyTargets", "ids", "id"]);
// A lasting effect names the card that made it (`effects`, and `fx` in an
// `eventEnd` entry): that card was played in front of both, and may since have
// been reshuffled and drawn. History, not a hand.
const HISTORY_KEYS = new Set(["effects", "fx"]);
// Every string in `x` that names a card (not a space, not a lasting effect).
function* cardStrings(x, keys = [], owner = null) {
  if (keys.some((k) => HISTORY_KEYS.has(k))) return;
  if (typeof x === "string") {
    if (!E.CARD[x]) return;
    const spacey = keys.some((k) => SPACE_KEYS.has(k)) || (keys.includes("options") && owner && owner.kind !== "card");
    if (!BOARD.has(x) || !spacey) yield x;
    return;
  }
  if (!x || typeof x !== "object") return;
  const own = !Array.isArray(x) && x.kind ? x : owner;
  for (const [k, v] of Object.entries(x)) yield* cardStrings(v, Array.isArray(x) ? keys : [...keys, k], own);
}

// A log entry the last move wrote may name a card that is secret to this
// viewer after the move only if the card crossed the table in that same move
// and came back: named (played, discarded, revealed), then a later entry of the
// same move reshuffled the discard pile into the draw (`reshuffle`, or a new
// era's `era`) and the deal drew it into a hand. Anything else is a leak.
function checkViews(st, prevLogSeq, seen, where) {
  const fresh = st.log.filter((e) => e.i > prevLogSeq);
  for (const viewer of [QIN, CHU, null]) {
    const v = E.view(st, viewer);
    const who = `${where} viewer ${viewer == null ? "spectator" : E.SIDES[viewer]}`;
    for (const k of ["seed", "rngState", "draw", "later"]) assert.equal(v[k], undefined, `${who}: view carries ${k}`);
    const hidden = new Set();
    for (const s of [QIN, CHU]) if (v.hands[s] == null) for (const c of st.hands[s]) hidden.add(c);
    if (hidden.size) seen.hiddenHands++;
    // Headlines this viewer may not see yet.
    const secretHeads = new Set();
    if (st.phase === "headline") {
      for (const s of [QIN, CHU]) {
        if (st.headline[s] == null || s === viewer) continue;
        const peek = viewer != null && st.headline[viewer] == null && E.hasPerk(st, viewer, "peek");
        if (peek) { seen.peek++; continue; }
        secretHeads.add(st.headline[s]);
        seen.hiddenHeadline++;
        assert.ok(v.headline[s] === "hidden", `${who}: ${E.SIDES[s]}'s headline shows as ${v.headline[s]}`);
      }
    }
    const secret = new Set([...hidden, ...secretHeads]);
    for (const c of cardStrings({ pending: v.pending, plan: v.plan })) {
      assert.ok(!secret.has(c), `${who}: hidden card ${c} in pending/plan: ${JSON.stringify({ pending: v.pending, plan: v.plan }).slice(0, 300)}`);
    }
    for (const e of fresh) {
      const cameBack = fresh.some((x) => x.i > e.i && (x.type === "reshuffle" || x.type === "era"));
      for (const c of cardStrings(e)) {
        assert.ok(!secret.has(c) || cameBack || GIVEN_OPENLY.has(c), `${who}: the log entry ${JSON.stringify(e)} names hidden card ${c}`);
      }
    }
  }
  seen.phase[st.phase] = (seen.phase[st.phase] || 0) + 1;
  if (st.pending) { const k = `${st.pending.kind}/${st.pending.tag}${st.pending.card ? "/" + st.pending.card : ""}`; seen.pending[k] = (seen.pending[k] || 0) + 1; }
}

test(`#131 audit: ${GAMES} random games, every position, Qin / Chu / spectator views hide what they must`, (t) => {
  const seen = { phase: {}, pending: {}, hiddenHands: 0, hiddenHeadline: 0, peek: 0 };
  for (let seed = 1; seed <= GAMES; seed++) {
    const st0 = E.createGame(seed);
    checkViews(st0, 0, seen, `seed ${seed} start`);
    let prev = st0.logSeq || 0;
    playRandomGame(seed, {}, {
      onStep: (s, a) => { checkViews(s, prev, seen, `seed ${seed} t${s.turn} ${s.phase} after ${a.type}`); prev = s.logSeq || 0; },
    });
  }
  t.diagnostic(`visited ${JSON.stringify(seen)}`);
  // Non-vacuous: the sweep met every phase, hidden hands and hidden headlines,
  // and the card choices this issue is about.
  for (const p of ["setup", "headline", "action", "over"]) assert.ok(seen.phase[p] > 0, `never saw phase ${p}`);
  assert.ok(seen.hiddenHands > 0 && seen.hiddenHeadline > 0, `hidden hands ${seen.hiddenHands}, hidden headlines ${seen.hiddenHeadline}`);
  const kinds = Object.keys(seen.pending);
  for (const k of ["points/setup", "points/event", "option/event", "card/endDiscard", "card/event/chunshenjun", "card/event/hanfei", "card/event/xizuo", "card/event/lvbuwei", "ops/ops"]) {
    assert.ok(kinds.some((x) => x.startsWith(k)), `never saw a pending ${k}; saw ${kinds.join(", ")}`);
  }
});

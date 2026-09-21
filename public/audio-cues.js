// #62 part 1, piece A. Pure cue-picking logic: no DOM, no Web Audio, so it
// imports cleanly under plain Node (`node -e "import('./public/audio-cues.js')"`)
// and the orchestrator's tests can drive it with hand-built states/log
// entries. engine.js (and board.js/cards.js under it) are themselves DOM-free
// -- they already run inside the room's Durable Object -- so importing them
// here costs nothing.
import * as E from "./shared/engine.js";

const sideStr = (s) => (s === E.QIN ? "qin" : "chu");

// ---------- A1: sceneFor ----------
// The one piece of music playing for a given page/seat/era/result. `tutorial`
// wins over everything else: the tutorial is its own fixed lesson regardless
// of which `page` happens to be showing underneath it (today that's always
// "table" -- tutorial-ui.js hands the whole page over but never changes
// document location). `bgm.tutorial` isn't recorded yet (see missingCues
// below); audio.js's setScene() is the one that decides what to do when the
// cue it's given isn't in the manifest -- this module only ever names the
// cue the situation calls for.
export function sceneFor({ page, era, me, winner, tutorial }) {
  if (tutorial) return "bgm.tutorial";
  switch (page) {
    case "landing": return "bgm.landing";
    // Setup and lobby share a cue that isn't recorded yet (bgm.setup); naming
    // it here (rather than returning bgm.landing directly) keeps this
    // function honest about what SHOULD play once #61 catches up, and lets
    // audio.js's generic "missing cue: don't touch what's already playing"
    // rule be the one place that produces the actual fallback (bgm.landing
    // keeps playing because the setup/lobby request is silently ignored).
    case "setup": return "bgm.setup";
    case "lobby": return "bgm.setup";
    case "table": return `bgm.table.${era}.${me === E.CHU ? "chu" : "qin"}`; // a spectator (me == null) hears the Qin version, same as `!== CHU`
    case "over": {
      if (winner == null) return null;
      // The winner and a spectator (me == null) hear the winner's piece; the
      // loser hears their own losing piece.
      if (me == null || me === winner) return `bgm.win.${sideStr(winner)}`;
      return `bgm.lose.${sideStr(me)}`;
    }
    case "rules": return null;
    default: return null;
  }
}

// ---------- A2: cuesForLog ----------
// Importance high -> low, exactly the owner's list (#62): used only to trim
// an oversized batch down to four, never to reorder the batch itself.
const IMPORTANCE = ["over", "mie", "era", "seal", "turn", "mandate", "campaign", "reveal", "event", "opponent"];
const RANK = Object.fromEntries(IMPORTANCE.map((k, i) => [k, i]));

// One log entry -> { cue, rank } | null. `me` is 0 (Qin), 1 (Chu) or null
// (spectator) -- see sceneFor's own header comment for why null-checks read
// as "!== that side" throughout this file.
function cueForEntry(e, me) {
  switch (e.type) {
    case "headline": return { cue: "sfx.card.reveal", rank: RANK.reveal };
    case "play": {
      if (e.use !== "event") return null; // ops/reform/etc: no cue yet (sfx.card.ops isn't picked)
      const side = E.CARD[e.card].side; // null for a scoring card -> neutral
      const who = side === E.QIN ? "qin" : side === E.CHU ? "chu" : "neutral";
      return { cue: `sfx.card.event.${who}`, rank: RANK.event };
    }
    case "place":
    case "lobby":
      // The player's own taps already sounded when they were made; only the
      // OTHER side's move (or, for a spectator, either side's -- `me` is
      // null so `e.side !== me` is always true) gets a cue here.
      return e.side !== me ? { cue: "sfx.map.opponent", rank: RANK.opponent } : null;
    case "campaign": return { cue: "sfx.map.campaign", rank: RANK.campaign }; // either side
    case "vp": {
      // engine.js's vp() does `st.mandate += side === QIN ? n : -n` -- so a
      // `vp` entry's own `side` IS the direction: a Qin-side entry always
      // moved the Mandate toward Qin, a Chu-side entry always toward Chu.
      // No need to compare mandate before/after; the entry says it directly.
      return { cue: e.side === E.QIN ? "sfx.track.mandate.qin" : "sfx.track.mandate.chu", rank: RANK.mandate };
    }
    case "seal": return { cue: "sfx.seal.gain", rank: RANK.seal };
    case "unseal": return { cue: "sfx.seal.lose", rank: RANK.seal };
    case "mie": return { cue: "sfx.mie", rank: RANK.mie };
    case "turn": return { cue: "sfx.turn.new", rank: RANK.turn };
    case "era": return { cue: "sfx.turn.era", rank: RANK.era };
    case "over": {
      const winSide = e.winner;
      if (me == null || me === winSide) return { cue: `sfx.end.win.${sideStr(winSide)}`, rank: RANK.over };
      return { cue: `sfx.end.lose.${sideStr(me)}`, rank: RANK.over };
    }
    default: return null; // restore, score, tire, reform, jiuding, discard, bog, skip, opsLost, reshuffle, endTurn: nothing yet
  }
}

// `entries` are the engine log entries the client hasn't voiced yet (the
// caller in app.js decides that slice -- this function just turns whichever
// entries it's given into cues). Consecutive duplicate cues are dropped
// first (a run of "opponent placed here" taps shouldn't repeat the same
// sound back to back); only THEN, if more than four remain, is the batch cut
// down to the four most important, kept in their original relative order
// (never re-sorted by importance -- importance only decides which four
// survive the cut).
export function cuesForLog(entries, { me }) {
  const mapped = [];
  for (const e of entries) {
    const hit = cueForEntry(e, me);
    if (hit) mapped.push(hit);
  }
  const deduped = [];
  for (const m of mapped) {
    if (deduped.length && deduped[deduped.length - 1].cue === m.cue) continue;
    deduped.push(m);
  }
  if (deduped.length <= 4) return deduped.map((m) => m.cue);
  const withIdx = deduped.map((m, idx) => ({ ...m, idx }));
  withIdx.sort((a, b) => a.rank - b.rank || a.idx - b.idx);
  const top4 = withIdx.slice(0, 4).sort((a, b) => a.idx - b.idx);
  return top4.map((m) => m.cue);
}

// ---------- A3: controlCues ----------
// `before`/`after` are two per-seat views one render apart, same shape as
// lastmove.js's computeLastMoveMarks() takes -- this deliberately reuses
// E.controller() the same way lastmove.js and disc-view.js do, so "control"
// means one thing across the whole client. At most one gain + one lose per
// call, regardless of how many spaces flipped (the owner's "at most one of
// each per call").
export function controlCues(before, after, me) {
  if (me == null || !before || !after) return [];
  let gained = false, lost = false;
  for (const sp of E.SPACES) {
    const b = E.controller(before, sp.id), a = E.controller(after, sp.id);
    if (b === a) continue;
    if (a === me) gained = true;
    if (b === me) lost = true;
  }
  const cues = [];
  if (gained) cues.push("sfx.map.control.gain");
  if (lost) cues.push("sfx.map.control.lose");
  return cues;
}

// ---------- A4: dangerFlags ----------
// "One step from an immediate end" -- read directly off engine facts (see
// the issue's own restatement of them), never off a comparison to a
// previous view, so this is safe to call on a state that just loaded (e.g.
// a room reconnect) with no prior view at all.
export function dangerFlags(st) {
  const flags = [];
  const seals = Object.keys(st.seals || {}).length;
  const mie = Object.keys(st.mie || {}).length;
  if (seals === st.options.seals - 1) flags.push("seals");
  if (mie === st.options.mie - 1) flags.push("mie");
  // Mandate ends the game at +/- MANDATE_TO_WIN (20); "15 or more toward
  // that side" is one step (5) short of that, today's 20 giving 15 exactly
  // as the issue's own example says.
  const step = E.MANDATE_TO_WIN - 5;
  if (st.mandate >= step) flags.push("mandateQin");
  if (st.mandate <= -step) flags.push("mandateChu");
  // Weariness runs 5..1, 1 is collapse -- the last box before that is 2.
  if (st.weariness === 2) flags.push("weariness");
  if (st.turn === st.options.turns) flags.push("lastTurn");
  return flags.sort();
}

// ---------- A5: missingCues ----------
// Every cue id sceneFor/cuesForLog/controlCues can ever ask for, enumerated
// once here so missingCues() can answer "which of these does the manifest
// not have" without guessing -- this is what keeps the answer honest as #61
// adds files: the day bgm.setup and bgm.tutorial land, this returns [].
const ERAS = ["reform", "alliance", "conquest"];
const SIDES = ["qin", "chu"];
const ALL_CUES = [
  "bgm.landing", "bgm.setup", "bgm.tutorial",
  ...ERAS.flatMap((era) => SIDES.map((s) => `bgm.table.${era}.${s}`)),
  ...SIDES.map((s) => `bgm.win.${s}`),
  ...SIDES.map((s) => `bgm.lose.${s}`),
  "sfx.card.reveal",
  ...["qin", "chu", "neutral"].map((s) => `sfx.card.event.${s}`),
  "sfx.map.opponent", "sfx.map.campaign",
  ...SIDES.map((s) => `sfx.track.mandate.${s}`),
  "sfx.seal.gain", "sfx.seal.lose", "sfx.mie", "sfx.turn.new", "sfx.turn.era",
  ...SIDES.map((s) => `sfx.end.win.${s}`),
  ...SIDES.map((s) => `sfx.end.lose.${s}`),
  "sfx.map.control.gain", "sfx.map.control.lose",
];
export function missingCues(manifest) {
  const have = new Set(Object.keys((manifest && manifest.cues) || {}));
  return ALL_CUES.filter((c) => !have.has(c));
}

// #79: groups what the OTHER side did into the table's own game log into
// "moves" the table can animate one at a time -- one move per card the
// opponent played (or per headline), each carrying its own ordered steps.
// DOM-free and imports nothing from the page (oppmove-ui.js is the module
// that turns this into pixels): a plain function of the log array, so the
// orchestrator's test (tests/oppmove.test.js, not committed here) can pin
// its contract without touching a DOM at all. See TEAM.md/#79's brief for
// the exact shape; this file follows it entry by entry, no cleverness.
//
// A move starts at a `play` entry whose `side !== me` (an opponent's play)
// or at a `headline` entry (which reveals cards[1-me], the opponent's own
// headline card) and runs up to but not including the next `play`,
// `headline`, `turn` or `setup` entry -- everything logged in between is
// one of its steps, in log order. The player's OWN plays (`side === me`)
// open no move at all, so every entry that would otherwise be one of ITS
// steps has nowhere to land and is silently dropped, per the brief ("the
// player's own plays, and the steps that follow them, are skipped").
// The Nine Cauldrons logs its own `play` entry (card "jiuding", #81), so it
// opens a move like any card.
export function opponentMoves(log, sinceSeq, me) {
  try {
    if (!Array.isArray(log)) return [];
    const moves = [];
    let current = null; // the move being built, or null between/during the player's own move
    const closeCurrent = () => { if (current) moves.push(current); current = null; };
    for (const e of log) {
      if (!e || typeof e.i !== "number" || e.i <= sinceSeq) continue;
      if (e.type === "play") {
        closeCurrent();
        if (e.side !== me) current = { seq: e.i, side: e.side, card: e.card, use: e.use, steps: [] };
        continue;
      }
      if (e.type === "headline") {
        closeCurrent();
        const side = 1 - me;
        current = { seq: e.i, side, card: e.cards ? e.cards[side] : undefined, use: "headline", steps: [] };
        continue;
      }
      if (e.type === "turn" || e.type === "setup") { closeCurrent(); continue; }
      if (!current) continue; // a step with no open opponent move -- the player's own, or before the first play/headline
      const step = { ...e };
      if (e.type === "place" && Array.isArray(e.points)) {
        // Collapse the raw per-influence-point list into [spaceId, count]
        // pairs, in the order each space FIRST appears (a placement can
        // touch the same space more than once in one points array).
        const order = [];
        const counts = new Map();
        for (const id of e.points) {
          if (!counts.has(id)) { counts.set(id, 0); order.push(id); }
          counts.set(id, counts.get(id) + 1);
        }
        step.spaces = order.map((id) => [id, counts.get(id)]);
      }
      current.steps.push(step);
    }
    closeCurrent();
    return moves;
  } catch {
    return [];
  }
}

// Collapse a raw per-influence-point list into [spaceId, count] pairs, in
// the order each space FIRST appears. Shared by opponentMoves' step.spaces
// (above), groupLog's setup/place rows (below), and log-view.js's
// otherRowHtml() (#127 follow-up: a `place` entry orphaned by the engine's
// 400-entry log cap needs the same [id,count] shape setupRowHtml already
// builds its text from, to fill log.place's `{spaces}`).
export function collapseSpaces(points) {
  if (!Array.isArray(points)) return [];
  const order = [];
  const counts = new Map();
  for (const id of points) {
    if (!counts.has(id)) { counts.set(id, 0); order.push(id); }
    counts.set(id, counts.get(id) + 1);
  }
  return order.map((id) => [id, counts.get(id)]);
}

// #88 (design A 逐手卷軸): groups the WHOLE log, both sides, in time order,
// into the rows the log panel draws -- turn headers, headlines, one row per
// card played (with its own steps), and anything logged outside a move as
// its own "other" row. DOM-free, like opponentMoves above; see the
// orchestrator's test (tests/logview.test.js, not committed here) for the
// exact contract this follows entry by entry.
//
// A move starts at a `play` entry and runs up to but not including the
// next `play`, `headline`, `turn`, `setup` or `endTurn` entry -- everything
// logged in between becomes one of its steps, in log order, WHOEVER it
// happened to (unlike opponentMoves, groupLog keeps both sides' entries).
// `endTurn` closes the current move and is also logged as its own "other"
// row. A step with no open move (e.g. before the first play, or between
// `endTurn` and the next `turn`) becomes its own "other" row too.
const turnOf = (e) => (e && e.turn !== undefined ? e.turn : e && e.t);

export function groupLog(log) {
  try {
    if (!Array.isArray(log)) return [];
    const rows = [];
    let current = null;
    for (const e of log) {
      if (!e || typeof e !== "object") continue;
      const seq = e.i;
      if (e.type === "setup") {
        current = null;
        rows.push({ kind: "setup", seq, side: e.side, spaces: collapseSpaces(e.points) });
        continue;
      }
      if (e.type === "turn") {
        current = null;
        rows.push({ kind: "turn", seq, turn: e.turn, era: e.era });
        continue;
      }
      if (e.type === "headline") {
        current = { kind: "headline", seq, cards: e.cards, first: e.first, turn: turnOf(e), steps: [] };
        rows.push(current);
        continue;
      }
      if (e.type === "play") {
        current = { kind: "move", seq, side: e.side, card: e.card, use: e.use, turn: turnOf(e), round: e.r, steps: [] };
        rows.push(current);
        continue;
      }
      if (e.type === "endTurn") {
        current = null;
        rows.push({ kind: "other", seq, entry: e });
        continue;
      }
      // #127: an `over` entry used to fall through to the generic "attach
      // to the open move" branch below with no case anywhere to render it
      // (log-view.js's chipsForSteps had no "over" type, so it just
      // vanished). It still gets attached as a step of the move/headline
      // that ended the game -- chipsForSteps' new "over" case turns that
      // into the "ended it" chip on that very row -- but it ALSO gets its
      // own top-level row here, so the panel ends with a line naming the
      // winner and the reason even when nothing was open (e.g. a turn-end
      // scoring after endTurn already cleared `current`).
      if (e.type === "over") {
        if (current) current.steps.push(e);
        rows.push({ kind: "over", seq, winner: e.winner, reason: e.reason });
        current = null;
        continue;
      }
      if (current) {
        const step = e.type === "place" && Array.isArray(e.points) ? { ...e, spaces: collapseSpaces(e.points) } : e;
        current.steps.push(step);
      } else {
        rows.push({ kind: "other", seq, entry: e });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

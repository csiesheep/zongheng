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
      if (!current) continue; // a step with no open opponent move -- the player's own, or before the first play
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

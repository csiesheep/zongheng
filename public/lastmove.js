// #41: which spaces changed between two per-seat views taken one render
// apart — a pure diff of the NUMBERS on the two views (never the log's own
// text), so it reads the same for a placement, a campaign, an event effect
// or a scoring marker without knowing which one just happened. DOM-free on
// purpose (round 1 review, orchestrator, item 3): app.js needs a DOM to
// import at all, which made computeLastMoveMarks() untestable where it
// used to live; this module imports only engine.js (itself DOM-free) so a
// unit test can import it directly against hand-built views. Nothing here
// reads i18n or touches the page — app.js's own lastMoveTagText() (still
// in app.js, it needs t()) turns a mark into display text. A pure move:
// the function's own body is unchanged from app.js's version.
import * as E from "./shared/engine.js";

// `prevView` is the view from the render just before this one (app.js's
// game.lastView, read before it's overwritten — see render()); null on the
// very first render of a game, or (deliberately) whenever the log's own
// running index just went backwards, which only happens when a new game
// replaced the old one under the same tab. Returns `{}` in both of those
// cases: there is no "last action" yet to mark.
export function computeLastMoveMarks(prevView, view) {
  const marks = {};
  if (!prevView || !view) return marks;
  for (const sp of E.SPACES) {
    const [qb, cb] = E.infOf(prevView, sp.id);
    const [qa, ca] = E.infOf(view, sp.id);
    const dq = qa - qb, dc = ca - cb;
    const controlChanged = E.controller(prevView, sp.id) !== E.controller(view, sp.id);
    if (dq || dc || controlChanged) {
      // Most actions move only one side's count at a given space; the one
      // case where both move at once (a campaign that removes the
      // defender and then places the attacker's own surplus at the same
      // target in a single call, engine.js's campaign()) still has only
      // one tag to show, so the bigger of the two swings wins.
      marks[sp.id] = { delta: Math.abs(dq) >= Math.abs(dc) ? dq : dc };
    }
  }
  // A state's destroyed flag flipping (engine.js's checkMarkers(), st.mie)
  // is its own kind of change, shown on the state's capital space — the
  // one square disc that already stands for the state — regardless of
  // whatever influence/control change the loop above may have also caught
  // there this same action; falling (or, rarer, being restored) is the
  // more important fact to show, so it wins the one tag slot.
  for (const [stateId, s] of Object.entries(E.STATES)) {
    const was = !!(prevView.mie && prevView.mie[stateId]);
    const now = !!(view.mie && view.mie[stateId]);
    if (was !== now) marks[s.capital] = { destroyed: now };
  }
  return marks;
}

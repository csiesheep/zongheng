// #67: the opening video's decision logic, DOM-free so the orchestrator's
// test can import it straight into Node. landing.js owns the DOM side (the
// start layer, the <video>, the crossfade) -- this file only answers
// "should it play at all", plus the one storage key both sides share.
export const OPENING_KEY = "zh.opening";

// shouldPlayOpening({ seen, reducedMotion, params }): never throws. `seen`
// is accepted for backward compatibility (a caller may still pass whether
// OPENING_KEY was set) but no longer gates anything -- #72 (owner,
// 2026-09-21): "the opening video plays on every visit", so having played
// before no longer suppresses it.
// - params has "opening" (a replay link, e.g. a QA link back into it): always
//   plays, even over reduced motion or a room link -- it's an explicit ask.
// - otherwise a room link (params has "room" or "code") goes straight to the
//   landing: a joining player doesn't want ten seconds of video between them
//   and their seat.
// - otherwise reduced motion: straight to the landing.
// - otherwise: plays, every time.
export function shouldPlayOpening({ seen, reducedMotion, params }) {
  try {
    if (params && typeof params.has === "function" && params.has("opening")) return true;
    if (params && typeof params.has === "function" && (params.has("room") || params.has("code"))) return false;
    if (reducedMotion) return false;
    return true;
  } catch {
    return false;
  }
}

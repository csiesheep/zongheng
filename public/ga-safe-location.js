// #111 (orchestrator, room-code leak): the original bug was GA4's automatic
// page_view sending page_location = document.location.href verbatim -- a
// room link is play.html?room=CODE, so a hit sent from that URL sent the
// code straight to Google. This is pulled out of app.js (which can't be
// imported under node --test -- it touches document/Audio at import time,
// see tests/setup-prompt.test.js) so the sanitizer itself stays unit-
// testable.
//
// Allow-list, not strip-list, on purpose: a strip-list only protects
// against the one param someone remembered to name (?room=, today). An
// allow-list means a future query param can't leak by just existing --
// it has to be added here first, on purpose. The hash is always dropped;
// nothing in this app puts identifying data in a URL fragment today, but
// there's no reason to carry one to Google either.
export const GA_SAFE_PARAMS = ["play", "resume", "create", "side", "lang"];

export function sanitizeGaLocation(href, allow = GA_SAFE_PARAMS) {
  const u = new URL(href);
  const kept = new URLSearchParams();
  for (const k of allow) {
    if (u.searchParams.has(k)) kept.set(k, u.searchParams.get(k));
  }
  const qs = kept.toString();
  return u.origin + u.pathname + (qs ? `?${qs}` : "");
}

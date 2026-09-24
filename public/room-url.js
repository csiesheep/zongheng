// #111 (orchestrator, 3rd bounce): GA4 Enhanced Measurement's own listeners
// (scroll, form_start, and page_view triggered by a history.replaceState
// call) read location.href directly -- no page_location parameter on any
// gtag() call reaches them. The only real fix is keeping the room code out
// of the address bar completely, from the very first paint, and never
// writing it back. These are the DOM/storage-free pieces of that, pulled
// out on their own so they stay importable under node --test (app.js can't
// be, see tests/setup-prompt.test.js) -- play.html's own inline <head>
// script has a duplicate of stripRoomFromUrl's logic (it must run before
// app.js, or the gtag tag, even parses), documented there.

// Given the page's current URL, pulls a ?room=CODE out and returns the URL
// with it gone (everything else -- other params, the hash -- untouched).
// { code: null, cleanUrl: href } when there was nothing to strip.
export function stripRoomFromUrl(href) {
  const u = new URL(href);
  const code = u.searchParams.get("room");
  if (!code) return { code: null, cleanUrl: href };
  u.searchParams.delete("room");
  return { code: code.toUpperCase(), cleanUrl: u.toString() };
}

// The one place a room code is meant to leave this app: the copy-link /
// invite button. Built from state (the code the app already holds), never
// from the address bar.
export function buildRoomShareUrl(origin, pathname, code) {
  return `${origin}${pathname}?room=${code}`;
}

// A minimal sessionStorage-shaped "read once, then forget": used for a
// shared link's code (zh.joinRoom), which should only ever be consumed at
// boot, not linger and silently rejoin later in the same tab. Takes the
// storage as a parameter (rather than reading the global) so it can be
// exercised with a plain in-memory mock under node --test, with no browser.
export function readAndConsume(storage, key) {
  const v = storage.getItem(key);
  if (v != null) storage.removeItem(key);
  return v;
}

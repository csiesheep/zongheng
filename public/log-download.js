// #137: saving/copying the log, plus a local stub of `E.exportGame` (the
// be/137-export contract) to build against until that branch lands in
// public/shared/engine.js -- app.js prefers the real E.exportGame the
// moment it exists (see stubExportGame's own call site in app.js), so this
// file needs no further change once be/137-export merges.
//
// `view` here is whatever E.view(st, side) already gives the client (a
// clone of `st` with #131's redactions applied) -- winner/reason/turn/
// mandate/options/log all come straight off it. `final` only ever comes
// from the real E.exportGame (Part A's job, once `st.winner != null`);
// this stub always reports `final: null`, which just means "not revealed
// yet" for a finished game viewed on this branch -- never a wrong reveal.
export function stubExportGame(view, meta) {
  return {
    format: "zongheng-log", version: 1,
    exportedAt: new Date().toISOString(),
    lang: meta.lang,
    game: { mode: meta.mode, level: meta.level ?? null, viewer: meta.viewer ?? null, names: meta.names, options: view.options },
    result: view.winner != null ? { winner: view.winner, reason: view.reason, turn: view.turn, mandate: view.mandate } : null,
    log: view.log,
    final: null,
  };
}

// ---------- saving ----------
// iOS's WebKit (every browser on iOS, Chrome included -- "CriOS") has never
// reliably fired a real Save dialog for `<a download>` on a blob: URL; it
// either ignores the attribute and navigates the tab to the blob, or (newer
// versions) opens it in the in-page viewer -- silently, no error to catch.
// Rather than guess at a version cutoff, this always uses the new-tab path
// on iOS: opening the same content in its own tab is exactly what a failed
// download would have looked like anyway, and Share/press-and-hold from
// there reliably saves it (the owner's own device is an iPhone on Chrome).
export function isIOSLike() {
  try {
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ reports as "Macintosh" with touch support -- the only real
    // Mac Safari/Chrome case that also matches has no touch points at all.
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  } catch { return false; }
}
function openInTab(content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  // A pop-up blocker silently returns null here (no gesture, or the user
  // said no) -- there is nothing further to fall back to but the copy
  // button already on the sheet, so this just reports which path ran.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return !!w;
}
// Returns { ok, fellBackToTab } so the caller can show `logDownload.fallbackNote`.
export function saveText(filename, content, mime) {
  if (isIOSLike()) return { ok: openInTab(content, mime), fellBackToTab: true };
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { ok: true, fellBackToTab: false };
  } catch {
    return { ok: openInTab(content, mime), fellBackToTab: true };
  }
}

// ---------- clipboard ----------
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Fallback for browsers with no (or a gesture-gated, denied) Clipboard
  // API: a temporary off-screen textarea + execCommand("copy"), the same
  // last-resort every pre-Clipboard-API app used.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

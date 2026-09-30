// #133 part 2: the homeFall ("守不住才敗") screens -- the capital badge, the
// defender/attacker banners, the retake toast, the turn-end check card, and
// the bits the end page/log need (capital names). Self-contained like
// lobby-ui.js/log-view.js: reads shared/engine.js and both i18n modules
// directly, never reaches into app.js.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";

const I18N = { en, "zh-Hant": zh };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function t(lang, key, p = {}) {
  return String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key)
    .replace(/\{(\w+)\}/g, (_, k) => esc(p[k] ?? `{${k}}`));
}
const sideName = (s, lang) => t(lang, `sides.${E.SIDES[s]}`);
const spaceName = (id, lang) => (id && E.SPACE[id] ? (lang === "en" ? E.SPACE[id].en : E.SPACE[id].zh) : "");

// ---------- the capital badge (mockup 0_rest) ----------
// A small gold "都" tag on whichever space is currently a side's home
// capital -- only while homeFall is on (an absent/"none" option draws
// nothing, same gate as every other homeFall screen below). `st.capital`
// (only set under "move", after a capital has relocated) is read the same
// way homeCapitalStatus() itself does, so this never keeps its own copy of
// "which space is a capital right now".
export function capitalBadgeHTML(v, spaceId, lang) {
  if (!v.options.homeFall || v.options.homeFall === "none") return "";
  const isCap = spaceId === E.homeCapital(v, E.QIN) || spaceId === E.homeCapital(v, E.CHU);
  return isCap ? `<span class="capital-badge" title="${esc(t(lang, "capitalUi.badgeTitle"))}">${esc(t(lang, "capitalUi.badge"))}</span>` : "";
}

// ---------- how many points break a controller's hold on `id` (never "how
// many to take it yourself" -- the brief's own "you do not need to control
// it yourself" line) ----------
function pointsToBreakControl(v, id) {
  const [q, c] = E.infOf(v, id), S = E.SPACE[id].stability;
  const ctl = E.controller(v, id);
  if (ctl == null) return { side: null, n: 0 };
  // The OTHER side needs enough more influence that `ctl`'s no longer
  // ahead by `S`: other' > ctl's - S, i.e. other' >= ctl's - S + 1.
  const other = E.other(ctl);
  const [ctlInf, otherInf] = ctl === E.QIN ? [q, c] : [c, q];
  const n = Math.max(0, ctlInf - S + 1 - otherInf);
  return { side: other, n };
}

// ---------- the defender/attacker banners (mockups A_defender/B_attacker) ----------
// One row per capital that needs a banner: yours held by the enemy
// (defender), or theirs held by you (attacker). Both can apply at once
// (rare -- each side holding the other's capital), so this returns an array.
export function bannerRows(v, me, lang) {
  if (!v.homeCapitals) return [];
  const rows = [];
  for (const c of v.homeCapitals) {
    if (c.heldBy == null) continue;
    const capName = spaceName(c.capital, lang);
    if (c.side === me) {
      // Defender: MY capital, held by the enemy.
      const left = v.phase === "action" && v.winner == null ? v.rounds - v.round + ((v.actor === E.QIN || me === E.CHU) ? 1 : 0) : null;
      const { n } = pointsToBreakControl(v, c.capital);
      rows.push({
        kind: "defender", capital: c.capital,
        text: t(lang, "capitalUi.defenderTitle", { capital: capName, enemy: sideName(c.heldBy, lang) }),
        sub: t(lang, "capitalUi.defenderSub", { you: sideName(me, lang), left: left ?? 0 }),
        short: n > 0 ? t(lang, "capitalUi.defenderShort", { left: left ?? 0, n }) : t(lang, "capitalUi.defenderShortZero", { left: left ?? 0 }),
        retake: n > 0 ? t(lang, "capitalUi.retakeHint", { n, enemy: sideName(c.heldBy, lang) }) : t(lang, "capitalUi.retakeHintZero"),
      });
    } else if (c.heldBy === me) {
      // Attacker: THEIR capital, held by me.
      const { n } = pointsToBreakControl(v, c.capital);
      rows.push({
        kind: "attacker", capital: c.capital,
        text: t(lang, "capitalUi.attackerTitle", { capital: capName }),
        sub: n > 0 ? t(lang, "capitalUi.attackerSub", { n }) : t(lang, "capitalUi.attackerSubZero"),
        short: n > 0 ? t(lang, "capitalUi.attackerShort", { n }) : t(lang, "capitalUi.attackerSubZero"),
      });
    }
  }
  return rows;
}
// #147: the banner used to be three lines (~73px at 390 wide), which -- with
// the map already at its floor -- pushed the hand below the fold and made the
// page scroll on a phone. Now two lines by default (title + a short summary
// of actions left / points to retake); a tap on it opens the full text.
let bannerOpen = false;
export function bannerHtml(v, me, lang) {
  const rows = bannerRows(v, me, lang);
  if (!rows.length) return "";
  return rows.map((r) => (
    `<div class="capital-banner capital-banner-${r.kind}${bannerOpen ? " open" : ""}" data-capital="${r.capital}" role="button" tabindex="0" aria-expanded="${bannerOpen}">` +
      `<div class="capital-banner-title">${r.text}</div>` +
      (bannerOpen
        ? `<div class="capital-banner-sub">${r.sub}</div>` + (r.retake ? `<div class="capital-banner-retake">${r.retake}</div>` : "")
        : `<div class="capital-banner-sub capital-banner-short">${r.short}</div>`) +
    `</div>`
  )).join("");
}

// ---------- the retake toast (mockup C_retaken) ----------
export function retakenToastHtml(capital, lang) {
  return `<div class="capital-toast">${t(lang, "capitalUi.retaken", { capital: spaceName(capital, lang) })}</div>`;
}

// ---------- the turn-end check card (mockup D_check) ----------
// `checks`: this turn's own capitalCheck log entries (both sides), in log
// order -- the caller finds them (see findTurnEndChecks() below).
export function turnEndCardHtml(checks, lang) {
  const rows = checks.map((c) => {
    const status = c.result === "safe" ? t(lang, "capitalUi.statusSafe") : c.result === "moved" ? t(lang, "capitalUi.statusMoved") : t(lang, "capitalUi.statusFallen");
    return `<div class="capital-check-row${c.result === "fallen" ? " fallen" : ""}"><span class="capital-check-name">${spaceName(c.capital, lang)} (${sideName(c.whose, lang)})</span><span class="capital-check-status">${status}</span></div>`;
  });
  return (
    `<div class="lobby-card capital-check-card" role="dialog" aria-modal="true">` +
      `<div class="lobby-card-title">${t(lang, "capitalUi.checkTitle")}</div>` +
      `<div class="capital-check-rows">${rows.join("")}</div>` +
      `<div class="lobby-card-actions"><button type="button" class="lobby-btn primary" data-capital-done="1">${t(lang, "lobbyRoll.done")}</button></div>` +
    `</div>`
  );
}

// The header + its attempts helper pattern, reused here for a turn's own
// capitalCheck entries: everything logged after the last `endTurn`/`turn`
// boundary (or from the start), in order.
export function findTurnEndChecks(v) {
  const log = v.log || [];
  const out = [];
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].type === "capitalCheck") out.unshift(log[i]);
    else if (out.length) break; // capitalCheck entries are logged back to back at the turn end
  }
  return out;
}

// ---------- the banner row: a normal in-flow element, not an overlay --
// inserted once right after #statline (below the map, per the brief's own
// "push the map, or the status row" choice: this repo already has the
// stats-row pattern below the map). #133-ship: layoutTable() (app.js) DOES
// need to know about this row -- it measures the banner's real height the
// same way it measures #topbar/#statline and subtracts it from the map's
// budget, so the banner takes its height from the map rather than pushing
// the hand tray out of #table's fixed, overflow:hidden box (found by the
// checker at 320x568: the hand fell 66px below the viewport, unreachable
// even by scrolling, because layoutTable() had no idea the banner was
// there). ----------
let bannerEl = null;
function ensureBanner() {
  if (bannerEl) return bannerEl;
  bannerEl = document.createElement("div");
  bannerEl.id = "capitalBannerRow";
  bannerEl.hidden = true;
  const statline = document.getElementById("statline");
  if (statline && statline.parentNode) statline.parentNode.insertBefore(bannerEl, statline.nextSibling);
  else document.body.appendChild(bannerEl);
  return bannerEl;
}
export function syncBanner(v, me, lang, onToggle) {
  const el = ensureBanner();
  if (me == null) { el.hidden = true; el.innerHTML = ""; return; } // a spectator has no "your capital"
  const html = bannerHtml(v, me, lang);
  el.innerHTML = html;
  el.hidden = !html;
  el.onclick = () => { bannerOpen = !bannerOpen; el.innerHTML = bannerHtml(v, me, lang); if (onToggle) onToggle(); };
}

// ---------- mount points: two small fixed elements, created once ----------
let toastEl = null, checkEl = null;
function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement("div");
  toastEl.id = "capitalToast";
  toastEl.className = "capital-toast-wrap";
  toastEl.hidden = true;
  document.body.appendChild(toastEl);
  return toastEl;
}
function ensureCheckCard() {
  if (checkEl) return checkEl;
  checkEl = document.createElement("div");
  checkEl.id = "capitalCheckOverlay";
  checkEl.className = "lobby-card-overlay";
  checkEl.hidden = true;
  document.body.appendChild(checkEl);
  return checkEl;
}
let toastTimer = 0;
export function showToast(capital, lang) {
  const el = ensureToast();
  el.innerHTML = retakenToastHtml(capital, lang);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 3200);
}
export function syncCheckCard(checks, lang, onDone) {
  const el = ensureCheckCard();
  el.hidden = false;
  el.innerHTML = turnEndCardHtml(checks, lang);
  const b = el.querySelector("[data-capital-done]");
  if (b) b.onclick = () => { el.hidden = true; el.innerHTML = ""; onDone(); };
}
export function hideCheckCard() {
  if (!checkEl) return;
  checkEl.hidden = true;
  checkEl.innerHTML = "";
}

// #133: the dice-遊說 (realign-own) screens -- the pick screen's per-target
// win% pill, the preview (modifiers + win/tie/lose + net), the roll card that
// sits over the map for each attempt (owner's display B), the same card
// read-only for the opponent/spectator, and the after-the-fact summary.
// Self-contained like log-view.js/oppmove-ui.js: reads shared/engine.js and
// both i18n modules directly, never reaches into app.js, and app.js never
// reaches into its DOM beyond the small mount point it owns (ensureCard()
// below, appended to <body> once, the same pattern log-view.js's
// ensureRings() uses for its own flash overlay).
//
// Round 2 (owner's review against the approved mockups, lobby_ui/*.png):
// dark red-brown card with a gold line (not light parchment), real pip dice
// in side colours (drawn with CSS grids -- no die-face art exists in this
// project, flagged to the orchestrator), each modifier SOURCE on its own
// line (not one bare "+2"), a slanted seal-stamp verdict, and the pick/
// preview screens moved into this same overlay card (the owner's own
// alternative to fixing the sheet's give-way math) so nothing sits behind
// the hand sheet at 320-390px.
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
const sep = (lang) => (lang === "en" ? ", " : "、");
const sideCls = (side) => (side === E.QIN ? "q" : "c");

// ---------- pick screen: one space's win% (or null off the dice rule) ----------
export function oddsPct(v, side, id) {
  const o = E.realignOdds(v, side, id);
  return o ? Math.round(o.win * 100) : null;
}

// ---------- pip dice (this project has no die-face art) ----------
// Standard face layouts on a 3x3 grid, cell indices 0-8 left-to-right/top-to-bottom.
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function pipDie(n, side, size = "") {
  const cells = Array.from({ length: 9 }, (_, i) => `<span class="pip-cell${(PIPS[n] || []).includes(i) ? " on" : ""}"></span>`).join("");
  return `<div class="pip-die side-${sideCls(side)}${size ? ` ${size}` : ""}">${cells}</div>`;
}

// ---------- the parts of one side's modifier, each on its own line with its
// own point value (mockup: "周邊控制 宜陽、上黨 +2" / "影響力較多 +1" /
// "本土相鄰(陳蔡) +1"), not one combined "+2". ----------
function modLines(side, why, lang) {
  const out = [];
  if (why.adj.length) out.push(`${t(lang, "lobbyRoll.parts.adj", { spaces: why.adj.map((a) => spaceName(a, lang)).join(sep(lang)) })} +${why.adj.length}`);
  if (why.more) out.push(`${t(lang, "lobbyRoll.parts.more")} +1`);
  if (why.home) out.push(`${t(lang, "lobbyRoll.parts.home")} +1`);
  return out;
}
function modBoxHtml(side, mod, why, lang, me) {
  const label = side === me ? `${sideName(side, lang)}${lang === "en" ? " (you)" : "(你)"}` : sideName(side, lang);
  const lines = modLines(side, why, lang);
  return (
    `<div class="lobby-modbox side-${sideCls(side)}">` +
      `<div class="lobby-modbox-head">${esc(label)} <b>${lang === "en" ? "+" : ""}${mod}</b></div>` +
      lines.map((l) => `<div class="lobby-modbox-line">${l}</div>`).join("") +
    `</div>`
  );
}

// ---------- the preview (mockup 2_preview): both sides' modifiers, the
// win/tie/lose split, and the expected net -- null off the dice rule. Now a
// full standalone panel (own overlay card), not a #promptScroll note, per
// the owner's own permitted alternative. ----------
export function previewCardHtml(v, side, target, ops, lang, me) {
  const o = E.realignOdds(v, side, target);
  if (!o) return "";
  const opp = E.other(side);
  const win = Math.round(o.win * 100), tie = Math.round(o.tie * 100), lose = 100 - win - tie;
  const net = Math.round(o.net * 10) / 10;
  return (
    `<div class="lobby-card lobby-preview-card" role="dialog" aria-modal="true">` +
      `<div class="lobby-card-title">${t(lang, "lobbyRoll.previewTitle", { target: spaceName(target, lang), n: ops })}</div>` +
      `<div class="lobby-modboxes">${modBoxHtml(side, o.mod[side], o.why[side], lang, me)}<span class="lobby-vs">${t(lang, "lobbyRoll.vs")}</span>${modBoxHtml(opp, o.mod[opp], o.why[opp], lang, me)}</div>` +
      `<div class="lobby-bar" role="img" aria-label="${t(lang, "lobbyRoll.bar", { win, tie, lose })}">` +
        `<span class="lobby-bar-win" style="width:${win}%"></span><span class="lobby-bar-tie" style="width:${tie}%"></span><span class="lobby-bar-lose" style="width:${lose}%"></span>` +
      `</div>` +
      `<div class="lobby-bar-text">${t(lang, "lobbyRoll.bar", { win, tie, lose })}</div>` +
      `<div class="lobby-preview-net">${t(lang, "lobbyRoll.net", { sign: net >= 0 ? "+" : "−", n: Math.abs(net) })}</div>` +
      `<div class="lobby-card-actions">` +
        `<button type="button" class="lobby-btn" data-lobby-cancel="1">${t(lang, "buttons.cancel")}</button>` +
        `<button type="button" class="lobby-btn primary" data-lobby-start="1">${t(lang, "lobbyRoll.start")}</button>` +
      `</div>` +
    `</div>`
  );
}

// ---------- the roll card (mockup 3b_court, display B) ----------
// Finds the header ("lobby") and the attempts ("realign") logged for
// `pending.target`, from `v.log` alone -- the same log every seat's/
// spectator's own view already carries (tests/room-130.test.js: both sides'
// modifiers and dice are visible to everyone, never rngState/seed).
function lobbySeq(v, pending) {
  const log = v.log || [];
  let header = null;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].type === "lobby" && log[i].target === pending.target) { header = log[i]; break; } }
  const entries = header ? log.filter((l) => l.type === "realign" && l.target === pending.target && l.i > header.i) : [];
  return { header, entries };
}
function envoyHtml(side, roll, mod, why, me, lang) {
  const key = side === me ? "lobbyRoll.envoyYou" : "lobbyRoll.envoyOther";
  const lines = modLines(side, why, lang);
  return (
    `<div class="lobby-envoy side-${sideCls(side)}">` +
      `<div class="lobby-envoy-name">${t(lang, key, { side: sideName(side, lang) })}</div>` +
      pipDie(roll, side) +
      `<div class="lobby-envoy-mods">${lines.map((l) => `<div class="lobby-envoy-mod-line">${l}</div>`).join("") || `<div class="lobby-envoy-mod-line">+0</div>`}</div>` +
      `<div class="lobby-envoy-total">${roll}${mod >= 0 ? "+" : ""}${mod} = ${roll + mod}</div>` +
    `</div>`
  );
}
// The verdict: a slanted seal stamp in the card's corner (owner's pick),
// never a centered pill -- CSS (.lobby-seal) positions/rotates it.
function verdictHtml(e, lang) {
  // The vertical stamp (owner's mockup) only reads right for the zh 2-3
  // character label (楚勝/秦勝/平); English's longer "Qin wins" stays
  // horizontal, still rotated, inside the same seal box.
  const vert = lang !== "en" ? " lobby-seal-vert" : "";
  if (e.lose == null) return `<div class="lobby-seal tie">${t(lang, "lobbyRoll.tieShort")}</div>`;
  const winner = E.other(e.lose);
  return `<div class="lobby-seal side-${sideCls(winner)}${vert}">${t(lang, "lobbyRoll.winsShort", { side: sideName(winner, lang) })}</div>`;
}
function resultLineHtml(e, lang) {
  if (e.lose == null || !e.n) return t(lang, "lobbyRoll.resultTie");
  return t(lang, "lobbyRoll.result", { loser: sideName(e.lose, lang), target: spaceName(e.target, lang), n: e.n });
}
// `me`: the viewer's own side (0/1), or null for a spectator. `onChoose` is
// called with "continue"/"stop" -- passed only when this viewer is the actor
// (interactive); omitted (or the pending's `who` isn't `me`) renders the same
// card read-only with the waiting line, per the brief's "not drawn" section.
export function rollCardHtml(v, pending, me, lang) {
  const { header, entries } = lobbySeq(v, pending);
  const e = entries[entries.length - 1];
  if (!header || !e) return "";
  const interactive = pending.who === me;
  const dots = Array.from({ length: pending.ops }, (_, i) => `<span class="lobby-dot${i < pending.k ? " filled" : ""}"></span>`).join("");
  const footer = interactive
    ? `<div class="lobby-card-actions">` +
        `<button type="button" class="lobby-btn" data-lobby-choice="stop">${t(lang, "lobbyRoll.stop")}</button>` +
        `<button type="button" class="lobby-btn primary" data-lobby-choice="continue">${t(lang, "lobbyRoll.continueN", { left: pending.ops - pending.k })}</button>` +
      `</div>`
    : `<div class="lobby-card-waiting">${t(lang, "lobbyRoll.waiting", { actor: sideName(pending.who, lang) })}</div>`;
  return (
    `<div class="lobby-card" role="dialog" aria-modal="true">` +
      verdictHtml(e, lang) +
      `<div class="lobby-card-title">${t(lang, "lobbyRoll.cardTitle", { target: spaceName(pending.target, lang) })}</div>` +
      `<div class="lobby-card-attempt">${t(lang, "lobbyRoll.attempt", { k: e.k, n: pending.ops })} <span class="lobby-dots">${dots}</span></div>` +
      `<div class="lobby-envoys">${envoyHtml(E.QIN, e.roll[E.QIN], e.mod[E.QIN], e.adj && { adj: e.adj[E.QIN], more: e.more[E.QIN], home: e.home[E.QIN] }, me, lang)}${envoyHtml(E.CHU, e.roll[E.CHU], e.mod[E.CHU], e.adj && { adj: e.adj[E.CHU], more: e.more[E.CHU], home: e.home[E.CHU] }, me, lang)}</div>` +
      `<div class="lobby-result">${resultLineHtml(e, lang)}</div>` +
      footer +
    `</div>`
  );
}

// ---------- the summary (mockup 4_summary), shown to the actor only once
// the sequence ends (a stop, an auto-stop, or the last attempt). ----------
function summaryRowHtml(e, lang) {
  const resultTxt = e.lose == null ? t(lang, "lobbyRoll.tieShort") : `${sideName(e.lose, lang)} −${e.n}`;
  return (
    `<div class="lobby-summary-row">` +
      `<span class="lobby-summary-k">${t(lang, "lobbyRoll.summaryK", { k: e.k })}</span>` +
      pipDie(e.roll[0], E.QIN, "sm") + `<span class="lobby-summary-mod">+${e.mod[0]}</span>` +
      `<span class="lobby-summary-vs">${t(lang, "lobbyRoll.vs")}</span>` +
      pipDie(e.roll[1], E.CHU, "sm") + `<span class="lobby-summary-mod">+${e.mod[1]}</span>` +
      `<span class="lobby-summary-result">${resultTxt}</span>` +
    `</div>`
  );
}
export function summaryHtml(v, header, entries, lang) {
  // Both sides' before/after: the live board gives AFTER; BEFORE is rebuilt
  // from the header's own totals (`own`, the actor's starting influence,
  // logged when the sequence opened; `removed`, points taken off the enemy
  // over every attempt, #130) rather than replaying every attempt again.
  const [qAfter, cAfter] = E.infOf(v, header.target);
  const qBefore = header.side === E.QIN ? header.own : qAfter + header.removed;
  const cBefore = header.side === E.CHU ? header.own : cAfter + header.removed;
  return (
    `<div class="lobby-card lobby-summary">` +
      `<div class="lobby-card-title">${t(lang, "lobbyRoll.summaryTitle", { target: spaceName(header.target, lang) })}</div>` +
      `<div class="lobby-summary-rows">${entries.map((e) => summaryRowHtml(e, lang)).join("")}</div>` +
      `<div class="lobby-summary-final">${t(lang, "lobbyRoll.summaryFinal", { target: spaceName(header.target, lang), from0: qBefore, to0: qAfter, from1: cBefore, to1: cAfter })}</div>` +
      `<div class="lobby-card-actions"><button type="button" class="lobby-btn primary" data-lobby-done="1">${t(lang, "lobbyRoll.done")}</button></div>` +
    `</div>`
  );
}

// ---------- the mount point: one fixed overlay over the map, created once ----------
let cardEl = null;
// True while the summary (below) owns the overlay -- syncRollCard() (called
// unconditionally every render, from renderPromptAndSheet()) must leave it
// alone until the player taps 完成/Done, or the summary would be replaced by
// "nothing pending" on the very next render (the state has already moved on
// by the time the summary is shown).
let summaryActive = false;
function ensureCard() {
  if (cardEl) return cardEl;
  cardEl = document.createElement("div");
  cardEl.id = "lobbyCardOverlay";
  cardEl.className = "lobby-card-overlay";
  cardEl.hidden = true;
  document.body.appendChild(cardEl);
  return cardEl;
}
// Renders the roll card for the current pending (or hides if none/expired).
// `onChoose(choice)` fires for the actor's own tap; ignored read-only.
export function syncRollCard(v, pending, me, lang, onChoose) {
  if (summaryActive) return true;
  const el = ensureCard();
  if (!pending || pending.tag !== "realign") { el.hidden = true; el.innerHTML = ""; return false; }
  const html = rollCardHtml(v, pending, me, lang);
  if (!html) { el.hidden = true; el.innerHTML = ""; return false; }
  el.hidden = false;
  el.innerHTML = html;
  if (pending.who === me) {
    el.querySelectorAll("[data-lobby-choice]").forEach((b) => { b.onclick = () => onChoose(b.dataset.lobbyChoice); });
  }
  return true;
}
export function syncSummary(v, header, entries, lang, onDone) {
  summaryActive = true;
  const el = ensureCard();
  el.hidden = false;
  el.innerHTML = summaryHtml(v, header, entries, lang);
  const b = el.querySelector("[data-lobby-done]");
  if (b) b.onclick = () => { summaryActive = false; el.hidden = true; el.innerHTML = ""; onDone(); };
}
// The preview (mockup 2_preview), with its own Cancel/Start.
export function syncPreviewCard(v, side, target, ops, lang, me, onCancel, onStart) {
  if (summaryActive) return;
  const el = ensureCard();
  el.className = "lobby-card-overlay";
  el.hidden = false;
  el.innerHTML = previewCardHtml(v, side, target, ops, lang, me);
  const c = el.querySelector("[data-lobby-cancel]"); if (c) c.onclick = onCancel;
  const s = el.querySelector("[data-lobby-start]"); if (s) s.onclick = onStart;
}
// #143: app.js's botLoop() reads this before it lets the bot take its next
// action, so a solo bot cannot advance the board while the human is still
// looking at a just-finished sequence's summary card.
export function summaryOpen() { return summaryActive; }
export function hideCard() {
  summaryActive = false;
  if (!cardEl) return;
  cardEl.hidden = true;
  cardEl.className = "lobby-card-overlay";
  cardEl.innerHTML = "";
}
// The header + its attempts, for app.js's summary detection (humanAct()) --
// the same lookup rollCardHtml() uses internally, exposed so app.js never
// has to re-read v.log's own shape itself.
export function findLobbySequence(v, target) {
  const log = v.log || [];
  let header = null;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].type === "lobby" && log[i].target === target) { header = log[i]; break; } }
  const entries = header ? log.filter((l) => l.type === "realign" && l.target === target && l.i > header.i) : [];
  return { header, entries };
}

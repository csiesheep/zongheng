// #35: the one place a card's read-only view is drawn — the table's own
// read-only peek sheet (#34's #peekSheet, opened from a card name in the
// log/news) and the rules page's card detail page both call renderCardView
// so neither can drift from the other's layout. The full INTERACTIVE card
// page (browsing a card in hand, choosing a use, confirming) stays in
// app.js's own renderPromptAndSheet — cardHeader()/cardTextBox() below are
// exported too so that page keeps sharing the header/text-box markup, but it
// never calls renderCardView() itself and so never gets the history section
// (owner: the playable sheet has no room for it at 669px, and it would be
// noise while you're deciding what to do with the card in hand).
//
// Self-contained on purpose: this module reads i18n and the card/story data
// itself (the same modules app.js and rules.js already import) rather than
// taking a `t`/`cardZh`/`cardEn`/... bundle from the caller, so both call
// sites can stay tiny — render(id, lang) is the entire contract.
import * as E from "./shared/engine.js";
import en from "./i18n/en.js";
import zh from "./i18n/zh-Hant.js";
import CARD_EN from "./i18n/cards.en.js";
import STORIES from "./i18n/stories.js";

const I18N = { en, "zh-Hant": zh };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t = (lang, key, p = {}) => String(key.split(".").reduce((o, k) => (o ? o[k] : undefined), I18N[lang] || I18N.en) ?? key)
  .replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));

// Card names/text are always bilingual regardless of the UI language (the
// same convention app.js's own cardName()/cardTextZh()/cardTextEn() already
// keep) — kept here, not imported from app.js, since app.js is the table's
// own module and can't be imported back into rules.js without pulling in
// the whole play-flow.
const cardZh = (id) => (id === E.JIUDING ? "九鼎" : E.CARD[id].zh);
const cardEn = (id) => (id === E.JIUDING ? "The Nine Cauldrons" : E.CARD[id].en);
const cardTextZh = (id) => (id === E.JIUDING ? "4 點;全部用在三晉或周室視為 5。用後蓋著交給對手。" : E.CARD[id].text);
const cardTextEn = (id) => (id === E.JIUDING ? "4 ops; 5 if all of it lands in the Three Jin or Zhou. Then it passes face down." : CARD_EN[id] ?? E.CARD[id].text);
// #46: the scoring badge's own "計" was Chinese regardless of the
// interface language (a pre-existing gap from #29, caught by the owner's
// "every face, one language" ruling) — en now gets the same plain "S" the
// hand tile already uses for a scoring card.
const opsLabel = (id, lang) => (id === E.JIUDING ? "4" : E.CARD[id].scoring ? (lang === "en" ? "S" : "計") : String(E.CARD[id].ops));

// Which of the sheet's three colour skins (Qin/Chu/neutral-or-scoring) a
// card belongs to — same rule app.js's own cardSide() uses.
export function cardSide(id) {
  if (id === E.JIUDING) return "n";
  const c = E.CARD[id];
  return c.scoring ? "s" : c.side === 0 ? "q" : c.side === 1 ? "c" : "n";
}

// The fixed header: art, ops/scoring badge, both names, era/number/year on
// one line and side/removal on a second (#35: the rules page's detail view
// is the first place either of those two facts is shown at all — added here
// rather than only for rules.js so the table's own peek sheet gains them
// too, same module, same look). Always appended straight into the sheet
// itself (never the scrollable middle), so it never scrolls out of view.
// #46 (owner: 「卡牌,只顯示一語言」): every face of a card shows the
// interface language only — the name is a single node, the text box a
// single line, neither carries the other language anywhere in the DOM.
export function cardHeader(sh, id, lang) {
  const m = id === E.JIUDING ? null : E.CARD[id];
  const info = m ? `${t(lang, "eras." + m.era)}${m.num ? ` · No. ${m.num}` : ""}${m.year ? ` · ${lang === "en" ? m.year + " BC" : "前" + m.year + "年"}` : ""}` : "";
  // #92 round 3 (orchestrator): 九鼎 used to fall into the `m && m.scoring`
  // branch's `id === E.JIUDING ||` guard and got labelled 「記分卡」/"Scoring
  // card" — it isn't one (`opsLabel()` above already special-cases it as a
  // plain "4", never "S"/"計", for the same reason). It has no `side` either
  // (E.JIUDING has no E.CARD entry at all, `m` is null for it), so
  // "sides.neutral" is exactly what a side-less, non-scoring card already
  // gets below — 九鼎 now falls straight into that same case instead of a
  // dedicated one.
  const sideLabel = m && m.scoring ? t(lang, "sides.scoring")
    : !m || m.side == null ? t(lang, "sides.neutral")
    : m.side === 0 ? t(lang, "sides.qin") : t(lang, "sides.chu");
  const removeLabel = id === E.JIUDING ? "" : (m.remove ? t(lang, "sheet.removeYes") : t(lang, "sheet.removeNo"));
  const metaLine2 = [sideLabel, removeLabel].filter(Boolean).join(sep(lang));
  const name = lang === "en" ? cardEn(id) : cardZh(id);
  const head = document.createElement("div"); head.className = "sheet-head";
  head.innerHTML =
    `<img class="sheet-img" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
    `<div class="sheet-meta"><span class="sheet-badge">${esc(opsLabel(id, lang))}</span>` +
    `<div class="sheet-name"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(name)}</div>` +
    `<div class="sheet-info">${esc(info)}${info ? "<br>" : ""}${esc(metaLine2)}</div>` +
    `</div>`;
  sh.appendChild(head);
}
const sep = (lang) => (lang === "en" ? ", " : "、");

// The card-text box (#46: one language only, was bilingual per #29 until
// the owner's ruling reversed that) — the sheet's own bordered/tinted panel,
// now a single line in the interface language.
export function cardTextBox(parent, id, lang) {
  const box = document.createElement("div"); box.className = "sheet-textbox";
  const text = lang === "en" ? cardTextEn(id) : cardTextZh(id);
  box.innerHTML = `<p class="sheet-text"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(text)}</p>`;
  parent.appendChild(box);
}

// #35: the history section — only appended (and only takes up space) when
// the card actually has one in stories.js; a card with none gets no empty
// shell. #35 追加(owner): unlike the text box above it, this reads in ONE
// language only, the current UI language — the OTHER language's text/source
// is never put in the DOM at all (not CSS-hidden), so a language switch
// (renderDetail()/renderPeek() both fully rebuild this via renderCardView)
// removes it outright rather than just hiding it.
//
// #92 (owner, iPhone screenshot: 「牌的史實,可以縮起或展開,預設縮起」): a
// fourth `state` argument turns this into a collapsible <button>+region
// instead of the old fixed-open title/body. `state` is omitted by every
// caller that must stay exactly as it was before this issue (rules.js's own
// card detail view — "the rules page card list is not the game," #92's own
// words) so that path is untouched below. Callers that ARE the game (the
// interactive card page's own historyBox() calls in app.js, and
// renderCardView()'s `opts.historyState` a few lines down, which is how the
// 看牌 peek and the log's card peek — #88's openPeek — both get it) pass
// `{ open, onToggle }`: `open` decides the FIRST paint only (never
// re-derived from anything visual after that) and `onToggle(nextOpen)` is
// how the caller remembers the choice across the next re-render — this
// function never re-renders itself. The actual click toggles this box's own
// classes/attributes in place (not a re-render) so the CSS transition below
// has a real before/after state to animate between; a re-render elsewhere
// (advisor text arriving, a language switch) just rebuilds fresh from
// whatever `state.open` now is, per #92 point 2 ("stays expanded until the
// page closes").
let historySeq = 0;
export function historyBox(parent, id, lang, state) {
  const story = STORIES[id];
  if (!story) return null;
  const text = lang === "en" ? story.en : story.zh;
  const src = lang === "en" ? story.srcEn : story.srcZh;
  const textCls = lang === "en" ? "sheet-text-en" : "sheet-text-zh";
  const box = document.createElement("div"); box.className = "sheet-textbox sheet-history";
  const bodyHtml =
    `<p class="${textCls}"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(text)}</p>` +
    (src ? `<p class="sheet-history-src">${esc(t(lang, "sheet.source"))}${esc(src)}</p>` : "");
  if (!state) {
    box.innerHTML = `<div class="sheet-history-title">${esc(t(lang, "sheet.history"))}</div>` + bodyHtml;
    parent.appendChild(box);
    return box;
  }
  const bodyId = `sheetHistBody${++historySeq}`;
  let open = !!state.open;
  box.classList.toggle("sheet-history-open", open);
  // One line of the story's start, faded, on the same row as the title when
  // it fits (#92 point 1, "optional") — plain truncation is enough since the
  // CSS below clips it with an ellipsis anyway; no word-boundary care needed.
  const preview = text.length > 36 ? text.slice(0, 36).trim() + "…" : text;
  box.innerHTML =
    `<button type="button" class="sheet-history-toggle" aria-expanded="${open}" aria-controls="${bodyId}">` +
      `<span class="sheet-history-arrow" aria-hidden="true"></span>` +
      `<span class="sheet-history-title">${esc(t(lang, "sheet.history"))}</span>` +
      `<span class="sheet-history-preview"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(preview)}</span>` +
    `</button>` +
    `<div class="sheet-history-body" id="${bodyId}"><div class="sheet-history-body-inner">${bodyHtml}</div></div>`;
  const toggleBtn = box.querySelector(".sheet-history-toggle");
  const bodyEl = box.querySelector(".sheet-history-body");
  const innerEl = bodyEl.querySelector(".sheet-history-body-inner");
  parent.appendChild(box); // must be attached before scrollHeight means anything
  // Orchestrator (#92, table walk on the full CARD page, an own card):
  // `.sheet-history-body` is a flex item inside `.sheet-history` (itself
  // `display: flex` via `.sheet-textbox`), which sits inside `.sheet-mid` —
  // a flex column with `overflow-y: auto`. A pure-CSS `grid-template-rows:
  // 0fr -> 1fr` animation (this function's first attempt) resolves that
  // single `fr` track to 0px in that nested, auto-height, overflow:auto
  // context every time, on the full card page specifically — the peek
  // sheet isn't inside that same constrained column, which is why it looked
  // fine there. `max-height` set to a real measured pixel value sidesteps
  // the whole auto-sizing negotiation: `innerEl.scrollHeight` is the
  // content's true height regardless of how the outer box is currently
  // clipped (overflow: hidden never affects scrollHeight), so it works
  // identically expanded, collapsed, or mid-toggle, in every one of the
  // three homes (card page / 看牌 peek / log peek) and at every viewport.
  const setBodyHeight = (o) => { bodyEl.style.maxHeight = o ? innerEl.scrollHeight + "px" : "0px"; };
  // First paint (or a re-render that must land already-expanded per #92
  // point 2) must NOT animate — only an actual click should. Suppress the
  // stylesheet's transition for this one synchronous style write, then let
  // it apply again from the next frame on, ahead of any real click.
  bodyEl.style.transition = "none";
  setBodyHeight(open);
  requestAnimationFrame(() => { bodyEl.style.transition = ""; });
  toggleBtn.onclick = () => {
    open = !open;
    box.classList.toggle("sheet-history-open", open);
    toggleBtn.setAttribute("aria-expanded", String(open));
    setBodyHeight(open);
    if (state.onToggle) state.onToggle(open);
  };
  return box;
}

// The read-only card view itself: header + scrollable middle (text box,
// then history if any, then an optional extra note) + a single pinned
// [Close]. `opts.note`, when given, is app.js's own "Played by {side}" hint
// (#34) — the rules page's detail view never passes one.
export function renderCardView(container, id, lang, opts = {}) {
  container.innerHTML = "";
  container.className = `sheet overlay peek-sheet sheet-${cardSide(id)}`;
  cardHeader(container, id, lang);
  const mid = document.createElement("div"); mid.className = "sheet-mid"; container.appendChild(mid);
  cardTextBox(mid, id, lang);
  // #92: `opts.historyState` is only ever passed by app.js's peek (both the
  // 看牌 peek and the log's card peek go through this same renderCardView —
  // see openPeek() there); rules.js's own card detail view never sets it, so
  // its history section stays exactly as it was before this issue.
  historyBox(mid, id, lang, opts.historyState);
  if (opts.note) {
    const n = document.createElement("div"); n.className = "note"; n.textContent = opts.note;
    mid.appendChild(n);
  }
  const foot = document.createElement("div"); foot.className = "peek-footer"; container.appendChild(foot);
  const btn = document.createElement("button");
  // #66 (FE, cross-boundary -- flagged at handover): `no-tap-sound` so app.js's
  // peek (openPeek/closePeek: sfx.ui.open/close) never doubles with the
  // generic sfx.ui.tap listener there; harmless on the rules page's own
  // card detail view (rules.js has no such listener at all).
  btn.type = "button"; btn.className = "primary no-tap-sound"; btn.textContent = t(lang, "buttons.close");
  btn.onclick = () => opts.onClose && opts.onClose();
  foot.appendChild(btn);
  return container;
}

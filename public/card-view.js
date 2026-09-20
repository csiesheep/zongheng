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
const opsLabel = (id) => (id === E.JIUDING ? "4" : E.CARD[id].scoring ? "計" : String(E.CARD[id].ops));

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
export function cardHeader(sh, id, lang) {
  const m = id === E.JIUDING ? null : E.CARD[id];
  const info = m ? `${t(lang, "eras." + m.era)}${m.num ? ` · No. ${m.num}` : ""}${m.year ? ` · ${lang === "en" ? m.year + " BC" : "前" + m.year + "年"}` : ""}` : "";
  const sideLabel = id === E.JIUDING || (m && m.scoring) ? t(lang, "sides.scoring")
    : !m || m.side == null ? t(lang, "sides.neutral")
    : m.side === 0 ? t(lang, "sides.qin") : t(lang, "sides.chu");
  const removeLabel = id === E.JIUDING ? "" : (m.remove ? t(lang, "sheet.removeYes") : t(lang, "sheet.removeNo"));
  const metaLine2 = [sideLabel, removeLabel].filter(Boolean).join(sep(lang));
  const head = document.createElement("div"); head.className = "sheet-head";
  head.innerHTML =
    `<img class="sheet-img" src="art/cards/${id}.jpg" alt="" onerror="this.style.visibility='hidden'">` +
    `<div class="sheet-meta"><span class="sheet-badge">${esc(opsLabel(id))}</span>` +
    `<div class="sheet-name-zh" lang="zh-Hant">${esc(cardZh(id))}</div>` +
    `<div class="sheet-name-en">${esc(cardEn(id))}</div>` +
    `<div class="sheet-info">${esc(info)}${info ? "<br>" : ""}${esc(metaLine2)}</div>` +
    `</div>`;
  sh.appendChild(head);
}
const sep = (lang) => (lang === "en" ? ", " : "、");

// The bilingual card-text box (#29): Chinese above English, in the sheet's
// own bordered panel — unchanged from app.js's original cardTextBox, just
// moved here so both callers share one copy.
export function cardTextBox(parent, id) {
  const box = document.createElement("div"); box.className = "sheet-textbox";
  box.innerHTML = `<p class="sheet-text-zh" lang="zh-Hant">${esc(cardTextZh(id))}</p><p class="sheet-text-en">${esc(cardTextEn(id))}</p>`;
  parent.appendChild(box);
}

// #35: the history section — only appended (and only takes up space) when
// the card actually has one in stories.js; a card with none gets no empty
// shell. #35 追加(owner): unlike the text box above it, this reads in ONE
// language only, the current UI language — the OTHER language's text/source
// is never put in the DOM at all (not CSS-hidden), so a language switch
// (renderDetail()/renderPeek() both fully rebuild this via renderCardView)
// removes it outright rather than just hiding it.
export function historyBox(parent, id, lang) {
  const story = STORIES[id];
  if (!story) return null;
  const text = lang === "en" ? story.en : story.zh;
  const src = lang === "en" ? story.srcEn : story.srcZh;
  const box = document.createElement("div"); box.className = "sheet-textbox sheet-history";
  const textCls = lang === "en" ? "sheet-text-en" : "sheet-text-zh";
  box.innerHTML =
    `<div class="sheet-history-title">${esc(t(lang, "sheet.history"))}</div>` +
    `<p class="${textCls}"${lang === "en" ? "" : ' lang="zh-Hant"'}>${esc(text)}</p>` +
    (src ? `<p class="sheet-history-src">${esc(t(lang, "sheet.source"))}${esc(src)}</p>` : "");
  parent.appendChild(box);
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
  cardTextBox(mid, id);
  historyBox(mid, id, lang);
  if (opts.note) {
    const n = document.createElement("div"); n.className = "note"; n.textContent = opts.note;
    mid.appendChild(n);
  }
  const foot = document.createElement("div"); foot.className = "peek-footer"; container.appendChild(foot);
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "primary"; btn.textContent = t(lang, "buttons.close");
  btn.onclick = () => opts.onClose && opts.onClose();
  foot.appendChild(btn);
  return container;
}

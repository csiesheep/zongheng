// #138: the check every 戰報 passes before it is stored, and the list of problems
// that goes back to the model when it does not.
//
//   validateReport(report, digest) -> [] or ["problem", ...]
//
// The report is { zh, en } (other top-level keys are ignored), each language
//   { title, intro, chapters: [{ turn, heading, paragraphs: [..], cards?: [ids], mapCaption? }], ending }
// with one chapter per year of the digest, in order. A chapter names at most
// four cards, each one the digest lists for that year. And no game words: the
// owner (2026-09-27) wants it told as history -- 「不要用 打出，記分 等等字眼，
// 內容像在詳述真實歷史」 -- so the words of the game's own rules are refused in
// every string of the language.
export const LANGS = ["zh", "en"];
export const MAX_CARDS = 4;

// zh: the brief's list, plus the simplified forms of the same words (a zh-Hant
// report has no business with them either).
const ZH_WORDS = [
  "打出", "出牌", "手牌", "抽牌", "棄牌", "牌庫", "牌", "記分", "計分", "得分", "分數", "扶植", "奇襲", "行動點", "回合", "骰",
  "弃牌", "牌库", "记分", "计分", "分数", "奇袭", "行动点",
];
const ZH_RE = [/天命\s*[+\-−]?\s*\d/];
// en: whole words, any case.
const NUM = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const EN_RE = [
  /\bcards?\b/i, /\bops\b/i, /\bscor(?:e|ed|es|ing)\b/i, /\bpoints?\b/i, /\bdice\b/i, /\bdie\s+rolls?\b/i, /\brolled\b/i,
  /\bdiscard(?:s|ed|ing)?\b/i, /\bdecks?\b/i, new RegExp(`\\bturn\\s+${NUM}\\b`, "i"), new RegExp(`\\bround\\s+${NUM}\\b`, "i"),
  /\bmandate\s*[+\-−]?\s*\d/i,
];

// The banned words found in `text`, as they appear there.
export function bannedIn(text, lang) {
  if (typeof text !== "string") return [];
  const hits = [];
  if (lang === "zh") {
    for (const w of ZH_WORDS) if (text.includes(w)) hits.push(w);
    for (const re of ZH_RE) { const m = text.match(re); if (m) hits.push(m[0]); }
  } else {
    for (const re of EN_RE) { const m = text.match(re); if (m) hits.push(m[0]); }
  }
  // 「牌」 is inside 「打出牌」-style hits already named: keep the list short.
  return [...new Set(hits)];
}

const isStr = (x) => typeof x === "string" && x.trim().length > 0;

// One language of a report against the digest.
export function validateLanguage(side, digest, lang) {
  const p = [];
  const at = (where, text) => {
    const hits = bannedIn(text, lang);
    if (hits.length) p.push(`${lang} ${where}: game words ${hits.map((h) => JSON.stringify(h)).join(", ")} -- tell it as history`);
  };
  if (!side || typeof side !== "object" || Array.isArray(side)) return [`${lang}: missing`];
  for (const k of ["title", "intro", "ending"]) {
    if (!isStr(side[k])) p.push(`${lang}.${k}: a non-empty string is required`);
    else at(k, side[k]);
  }
  const years = digest.turns.length;
  if (!Array.isArray(side.chapters)) { p.push(`${lang}.chapters: an array is required`); return p; }
  if (side.chapters.length !== years) p.push(`${lang}.chapters: ${side.chapters.length} chapters, but the game lasted ${years} years (one chapter per year)`);
  side.chapters.forEach((c, i) => {
    const w = `${lang} chapter ${i + 1}`;
    if (!c || typeof c !== "object") { p.push(`${w}: not an object`); return; }
    if (c.turn !== i + 1) p.push(`${w}: "turn" must be ${i + 1}`);
    if (!isStr(c.heading)) p.push(`${w}: "heading" must be a non-empty string`); else at(`chapter ${i + 1} heading`, c.heading);
    if (!Array.isArray(c.paragraphs) || !c.paragraphs.length || !c.paragraphs.every(isStr)) p.push(`${w}: "paragraphs" must be a non-empty array of non-empty strings`);
    else c.paragraphs.forEach((t, j) => at(`chapter ${i + 1} paragraph ${j + 1}`, t));
    if (c.mapCaption != null) { if (typeof c.mapCaption !== "string") p.push(`${w}: "mapCaption" must be a string`); else at(`chapter ${i + 1} mapCaption`, c.mapCaption); }
    if (c.cards != null) {
      const allowed = digest.turns[i] ? digest.turns[i].cards : [];
      if (!Array.isArray(c.cards)) p.push(`${w}: "cards" must be an array of ids`);
      else {
        if (c.cards.length > MAX_CARDS) p.push(`${w}: at most ${MAX_CARDS} cards, not ${c.cards.length}`);
        for (const id of c.cards) if (!allowed.includes(id)) p.push(`${w}: card ${JSON.stringify(id)} is not one of that year's (${allowed.join(", ")})`);
        if (new Set(c.cards).size !== c.cards.length) p.push(`${w}: a card is named twice`);
      }
    }
  });
  return p;
}

export function validateReport(report, digest) {
  if (!digest || !Array.isArray(digest.turns)) throw new Error("validateReport: a digest is required");
  if (!report || typeof report !== "object") return ["the report is not an object"];
  return LANGS.flatMap((lang) => validateLanguage(report[lang], digest, lang));
}

// English strings. Every player-visible word lives here or in zh-Hant.js;
// app.js carries no prose of its own. `{name}` style placeholders are filled
// by t().
export default {
  lang: "en",
  title: "Zongheng",
  tagline: "Unite the states and Qin is emperor; bind them together and Chu is king.",
  about: "A two-player card-driven strategy game set in the Warring States. Qin plays the Horizontal, picking the states off one by one; Chu plays the Vertical, holding the alliance together. Eight turns, about an hour. Solo against a bot, or an online room with a four-letter code. English and Traditional Chinese.",
  soon: "Under construction. The rules are written; the engine, the bot and the rooms are next.",
  credit: "A free fan project. Inspired by the card-driven design of Twilight Struggle; not affiliated with GMT Games.",
  nav: { rules: "Rules", hub: "csiesheep games", lang: "中文" },
  sides: { qin: "Qin", chu: "Chu" },
  names: { qin: ["Fan Ju", "Sima Cuo", "Wang He"], chu: ["Zhao Yang", "Qu Gai", "Xiang Yan"] },
  setup: { defaultName: "Player" },
  sys: { joined: "{name} joined.", left: "{name} left.", leftGame: "{name} left; the bot plays the seat.", dealt: "The cards are dealt.", timeout: "{name} ran out of time; the table decided.", over: "{side} ({name}) wins: {reason}." },
  ends: { unification: "three states destroyed", alliance: "four seals held", mandate: "the Mandate reached 20", collapse: "the realm collapsed on the other side", scoring: "the other side held a scoring card at the turn's end", scoringBoth: "both held scoring cards; the tie rule", final: "the Mandate after the final scoring", tie: "a level Mandate; the tie rule" },
  errors: { noRoom: "No room with that code.", full: "That room is full.", needMore: "Two seats are needed.", notReady: "The other seat is not ready.", notYet: "The table is not built yet.", notYourTurn: "It is not your decision right now." },
};

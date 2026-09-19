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
  nav: { back: "‹ Zongheng", rules: "Rules", hub: "csiesheep games", lang: "中文" },
  // The rules page's 72nd row: the Nine Cauldrons aren't in shared/cards.js
  // (they're the engine's special `st.jiuding` card, not a CARDS entry), so
  // rules.js can't read this name/text off the deck the way it does for the
  // other 71. Wording matches the existing "Nine Cauldrons" sentence in this
  // file's rules page prose (see rules.js's own specialText).
  rules: { jiuding: "The Nine Cauldrons", jiudingText: "4 ops, 5 if all of it lands in the Three Jin or Zhou; place, campaign or lobby only; then it passes face down and the other side may use it from the next turn; Chu holds it at the start." },
  sides: { qin: "Qin", chu: "Chu" },
  names: { qin: ["Fan Ju", "Sima Cuo", "Wang He"], chu: ["Zhao Yang", "Qu Gai", "Xiang Yan"] },
  setup: { defaultName: "Player" },
  sys: { joined: "{name} joined.", left: "{name} left.", leftGame: "{name} left; the bot plays the seat.", dealt: "The cards are dealt.", timeout: "{name} ran out of time; the table decided.", over: "{side} ({name}) wins: {reason}." },
  ends: { unification: "three states destroyed", alliance: "four seals held", mandate: "the Mandate reached 20", collapse: "the realm collapsed on the other side", scoring: "the other side held a scoring card at the turn's end", scoringBoth: "both held scoring cards; the tie rule", final: "the Mandate after the final scoring", tie: "a level Mandate; the tie rule" },
  errors: { noRoom: "No room with that code.", full: "That room is full.", needMore: "Two seats are needed.", notReady: "The other seat is not ready.", notYet: "The table is not built yet.", notYourTurn: "It is not your decision right now." },
  landing: { backToRoom: "Back to room {code}", resume: "Resume your game", play: "Play vs bot", create: "Multiplayer", join: "Join", code: "Room code", codePlaceholder: "CODE", rulesLink: "Rules and the 72 cards", name: "Your name" },
  side: {
    qin: { headline: "the Horizontal", sub: "Pick the states off one by one.", cta: "Play as Qin" },
    chu: { headline: "the Vertical", sub: "Bind the states together.", cta: "Play as Chu" },
  },
  lobby: { say: "Say something", title: "Room", hint: "Share the code, or add the bot for the other seat. A player who drops is played by the bot until they return.", you: "you", host: "host", bot: "bot", away: "away", ready: "Ready", notReady: "Not ready", addBot: "Add bot", removeBot: "Remove bot", swap: "Swap sides", start: "Start", leave: "Leave", rematch: "Rematch (sides swap)", waiting: "Waiting for the host to start.", connecting: "Connecting…", closed: "The connection closed.", clock: "{s} s" },
  setup: {
    defaultName: "Player", title: "Play vs bot", side: "Your side", random: "Random", randomTag: "either court", level: "Opponent", easy: "Easy", normal: "Normal", hard: "Hard", start: "Start", back: "Back",
    desc: {
      qin: "You play Qin: pick the states off one by one. Eight turns, about an hour; the game saves itself in this browser.",
      chu: "You play Chu: bind the states together. Eight turns, about an hour; the game saves itself in this browser.",
      random: "Your side is picked at random when you start. Eight turns, about an hour; the game saves itself in this browser.",
    },
  },
  eras: { reform: "Reform era", alliance: "Alliance era", conquest: "Conquest era" },
  tracks: { mandate: "Mandate", weariness: "Weariness", reform: "Reform", seals: "Seals", mie: "Destroyed", jiuding: "Cauldrons", faceDown: "face down", turn: "Turn", round: "Action", of: " of " },
  weariness: { 5: "Peace", 4: "War", 3: "Strife", 2: "Misery", 1: "Collapse" },
  prompt: {
    setup: "Place {n} free points ({left} left). Tap spaces.", setupBonus: "Place {n} bonus points where you already are ({left} left).",
    headline: "Headline: pick one card face down.", yourAction: "Your action. Pick a card.", wait: "Waiting for {name}…",
    points: "Pick {n} ({left} left).", pointsMin: "Pick up to {n}.", card: "Pick a card.", cardOptional: "Pick a card, or skip.", option: "Choose.", ops: "Spend {ops} ops: how?",
    place: "Placing {ops} ops ({left} left). Tap spaces; 2 per point where the enemy holds control.", campaign: "Campaign with {ops} ops: tap a target.", lobby: "Lobby with {ops} ops: tap a target.",
    over: "Game over.",
  },
  uses: { event: "Event", place: "Place", campaign: "Campaign", lobby: "Lobby", reform: "Reform", bog: "Discard (bogged)", pair: "Pair with", opsFirst: "Ops first", eventFirst: "Event first" },
  buttons: { send: "Send", board: "View the board", result: "Result", confirm: "Confirm", done: "Done", cancel: "Cancel", skip: "Skip", playAgain: "Play again", swap: "Swap sides", home: "Home", headline: "Commit headline", show: "Show", hide: "Hide", log: "Log" },
  preview: { campaign: "Removes {removed} of theirs, places {placed} of yours; weariness {w}.", lobby: "Edge {edge}: removes up to {n}.", locked: "Locked by weariness.", enemyEvent: "This is their card: its event will happen too." },
  over: { winner: "{side} wins", reasons: { unification: "Three states destroyed", alliance: "Four seals held", mandate: "The Mandate reached 20", collapse: "The realm collapsed", scoring: "A scoring card was held at the turn's end", scoringBoth: "Both held scoring cards", final: "Final scoring", tie: "Level Mandate, the tie goes to Chu" }, mandate: "Final Mandate" },
  log: {
    setup: "{side} sets up: {spaces}.", turn: "Turn {turn}, {era}.", headline: "Headlines: {qin} and {chu}; {first} first.", play: "{side} plays {card} ({use}).",
    place: "{side} places in {spaces}.", campaign: "{side} campaigns in {target} with {ops}: removes {removed}, places {placed}.", lobby: "{side} lobbies in {target}: removes {removed}.",
    score: "{region} scores: Qin {q}, Chu {c}.", vp: "Mandate {mandate}.", tire: "Weariness falls to {to}.", seal: "Chu holds the seal of {state}.", unseal: "Chu loses the seal of {state}.",
    mie: "Qin destroys {state}.", restore: "{state} is restored.", reform: "{side} reaches reform box {box}.", jiuding: "The Cauldrons pass to {side}, face down.", discard: "{side} discards {card}.",
    bog: "{side} is bogged down and discards {card}.", skip: "{side} has no card to play.", opsLost: "{side} has nowhere to spend {ops} ops.", reshuffle: "The discards are reshuffled.", era: "The {era} deck is shuffled in.",
    endTurn: "Turn {turn} ends; weariness {weariness}.", over: "Game over: {side}, {reason}.",
  },
  useNames: { event: "event", place: "place", campaign: "campaign", lobby: "lobby", reform: "reform", bog: "bog" },
};

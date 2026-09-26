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
  // #62 part 2: "home" is the back link's aria-label/title ONLY once the bar
  // is tight enough to drop its own word (app.js's syncBackLabel()) -- the
  // full "‹ Zongheng" stays the visible text and the spoken name otherwise.
  nav: { back: "‹ Zongheng", backGame: "‹ Back to the game", rules: "Rules", hub: "csiesheep games", lang: "中文", home: "Home" },
  // The rules page's 72nd row: the Nine Cauldrons aren't in shared/cards.js
  // (they're the engine's special `st.jiuding` card, not a CARDS entry), so
  // rules.js can't read this name/text off the deck the way it does for the
  // other 71. Wording matches the existing "Nine Cauldrons" sentence in this
  // file's rules page prose (see rules.js's own specialText).
  rules: {
    jiuding: "The Nine Cauldrons", jiudingText: "4 ops, 5 if all of it lands in the Three Jin or Zhou; foster, raid or lobby only; then it passes face down and the other side may use it from the next turn; Chu holds it at the start.",
    // #40: the rules page's sticky section-nav chip labels, in the same
    // order as rules.js render()'s h2s; "top" is the fixed last chip.
    // #91: "special" renamed from "Special" to name what it now only covers
    // (destruction/seals moved out to their own "mie" section below).
    nav: { ends: "Endings", board: "Map", control: "Control", uses: "Uses", tracks: "Tracks", special: "Cauldrons & Luoyi", mie: "Destruction & Seals", turn: "Turn", scoring: "Scoring", cards: "Cards", top: "Top ↑" },
    search: "Search card name…",
    eraFilter: { all: "All", reform: "Reform", alliance: "Alliance", conquest: "Conquest" },
    sideFilter: { all: "All", qin: "Qin", chu: "Chu", neutral: "Neutral", scoring: "Scoring" },
    count: "{n} cards",
    empty: "No cards match.",
    // #44: the desktop two-tab labels, and the hint shown in the card panel
    // before anything is chosen.
    tabs: { rules: "Rules", cards: "The 72 cards" },
    pickHint: "Pick a card from the list to see it here.",
    // #45 round 1: the desktop tile's own second line — every undated card
    // still needs one (never just the name alone): a plain card shows
    // "undated", a scoring card shows its own era, the Nine Cauldrons shows
    // "every era" (it isn't tied to one — see rules.js's own note on
    // era === "").
    undated: "undated",
    everyEra: "every era",
  },
  sides: { qin: "Qin", chu: "Chu", neutral: "Neutral", scoring: "Scoring card" },
  // #51: with the control ring gone and only tone left (black/red = control,
  // grey/pink = influence without control), "who controls" is no longer
  // legible without colour vision alone -- the hit button's title spells out
  // both counts and the controller (hitInf, controls) so it doesn't rely on
  // the tone.
  map: {
    hitTitle: "{space} · stability {stability}", hitInf: "Qin {qin} Chu {chu}", controls: "{side} controls",
    // #90: the sealed capital mark itself is a fixed 「印」 chop drawn straight
    // in app.js (not translated -- it's a mark, not a word, same in en). This
    // key is the one-line explanation shown in the prompt area when the
    // status line's Seals value is tapped.
    sealHelp: "A seal needs Chu's control of the capital AND a full stack there (stability + 2)",
  },
  names: { qin: ["Fan Ju", "Sima Cuo", "Wang He"], chu: ["Zhao Yang", "Qu Gai", "Xiang Yan"] },
  sys: { joined: "{name} joined.", left: "{name} left.", leftGame: "{name} left; the bot plays the seat.", dealt: "The cards are dealt.", timeout: "{name} ran out of time; the table decided.", over: "{side} ({name}) wins: {reason}.", fallback: "The opponent's move failed; a fallback was played instead: {action}.", stuck: "The opponent cannot move; this game cannot continue." },
  ends: { unification: "three states destroyed", alliance: "four seals held", mandate: "the Mandate reached 20", collapse: "the realm collapsed on the other side", scoring: "the other side held a scoring card at the turn's end", scoringBoth: "both held scoring cards; the tie rule", final: "the Mandate after the final scoring", tie: "a level Mandate; the tie rule" },
  errors: { noRoom: "No room with that code.", full: "That room is full.", needMore: "Two seats are needed.", notReady: "The other seat is not ready.", notYet: "The table is not built yet.", notYourTurn: "It is not your decision right now." },
  landing: { backToRoom: "Back to room {code}", resume: "Resume your game", play: "Play vs bot", create: "Multiplayer", join: "Join", code: "Room code", codePlaceholder: "CODE", rulesLink: "Rules and the 72 cards", rulesShort: "Rules", name: "Your name" },
  side: {
    qin: { headline: "the Horizontal", sub: "Pick the states off one by one.", cta: "Play as Qin" },
    chu: { headline: "the Vertical", sub: "Bind the states together.", cta: "Play as Chu" },
  },
  lobby: { say: "Say something", title: "Room", hint: "Share the code, or add the bot for the other seat. A player who drops is played by the bot until they return.", you: "you", host: "host", bot: "bot", away: "away", empty: "Empty seat", ready: "Ready", notReady: "Not ready", addBot: "Add bot", removeBot: "Remove bot", swap: "Swap sides", start: "Start", leave: "Leave", rematch: "Rematch (sides swap)", waiting: "Waiting for the host to start.", connecting: "Connecting…", closed: "The connection closed.", clock: "{s} s", gateHint: "Pick a name before you sit down. It can't be changed in the room.", join: "Enter", copy: "Copy link", copied: "Copied" },
  setup: {
    defaultName: "Player", title: "Play vs bot", side: "Your side", random: "Random", randomTag: "either court", level: "Opponent", easy: "Easy", normal: "Normal", hard: "Hard", start: "Start", back: "Back",
    desc: {
      qin: "You play Qin: pick the states off one by one. Eight turns, about an hour; the game saves itself in this browser.",
      chu: "You play Chu: bind the states together. Eight turns, about an hour; the game saves itself in this browser.",
      random: "Your side is picked at random when you start. Eight turns, about an hour; the game saves itself in this browser.",
    },
    // #97: startSolo() used to silently overwrite the save -- shown as a
    // confirm sheet (not window.confirm) only when a save actually exists.
    overwriteWarn: "Starting a new game will overwrite your current save (turn {n}).",
  },
  eras: { reform: "Reform era", alliance: "Alliance era", conquest: "Conquest era" },
  tracks: { mandate: "Mandate", weariness: "Weariness", reform: "Reform", seals: "Seals", mie: "Destroyed", jiuding: "Cauldrons", faceDown: "face down", turn: "Turn", round: "Action", of: " of " },
  // #41: the short tag on a space's last-move mark when its state's
  // destroyed flag just flipped (checkMarkers()'s mie/restore) -- not the
  // full log sentence (that stays in log.mie/log.restore above), a badge a
  // few px wide next to the disc.
  lastMove: { destroyed: "Fell", restored: "Restored" },
  weariness: { 5: "Peace", 4: "War", 3: "Strife", 2: "Misery", 1: "Collapse" },
  prompt: {
    setup: "Place {n} ({left} left): any space in {regions}.", setupBonus: "Place {n} bonus influence where you already are ({left} left).",
    headline: "Commit one card face down as the headline: both reveal together, higher ops resolves first, and its event always happens.",
    // #60: what the log/sidebar says the BOT did, not what the player is
    // told to do -- see actionText()'s own comment in app.js.
    headlineDone: "committed a headline",
    yourAction: "Your action. Pick a card.", wait: "Waiting for {name}…",
    points: "Pick {n} ({left} left): tap a highlighted space.", pointsMin: "Pick up to {n}: tap a highlighted space.", card: "Pick a card.", cardOptional: "Pick a card, or skip.", option: "Choose.", ops: "Spend {ops} ops: how?",
    // #109: shortened again -- #107's own shortening still ran 454px in a
    // 339px box at 375 (354px at 390), both measured on the placement-time
    // copy that lives on (a) #promptText at 13px in the normal case and
    // (b) the compact sheet's `.sheet-title` at 12.5px whenever the map's
    // own give-way (style.css's `#sheet.sheet-compact .sheet-title`, a
    // deliberate single-line nowrap+ellipsis -- see its own comment) is
    // active, which it is for nearly every real "Foster" pick at this
    // width (a lit map plus the ops/order sheet already fills the budget).
    // That single-line path can't wrap, so shortening (not wrapping) is
    // the fix here -- measured (canvas-metrics, same font/weight) at
    // 258.5px/248.5px (13px/12.5px) with single-digit {ops}/{left}, comfortably
    // under even the 320-wide case's 284px box, not just 375/390's wider ones.
    place: "Foster {ops} ({left} left): fixed spaces, 2/pt enemy.", campaign: "Raid with {ops} ops: tap a target.", lobby: "Lobby with {ops} ops: tap a target.",
    over: "Game over.",
    // #97: always on, independent of the advisor -- shown once the actions
    // left this round are at most the scoring cards still in hand.
    // #102 item 3 (orchestrator: "1 action(s) left ... 1 scoring card(s)
    // ..." isn't real English): {n} and {m} can each be 1 or more
    // independently, so each noun gets its own one/other pair --
    // app.js's scoringWarnText() picks one/other per count, then stitches
    // the two clauses into `full`. zh-Hant.js's own copy doesn't inflect on
    // number at all, so its one/other pairs are identical (see that file's
    // own comment) rather than this structure being English-only.
    // #102 item 3 round 2 (orchestrator: "...play them..." is wrong with
    // exactly one scoring card): the verb pronoun pluralizes on the SAME
    // {m} count as `card` above, split the same way -- app.js's
    // scoringWarnText() picks one/other for this too and feeds the result
    // into `full` as {verb}.
    scoringWarn: {
      action: { one: "{n} action left this round", other: "{n} actions left this round" },
      card: { one: "{m} scoring card in hand", other: "{m} scoring cards in hand" },
      verb: { one: "play it", other: "play them" },
      full: "{action}; {card}: {verb} before the turn ends, or you lose.",
    },
  },
  uses: { event: "Event", place: "Foster", campaign: "Raid", lobby: "Lobby", reform: "Reform", bog: "Discard (bogged)", pair: "Pair with", opsFirst: "Ops first", eventFirst: "Event first" },
  buttons: { send: "Send", board: "View the board", result: "Result", confirm: "Confirm", done: "Done", cancel: "Cancel", skip: "Skip", playAgain: "Play again", swap: "Swap sides", home: "Home", headline: "Commit headline", show: "Show", hide: "Hide", log: "Log", logChat: "Log and chat", expand: "Card", close: "Close", resumeSolo: "Resume game", newGame: "New game" },
  // #97: the always-on "must play" tag on a scoring card in hand -- a
  // separate short label (badge) and a longer sentence (its `title`), never
  // the prompt-area/pinned-area line above (that one adds the count).
  hand: { mustPlay: "Must play", mustPlayTitle: "A scoring card held at the turn's end loses" },
  preview: { campaign: "Removes {removed} of theirs, places {placed} of yours; weariness {w}.", lobby: "Edge {edge}: removes up to {n}.", locked: "Locked by weariness.", enemyEvent: "This is their card: its event will happen too." },
  // The result screen's colour and art always follow the WINNER, not your
  // own seat, so each ending's line and body read as fact from the table,
  // and only `win`/`lose` (which side of that fact you were on) changes with
  // the viewer. `{winner}`/`{loser}` fill in with that side's name.
  over: {
    winner: "{side} wins", mandate: "Final Mandate",
    reasons: {
      // #113: `watch` is the spectator's own third line -- never "you", read
      // by nobody's seat. Kept as its own key rather than reused from
      // `win`/`lose` (per the issue) so a seated player's text can keep
      // saying "you" without a spectator ever hearing it.
      unification: { title: "Qin unites the realm", body: "Three states destroyed: the map answers to Qin alone.", win: "You win. The realm is united under Qin.", lose: "You lose. Qin unites the realm.", watch: "Qin unites the realm." },
      alliance: { title: "The Vertical holds", body: "Four seals held: Qin cannot break what is bound together.", win: "You win. The Vertical holds.", lose: "You lose. The Vertical holds against you.", watch: "Chu's alliance holds." },
      mandate: { title: "{winner} carries the Mandate", body: "The Mandate reached twenty: the realm has decided for {winner}.", win: "You win. The Mandate is yours.", lose: "You lose. The Mandate turned to {winner}.", watch: "{winner} carries the Mandate." },
      collapse: { title: "The realm gives out on {loser}", body: "Weariness ran out before {winner} had to spend the last of it.", win: "You win. The realm gave out under them first.", lose: "You lose. The realm gave out under you first.", watch: "The realm gives out on {loser} first." },
      scoring: { title: "A card left in hand", body: "A scoring card was still in hand when the turn ended; the tally falls to {winner}.", win: "You win. They were still holding a scoring card.", lose: "You lose. The scoring card was still in your hand.", watch: "{loser} was still holding a scoring card." },
      scoringBoth: { title: "Both still holding", body: "Both sides were still holding a scoring card; the tally falls to {winner} regardless.", win: "You win. Both of you were still holding a scoring card, and the tally favours you.", lose: "You lose. Both of you were still holding a scoring card, and the tally favours {winner}.", watch: "Both sides were still holding a scoring card; the tally favours {winner}." },
      final: { title: "The tally closes", body: "Turn eight closed with the Mandate favouring {winner}.", win: "You win. The Mandate favoured you at the end.", lose: "You lose. The Mandate favoured {winner} at the end.", watch: "The Mandate favoured {winner} at the end." },
      tie: { title: "Level Mandate, {winner}'s tie", body: "The Mandate was level; the tie rule favours {winner}.", win: "You win. The Mandate was level, and the tie favours you.", lose: "You lose. The Mandate was level, and the tie favours {winner}.", watch: "The Mandate was level, and the tie favours {winner}." },
    },
  },
  log: {
    setup: "{side} sets up: {spaces}.", turn: "Turn {turn}, {era}.", headline: "Headlines: {qin} and {chu}; {first} first.",
    // #58 (found by the orchestrator reviewing #57, not the owner): a side
    // whose deal ran dry commits no headline. The preceding log.skip line
    // ("{side} has no card to play.") already says the empty side has no
    // card, so headlineOne doesn't repeat that -- it only closes the loop
    // ("commits none"), to keep the pair from reading as a stutter.
    headlineOne: "{side}'s headline: {card}; {other} commits none.",
    headlineNone: "Both sides have no card; the headline phase is skipped.",
    play: "{side} plays {card} ({use}).",
    place: "{side} fosters in {spaces}.", campaign: "{side} raids in {target} with {ops}: removes {removed}, places {placed}.", lobby: "{side} lobbies in {target}: removes {removed}.",
    score: "{region} scores: Qin {q}, Chu {c}.", vp: "Mandate {mandate}.", tire: "Weariness falls to {to}.", seal: "Chu holds the seal of {state}.", unseal: "Chu loses the seal of {state}.",
    mie: "Qin destroys {state}.", restore: "{state} is restored.", reform: "{side} reaches reform box {box}.", jiuding: "The Cauldrons pass to {side}, face down.", discard: "{side} discards {card}.",
    bog: "{side} is bogged down and discards {card}.", skip: "{side} has no card to play.", opsLost: "{side} has nowhere to spend {ops} ops.", reshuffle: "The discards are reshuffled.", era: "The {era} deck is shuffled in.",
    endTurn: "Turn {turn} ends; weariness {weariness}.", over: "Game over: {side}, {reason}.",
  },
  // #88 (design A, one row per move): the log panel's own short strings --
  // section headers, one move's own title line, and the chips under it. See
  // zh-Hant.js's own logPanel comment for which chips reuse the oppmove.*
  // strings instead of a new key here.
  logPanel: {
    filterAll: "All", filterQin: "Qin", filterChu: "Chu", filterChat: "Chat",
    setupHeader: "Setup", turnHeader: "Turn {turn} · {era}", round: "Move {round}",
    headlineLine: "Headlines: {qinSide} {qinCard} · {chuSide} {chuCard}", headlineFirst: "{first} resolves first",
    chipPlace: "{space} +{n}", chipRemove: "{target}: removes {n} {side}",
    chipReform: "Reform → box {box}", chipTire: "Weariness → {to}",
    chipDiscard: "{side} discards {card}", chipOpsLost: "{side} has nowhere to spend {ops} ops",
    // #115: an event's own entries. An enemy card spent for ops used to show
    // only its ops, whether its event happened or had nothing to do. {side}
    // is the event's owner, not the player who played the card.
    chipEvent: "{side}'s event: {card}", chipEventNone: "no effect: {why}",
    eventWhy: { noTarget: "nothing it could target", noChange: "nothing changed (at the cap, nothing to remove, or already in play)" },
    chipChose: "chosen by {side}", chipInf: "{space} {side} {d}", chipEffectOn: "In play: {card}", chipEffectOff: "Ends: {card}", chipDraw: "{side} hand {d}",
    // #115: the card paired with The Lobbyist (its ops are spent, its event does not fire).
    pairWith: "with {side}'s {card} (its event does not fire)",
    close: "Hide",
  },
  // #79/#87: the opponent's-move reveal -- the card panel (①, which waits
  // for its own tap) and the map playback (②). #85's persistent chip and
  // its bottom sheet are gone (#87). oppmove-ui.js is the only file that
  // reads this section.
  oppmove: {
    playedTag: "{side} played", useOps: "For {use} · {ops} ops",
    useEvent: "Played as event", useScoringEvent: "Scoring card · played as event",
    eventMine: "This is {side}'s card -- its event happens for you too: {text}",
    eventNeutral: "A neutral card -- its event happens for you too: {text}",
    eventTheirs: "Event: {text}", eventHeadline: "Headline: {text}",
    tapHint: "Tap to continue",
    tickerPlace: "{side} fosters {n} at {space}", tickerCampaign: "{side} raids {target}: removes {removed}, places {placed}",
    tickerLobby: "{side} lobbies {target}: removes {removed}", tickerReform: "{side}'s reform reaches box {box}",
    // The change and who got it, e.g. "Mandate Chu +1" -- never the resulting
    // total alone (that reads as the OTHER side's number). tickerMandateArrow
    // is appended only when the total is worth showing alongside the change.
    tickerMandate: "Mandate {side} +{n}", tickerMandateArrow: " → {to}",
    tickerScore: "{region} scores: Qin {q}, Chu {c}",
    tickerTire: "Weariness falls to {to}", tickerSeal: "Chu gains {state}'s seal",
    tickerUnseal: "Chu loses {state}'s seal", tickerMie: "Qin destroys {state}", tickerRestore: "{state} is restored",
    tickerJiuding: "The Cauldrons pass face down to {side}", tickerFinal: "Changes from the event",
    // #115: an event starting, and an event with no effect. What it changed reuses logPanel's chipInf etc.
    tickerEvent: "{side}'s event: {card}", tickerEventNone: "{side}'s event {card} has no effect: {why}",
  },
  useNames: { event: "event", place: "foster", campaign: "raid", lobby: "lobby", reform: "reform", bog: "bog" },
  scoringLevel: { none: "None", presence: "Presence", domination: "Domination", control: "Control" },
  regionShort: { west: "West", jin: "Three Jin", zhou: "Zhou", east: "East", south: "South", north: "North" },
  tutorial: {
    button: "Tutorial · 5 minutes",
    intro: { kicker: "Tutorial · about 5 minutes", title: "Into the Warring States", sub: "First steps in the Warring States", text: "You play Qin. In ten short steps you take a space, use a card four ways, fight one raid, and destroy the state of Han. The other side follows a script, so nothing can go wrong.", start: "Start", notNow: "Not now" },
    skip: "Skip the tutorial", back: "Back", stepOf: "Step {n} of {total}", topbar: "Tutorial {n}/{total}", gotIt: "Got it",
    wrong: "Tap the highlighted spot.",
    steps: {
      map: { title: "The map", text: "26 spaces in five regions plus Zhou; a star marks a battleground. A disc's colour is influence: black is Qin, red is Chu; grey and pink mean influence without control.", do: "Tap {space}" },
      control: { title: "Control", text: "Control needs yours at least theirs plus stability; the cap is stability + 2. {space}: {qin} is at least {chu} plus {stability}, so it's yours.", do: "Tap {space}" },
      hand: { title: "Your hand", text: "The round badge is the card's points. Black carries Qin's event, red Chu's, white nobody's. A card has five uses; start with the simplest, foster.", do: "Tap the lit card" },
      place: { title: "Foster", text: "1 op places 1 point, where you already stand or next to any space where you have influence, fixed when the action starts; 2 ops per point into enemy control. {n} into {space}: {qin} is at least {chu} plus {stability}, so it's yours.", do: "Tap {space} {n} times" },
      event: { title: "Event", text: "Play your own card for its event: {card}, reform +1. First to arrive scores, but the unlock matters more.", do: "Choose Event" },
      enemyCard: { title: "An enemy card", text: "Spend the other side's card for ops; its event still happens. You choose which goes first.", do: "Choose ops first" },
      campaign: { title: "Raid", text: "Remove up to {n} of theirs, place the rest as yours. A battleground tires the realm by one; pushing it to {to} loses.", do: "Confirm the raid on {space}" },
      lobby: { title: "Lobby", text: "Edge is your controlled neighbours minus theirs. Remove up to {n}, capped by the edge. It places nothing and never tires the realm.", do: "Lobby {space}" },
      scoring: { title: "Scoring", text: "Play Three Jin scoring: presence, domination or control, plus 1 per battleground; the gap moves the Mandate. A scoring card left in hand loses.", do: "Play the scoring card" },
      destroy: { title: "Destroy a state", text: "Qin controls every space of a state and it is destroyed: {state} falls, Qin +{n}. Three states and Qin wins. Tutorial complete.", do: "Finish" },
    },
    done: {
      title: "{state} Destroyed", sub: "{state} is destroyed. Tutorial complete.",
      lead: "You know what a real game needs. A game ends one of six ways:",
      ends: ["Qin destroys three states", "Chu holds four seals", "The Mandate reaches 20", "Someone pushes weariness to Collapse", "A scoring card is left in hand at turn's end", "After turn 8, the Mandate leader (a tie goes to Chu)"],
      also: "Not covered here: how headlines set the order, how the Cauldrons get lent out, who Luoyi pays, how a seal counts toward alliance, and what reform unlocks. It's all in the rules.",
      play: "Play vs bot · Easy", replay: "Replay", rules: "Rules", home: "Home",
    },
  },
  // #62: the two switches (landing bar, table's 紀錄 panel header, desktop
  // side foot) -- same "label" + "on/off aria-label" shape as advisor.* below.
  // #62 part 2 (owner's revision): one switch, one pair of strings -- the
  // six part-1 keys (sfx/music/sfxOn/sfxOff/musicOn/musicOff) are gone,
  // nothing references them any more.
  audio: { on: "Sound on", off: "Sound off" },
  // #72: the opening video's start layer (plays every visit; ?opening still
  // forces it too). "tap" is the accessible name of the whole layer's hit
  // button; "skip" is the bottom-centre pill that ends it without playing.
  opening: { tap: "Tap to begin", skip: "Skip ›" },
  advisor: {
    name: "Advisor",
    on: "Advisor on", off: "Advisor off",
    thinking: "The advisor is thinking",
    suggestCard: {
      event: "Play {card} for its event.",
      place: "Foster with {card} in {space}.",
      // #60: no target chosen yet (an opponent's card, event first --
      // bannerTitle() in advisor-ui.js picks these when {space} is empty).
      placeNoTarget: "Foster with {card}.",
      campaign: "Raid in {space} with {card}.",
      campaignNoTarget: "Raid with {card}.",
      lobby: "Lobby {space} with {card}.",
      lobbyNoTarget: "Lobby with {card}.",
      // #117: when The Lobbyist is paired with an enemy card, the suggestion
      // names that card too -- "play it alone" used to be the only sentence
      // the banner could form for it. Only place/campaign/lobby ever get
      // paired (shared/bots.js's own candidate list), so event/reform need
      // no *Paired sibling.
      placePaired: "Foster with {card}, paired with {pair}, in {space}.",
      placePairedNoTarget: "Foster with {card}, paired with {pair}.",
      campaignPaired: "Raid in {space} with {card}, paired with {pair}.",
      campaignPairedNoTarget: "Raid with {card}, paired with {pair}.",
      lobbyPaired: "Lobby {space} with {card}, paired with {pair}.",
      lobbyPairedNoTarget: "Lobby with {card}, paired with {pair}.",
      reform: "Reform with {card}.",
      score: "Play {card} now.",
      bog: "Discard {card}.",
    },
    suggestUse: {
      event: "Play it for its event.",
      place: "Foster in {space}.",
      campaign: "Raid in {space}.",
      lobby: "Lobby {space}.",
      reform: "Use it to reform.",
      score: "Play it now.",
      bog: "Discard it.",
    },
    suggestTarget: "Target: {space}",
    suggestOrder: { opsFirst: "Spend the ops first, then let the event happen.", eventFirst: "Trigger the event first, then spend the ops." },
    suggestHeadline: "Commit {card} as the headline.",
    suggestSetup: "Place {n} influence in {space}.",
    // #105 addendum: suggestSetup is for the setup phase only (see above);
    // an in-progress Foster mid-card (e.g. Guest Ministers' two-tap place)
    // hits the same opsUse === "place" branch, but the button already
    // reads "Foster", so this can't say "Place" again -- see
    // advisor-ui.js's bannerTitle() branch on opsUse.
    continuePlace: "Foster {n} in {space}.",
    // #69 addendum: a pending "card"/"option" choice (the end-of-round
    // discard, and every cards.js card/option pick -- 呂不韋/韓非入秦/春申君/
    // 細作 among them) names no map space, so it fell through bannerTitle()
    // to nothing at all until this. `discard`/`retrieve`/`choose` are the
    // three verbs a "card" pick's own source can mean (advisor-ui.js's
    // cardPickVerb() picks one); `skip` deliberately names no count (any
    // number of cards can be on offer); `option` wraps whatever label the
    // pending's own options array already carries (cards.js, not this file).
    suggestPick: {
      discard: "Discard {card}.",
      retrieve: "Retrieve {card}.",
      choose: "Choose {card}.",
      skip: "Skip -- the hand stays as is.",
      option: "Choose {option}.",
    },
    anyLegal: "Anything lit up is legal. Gold is just the advisor's pick.",
    // #102 item 2 (orchestrator, iPhone screenshot: Chu Conquers Yue open,
    // the banner still read the Sima Cuo suggestion with nothing to say
    // it wasn't about THIS card): the banner's first line when a card page
    // is open for a card other than the one the advisor is suggesting --
    // the reason line underneath keeps explaining the ACTUAL suggestion,
    // unchanged (advisor-ui.js's setBannerText()).
    notThisCard: "The advisor suggests {card}, not this card.",
    reasons: {
      takeControl: "This takes control of {space}.",
      breakControl: "This breaks their control of {space}.",
      battleground: "{space} is a battleground, worth an extra point at scoring.",
      scoringSoon: "You hold a {region} scoring card, so get this region ready first.",
      destroyState: "This destroys {state}.",
      nearDestroy: "{state} is {n} away from falling.",
      seal: "This gets the seal of {state}.",
      denySeal: "This stops Chu from taking the seal of {state}.",
      mandate: "This moves the Mandate {n} toward you.",
      reform: "This advances reform and unlocks a new power.",
      dumpEnemyEvent: "Spend this enemy card now. Its event does the least damage here.",
      bogDiscard: "Bogged down, you must discard. Drop {card}: its event won't happen.",
      mustPlayScoring: "A scoring card held at the turn's end loses. Play it now.",
      avoidCollapse: "Weariness is already high. This move won't push it further.",
      best: "The best available move right now.",
    },
  },
  // #29: the full card page's one-line "what kind of card is this" note —
  // own event, a shared neutral card, the other side's card, or a scoring
  // card. Fixed copy from the issue's own table, not templated with a live
  // tally (renderPromptAndSheet still shows the fuller scoring tally
  // separately, via scoringPanel).
  sheet: {
    // #71 (owner, iPhone screenshot): replaces sheet.hint.enemy below while
    // no order is chosen yet on an opponent's card (place/campaign/lobby);
    // sheet.hint.enemy itself stays put further down once an order is picked.
    chooseOrder: "Choose the order first: ops first, or event first.",
    // #100 (owner, UX audit item 4): a Confirm tap or a map tap with no use
    // chosen yet used to do nothing at all -- app.js's flashUseWarning()
    // shows this under the use row until a use is actually picked.
    pickUseFirst: "Pick a use first",
    // #123 (owner: King Huai Enters Qin played for ops at 民困/Populace
    // Hardship, its event pushed weariness to Collapse, no warning at all):
    // whether the event would push weariness to Collapse is decided by
    // actually simulating it on a clone, E.eventWouldCollapse (shared/
    // engine.js) -- never read off the card's text. Applies to every use
    // that fires the event (the event itself, or an enemy card's ops --
    // place/campaign/lobby, either order); Reform and pairing with The
    // Lobbyist never fire it. {uses} is collapseSafe's own list of which of
    // THIS card's uses are safe (app.js's safeUsesFor()).
    collapseWarn: "This card's event would push the realm to Collapse on your action — you would lose at once.",
    collapseSafe: "{uses} would not trigger it — safe.",
    collapsePairSafe: "pairing it with {shuoke}",
    // #117: The Lobbyist's pairing choice -- pick an enemy card from hand to
    // play with it, or explicitly choose not to. {enemy} is the other side's
    // name (Qin/Chu). none/noEnemy/eventReason cover the three states: chose
    // not to pair, no enemy card to pair with, and why the event use is
    // turned off (playing The Lobbyist alone has an empty effect() --
    // shared/cards.js).
    shuoke: {
      explain: "The Lobbyist: pick a {enemy} card from your hand to play with it — you use that card's ops, its event doesn't fire, and both go to the discard pile.",
      none: "Don't pair — play alone",
      noEnemy: "No {enemy} card in hand: The Lobbyist can only be played alone, for 1 op.",
      eventReason: "The Lobbyist alone has no event.",
    },
    hint: {
      own: "Your own event: it happens when you play it.",
      neutral: "A neutral card: the event or the ops, never both.",
      // #117: The Lobbyist is neutral, but "the event or the ops" is wrong
      // for it -- its real play is pairing with an enemy card (see
      // shuoke.explain above, already shown right above the pairing choice
      // on the card page; this is just the short classification line).
      shuoke: "The Lobbyist: paired with a {enemy} card, using its ops.",
      enemy: "An enemy card: you use the ops, and its event still happens; you choose the order.",
      score: "A scoring card: it must be played this turn.",
      // #34: the read-only peek sheet's own one-line hint (owner-authorised
      // copy) — {side} is the seat who played/discarded/headlined it, not
      // the viewer's own seat, so it reads the same for either player.
      played: "Played by {side}.",
    },
    // #35: the read-only card view's own extra facts (side/removal, shown on
    // the header's second line by card-view.js) and the history section
    // below the card text (shown only when stories.js has an entry for the
    // card).
    removeYes: "Removed after its event.",
    removeNo: "Kept for the discard pile.",
    history: "The history",
    source: "Source: ",
  },
};

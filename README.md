# 縱橫 Zongheng

A two-player card-driven strategy game set in the Warring States. Qin plays the Horizontal (連橫) and picks the states off one by one; Chu plays the Vertical (合縱) and holds the alliance together. Eight turns, about an hour. Solo against a bot, or an online room with a four-letter code. English and Traditional Chinese.

A free fan project under its own name, setting and cards. The play is inspired by the card-driven design of *Twilight Struggle* (Ananda Gupta and Jason Matthews, GMT Games); game rules and mechanics are not copyrightable, and nothing of that game's name, art or text is used. Not affiliated with GMT Games.

Will live at https://games.csiesheep.com/zongheng/ (not deployed yet).

## The game in one paragraph

26 spaces in five scoring regions, with five states (韓 魏 趙 齊 燕) and their capitals drawn inside them. Each turn both players headline a card, then alternate six or seven actions: play a card's event, place influence, 征伐 (a campaign: remove enemy influence, place your own, tire the realm), 遊說 (lobby: remove enemy influence where your neighbours outnumber theirs), or discard it to climb the reform track. Six ways it ends: Qin destroys three states, Chu holds four states' seals, the Mandate track reaches 20, someone pushes weariness to collapse, someone is caught holding a scoring card, or eight turns run out and every region scores.

The rules are in the owner's vault (`Projects/zongheng/zongheng - rulebook.md`) and will be on the rules page.

## How it works

Everything runs on Cloudflare as one Worker, the same shape as [Tiandihui](https://github.com/csiesheep/tiandihui):

- `public/` is the client: landing, setup, lobby and the table, served as static assets. `public/shared/board.js` is the map, `engine.js` all rules (state, legal actions, reducer, per-seat view), `cards.js` the 72 cards, `bots.js` the AI, all used unchanged by both the browser and the server. Every player-visible string is in `public/i18n/`.
- `src/index.js` is the Worker: the path-prefix router that serves `/zongheng/…` plus the WebSocket entry point at `/zongheng/ws`.
- `src/room.js` is a Durable Object, one per room, named by its code. It is authoritative: it deals, applies every action through the engine, keeps the clocks, runs the bot seat, and sends each seat only `view(state, seat)`, never the state. Connections use the WebSocket Hibernation API; all timers are the object's single alarm.

URLs are query strings on the page so the same build works at any prefix:

- `/zongheng/` landing
- `/zongheng/?play` solo against a bot
- `/zongheng/?room=ABCD` an online room

## Milestones

1. **M0 Scaffold**: router, board data, placeholder page. This commit; not deployed yet.
2. **M1 Engine**: state, legal actions, reducer, view, the 72 cards, a test per rule and a fuzz test.
3. **M2 Bots**: scored search, three levels, the harness over the rulebook's open numbers.
4. **M3 Solo**: map, tracks, hand, action sheet, scoring overlay, rules page, both languages.
5. **M4 Rooms**: two seats, clocks, bot fill and takeover, reconnect, rematch.
6. **M5 Ship**: SEO, OG image, hub tile, sitemap.

## Develop

```bash
npm install
npm run dev
```

Then open http://localhost:8787/zongheng/.

```bash
npm test          # board, engine and bot tests
npm run sim 400   # bot-vs-bot win rates per rules cell (M2)
```

## Deploy

```bash
npm run deploy
```

Deploys from a logged-in `wrangler`. The routes in `wrangler.jsonc` attach the Worker to `games.csiesheep.com/zongheng` and `/zongheng/*`; the `games` hub Worker keeps the hostname itself. Pushes to `main` do not deploy on their own.

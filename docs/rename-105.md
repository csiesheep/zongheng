# #105: 征伐 → 奇襲 (Raid), 放置 → 扶植 (Foster)

Owner's rename, 2026-09-22. Scope: every player-visible use of the two names,
string values only — no code identifiers, action ids, CSS classes, i18n keys,
test names or log types were touched. The use row now reads
「事件、扶植、奇襲、遊說、變法」/ "Event, Foster, Raid, Lobby, Reform".

## Card text, before / after (`public/shared/cards.js`, `public/i18n/cards.en.js`)

Every card whose text named the 征伐/Campaign use. No card named 放置/Place
(the only two 放置 hits in card text belong to `zhouzuo`'s "打出者在洛邑放
2。" / "Place 2 in Luoyi.", which use the plain verb 放/place, not the use
name — kept, see "Kept on purpose" below).

| Card (id) | zh before | zh after |
|---|---|---|
| 函谷關天險 (hangu) | 持續:楚對西土**征伐**行動點 −2。「五國伐秦」或「合縱攻秦」事件觸發時移除本牌。 | 持續:楚對西土**奇襲**行動點 −2。「五國伐秦」或「合縱攻秦」事件觸發時移除本牌。 |
| 五國伐秦 (wuguo) | 楚對西土任一非要衝據點發動免費**征伐**,行動點 +1,不受疲敝限制;移除「函谷關天險」。 | 楚對西土任一非要衝據點發動免費**奇襲**,行動點 +1,不受疲敝限制;移除「函谷關天險」。 |
| 墨者守城 (mozhe) | 指定 1 個據點,本回合內不可對其**征伐**或遊說。 | 指定 1 個據點,本回合內不可對其**奇襲**或遊說。 |
| 冶鐵與弩機 (yetie) | 持續至回合結束:打出者**征伐**行動點 +1。 | 持續至回合結束:打出者**奇襲**行動點 +1。 |
| 宜陽之戰 (yiyang) | 秦對三晉任一據點發動免費**征伐**,不推進疲敝。 | 秦對三晉任一據點發動免費**奇襲**,不推進疲敝。 |
| 白起 (baiqi) | 持續:秦對三晉、南方**征伐**行動點 +1。 | 持續:秦對三晉、南方**奇襲**行動點 +1。 |
| 合縱攻秦 (hezong) | 楚對西土任一據點發動免費**征伐**,行動點 +2,不受疲敝限制;移除「函谷關天險」。 | 楚對西土任一據點發動免費**奇襲**,行動點 +2,不受疲敝限制;移除「函谷關天險」。 |
| 閼與之戰 (yuyu) | 楚對三晉或西土任一據點發動免費**征伐**,不推進疲敝。 | 楚對三晉或西土任一據點發動免費**奇襲**,不推進疲敝。 |
| 澠池之會 (mianchi) | 疲敝軌後退 1;持續至回合結束:雙方**征伐**行動點 −1。 | 疲敝軌後退 1;持續至回合結束:雙方**奇襲**行動點 −1。 |
| 修長城 (changcheng) | 選 1 區,持續至回合結束:對手在該區**征伐**行動點 −1。 | 選 1 區,持續至回合結束:對手在該區**奇襲**行動點 −1。 |
| 長平之戰 (changping) | 秦對三晉任一據點發動**征伐**,行動點 4 +3;疲敝軌額外前進 1。 | 秦對三晉任一據點發動**奇襲**,行動點 4 +3;疲敝軌額外前進 1。 |
| 王翦滅楚 (wangjian) | 秦對南方任一據點發動**征伐**,行動點 4 +2,不受疲敝限制;疲敝軌額外前進 1。 | 秦對南方任一據點發動**奇襲**,行動點 4 +2,不受疲敝限制;疲敝軌額外前進 1。 |
| 廉頗與李牧 (lianpo) | 持續:秦對三晉、北疆**征伐**行動點 −1。可被「反間」移除。 | 持續:秦對三晉、北疆**奇襲**行動點 −1。可被「反間」移除。 |
| 弭兵之議 (mibing) | 疲敝軌後退 2;持續至回合結束:雙方**征伐**行動點 −1。 | 疲敝軌後退 2;持續至回合結束:雙方**奇襲**行動點 −1。 |
| 兼併小邦 (jianbing) | 打出者對任一非要衝據點發動免費**征伐**,不推進疲敝、不受疲敝限制。 | 打出者對任一非要衝據點發動免費**奇襲**,不推進疲敝、不受疲敝限制。 |

| Card (id) | en before | en after |
|---|---|---|
| Hangu Pass (hangu) | Lasting: Chu's **campaigns** in the West get −2 ops. Leaves the game when Five States Attack Qin or The Alliance Attacks Qin happens. | Lasting: Chu's **raids** in the West get −2 ops. Leaves the game when Five States Attack Qin or The Alliance Attacks Qin happens. |
| Five States Attack Qin (wuguo) | Chu makes a free **campaign** in a West space that is not a battleground, with +1 op, ignoring weariness locks. Hangu Pass leaves the game. | Chu makes a free **raid** in a West space that is not a battleground, with +1 op, ignoring weariness locks. Hangu Pass leaves the game. |
| Mohist Defenders (mozhe) | Name one space: no **campaign** or lobby there for the rest of the turn. | Name one space: no **raid** or lobby there for the rest of the turn. |
| Iron and Crossbows (yetie) | Until the end of the turn your **campaigns** get +1 op. | Until the end of the turn your **raids** get +1 op. |
| Battle of Yiyang (yiyang) | Qin makes a free **campaign** in the Three Jin that does not tire the realm. | Qin makes a free **raid** in the Three Jin that does not tire the realm. |
| Bai Qi (baiqi) | Lasting: Qin's **campaigns** in the Three Jin and the South get +1 op. | Lasting: Qin's **raids** in the Three Jin and the South get +1 op. |
| The Alliance Attacks Qin (hezong) | Chu makes a free **campaign** in the West with +2 ops, ignoring weariness locks. Hangu Pass leaves the game. | Chu makes a free **raid** in the West with +2 ops, ignoring weariness locks. Hangu Pass leaves the game. |
| Battle of Yuyu (yuyu) | Chu makes a free **campaign** in the Three Jin or the West that does not tire the realm. | Chu makes a free **raid** in the Three Jin or the West that does not tire the realm. |
| The Meeting at Mianchi (mianchi) | Weariness recovers 1. Until the end of the turn all **campaigns** get −1 op. | Weariness recovers 1. Until the end of the turn all **raids** get −1 op. |
| Building the Long Wall (changcheng) | Choose a region: until the end of the turn the other side's **campaigns** there get −1 op. | Choose a region: until the end of the turn the other side's **raids** there get −1 op. |
| Battle of Changping (changping) | Qin **campaigns** in the Three Jin with 4 +3 ops. Weariness falls 1 more. | Qin **raids** in the Three Jin with 4 +3 ops. Weariness falls 1 more. |
| Wang Jian Conquers Chu (wangjian) | Qin **campaigns** in the South with 4 +2 ops, ignoring weariness locks. Weariness falls 1 more. | Qin **raids** in the South with 4 +2 ops, ignoring weariness locks. Weariness falls 1 more. |
| Lian Po and Li Mu (lianpo) | Lasting: Qin's **campaigns** in the Three Jin and the North get −1 op. Sowing Discord can remove it. | Lasting: Qin's **raids** in the Three Jin and the North get −1 op. Sowing Discord can remove it. |
| A Proposal to Lay Down Arms (mibing) | Weariness recovers 2. Until the end of the turn all **campaigns** get −1 op. | Weariness recovers 2. Until the end of the turn all **raids** get −1 op. |
| Swallowing the Small States (jianbing) | Make a free **campaign** in any non-battleground space; it does not tire the realm and ignores locks. | Make a free **raid** in any non-battleground space; it does not tire the realm and ignores locks. |

No card text named 征伐/征伐 or 放置/Place a second way that needed a
different call — every hit above is the same "names the use, mid-sentence"
shape, so one substitution per language covers all 15.

## Non-card strings also renamed (for context, not the required table)

Uses table (`uses`/`useNames` in `public/i18n/*.js`), the in-turn prompt
headers (`prompt.place`/`prompt.campaign`), the log and opponent-reveal
ticker lines (`log.place`/`log.campaign`, `oppmove.tickerPlace`/
`tickerCampaign`), the tutorial intro/hand/place/campaign steps and the
advisor's `suggestUse.place`/`suggestCard.place` and `suggestUse.campaign`/
`suggestCard.campaign` lines, the rules
page's uses table, weariness text, reform-perk text, the 九鼎 special text
(also duplicated in `public/oppmove-ui.js`'s hardcoded jiuding string), five
worked-example figure captions, the doOps fig-note, and README.md's
one-paragraph rules summary.

### Orchestrator correction (2026-09-22)

First pass kept `advisor.suggestCard.place`/`placeNoTarget` and
`suggestUse.place` unchanged, reading them as the brief's own "「放置影響
力」 / place influence" exemption. Sent back: that exemption is for text
describing points put down, not for the advisor's own button-naming
instruction — since #100 the suggested button wears the 軍師 tab and reads
「扶植」, so a sentence still saying 放置影響力/"Place with..." points at a
word no longer on screen. Fixed, mirroring the raid lines:

| Key | zh before | zh after | en before | en after |
|---|---|---|---|---|
| `suggestCard.place` | 用{card}在{space}放置影響力。 | 用{card}在{space}扶植。 | Place with {card} in {space}. | Foster with {card} in {space}. |
| `suggestCard.placeNoTarget` | 用{card}放置影響力。 | 用{card}扶植。 | Place with {card}. | Foster with {card}. |
| `suggestUse.place` | 在{space}放置影響力。 | 在{space}扶植。 | Place it in {space}. | Foster in {space}. |

## Kept on purpose (grep after the change)

`征伐` and the capitalised `Campaign`: 0 player-visible hits. Remaining hits
are all code comments (`public/rules.js:255,263`, `public/advisor-ui.js`,
`public/app.js:2174`, `public/shared/cards.js:18` — none rendered to a
player).

`放置` / capitalised `Place` as the use name: kept in four places, all
"plain action, not the use name" — `advisor.suggestCard.place`/
`placeNoTarget`/`suggestUse.place` are no longer among them, see the
orchestrator correction above:

- `prompt.setup` / `prompt.setupBonus` and `advisor.suggestSetup` (zh/en):
  the pre-game deployment phase, not the in-turn Place/Foster use.
- `preview.campaign` and `log.campaign` / `oppmove.tickerCampaign`'s
  trailing "放置 {placed}" / "places {placed}": the campaign's own
  leftover-troops placement, not a report of the Place/Foster use.
- `tutorial.steps.lobby`'s "不放置,也不增加疲敝。" / "It places nothing
  and never tires the realm.": describes what Lobby does *not* do.
- `cards.en.js`'s `zhouzuo`: "Place 2 in Luoyi." mirrors the zh card's
  "打出者在洛邑放 2。" (放, not 放置) — the brief's own card example.
- `public/shared/engine.js`, `bots.js`, `advisor.js`, `tutorial.js`: code
  identifiers only (`canPlaceAt`, `use: "place"`, action ids) — untouched.

## Tests touched

None. `tests/` is orchestrator-owned; I ran it, did not edit it. No test
asserts the literal strings that changed (`grep -rln "征伐\|放置\|Campaign\|
Place" tests/` turns up one comment line in `tests/setup-prompt.test.js`,
not an assertion). Full gate: `node --test --test-concurrency=1` → 191
pass, 0 fail, both before and after.

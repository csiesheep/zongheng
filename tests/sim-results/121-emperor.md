# #121 — what 稱帝 (reform box 6) is worth: +3 today, +5, or a win

Engine option `emperor` (not a key of `DEFAULT_OPTIONS`; an absent option plays as `vp`, so a default game is byte for byte today's):

| value | reaching box 6 first | second |
|---|---|---|
| `vp` | +3 (the rulebook; today) | +1 |
| `vp5` | +5 | +1 |
| `win` | wins at once, end reason `emperor` | +1 |
| `win-late` | wins from turn 5 on; before turn 5 +3, and the first place is then taken | +1 |
| `win-lead` (the one extra) | wins only while leading the Mandate at that moment (Qin > 0, Chu < 0); otherwise +3 and the first place is taken | +1 |

Why `win-lead` was added: under `win` the side that was **behind** on the Mandate when it reached box 6 took 75 of the 187 games won by 稱帝 (normal vs normal) and 101 of 263 (hard vs hard); 22 and 27 of those winners were 10 or more behind. `win-lead` asks what is left of `win` without that steal.

**The bots.** Before #121 the bots valued the track only as perks (`REFORM_PERK`) and saw a 稱帝 win only when it lay one action away. Under `win` they threw away the winning card: at box 4-5 they spent 長平之戰 (the only 4-op card in hand) on place, campaign or its event, and at box 4 with two advances left they did not climb (tests in `tests/emperor.test.js`, red on 00d2e37). Commit 65ff169 adds a term to `evaluate`, only under `win` / `win-late` / `win-lead` and only for a side that can still win by it: boxes 0…5 worth 0 0 0.5 1.5 4 8, a card of 4 face ops in hand worth 20 (MANDATE_TO_WIN) at box 5 and 10 at box 4. The rows marked `@unaware-bot` are `win` played by the old bot (build 00d2e37, same seeds), kept to show what the bot change does. `vp5` uses the bot as it is today (it values +5 when it gets it, as it values +3 today).

**Runs.** 500 games per cell, seeds 1…500 in every cell, `nn` = normal vs normal, `hh` = hard vs hard, Node 24 on the development machine. No errors and no stuck games in any cell (12 cells, 6,000 games). Builds: `vp` and `@unaware-bot` from 00d2e37; `vp5`, `win`, `win-late` from 65ff169; `win-lead` from bf137ff (win / win-late play is identical between 65ff169 and bf137ff: 10 games each, same seeds, final-state hashes equal). All builds are on origin/main 0361ee2, before #119.

```
node tests/sim.js 500 --only=emp/nn/vp,emp/hh/vp --chunk=5 --out=tests/sim-results/121-emperor-vp.txt --resume
node tests/sim.js 500 --only=emp/nn/win,emp/hh/win --chunk=5 --out=tests/sim-results/121-emperor-naive.txt --resume     # at 00d2e37
node tests/sim.js 500 --only=emp/nn/vp5,emp/nn/win,emp/nn/win-late,emp/hh/vp5,emp/hh/win --chunk=5 --out=tests/sim-results/121-emperor-var.txt --resume
node tests/sim.js 500 --only=emp/hh/win-late --chunk=5 --out=tests/sim-results/121-emperor-late.txt --resume
node tests/sim.js 500 --only=emp/nn/win-lead,emp/hh/win-lead --chunk=5 --out=tests/sim-results/121-emperor-lead.txt --resume
node tests/sim.js --report-emperor=tests/sim-results/121-emperor-vp.txt.state.json,tests/sim-results/121-emperor-var.txt.state.json,tests/sim-results/121-emperor-late.txt.state.json,tests/sim-results/121-emperor-lead.txt.state.json,tests/sim-results/121-emperor-naive.txt.state.json@unaware-bot
```

## Today (`vp`): who reaches 稱帝, when, and does it win?

- **Reached in 20.0 % [16.7, 23.7] of normal games and 34.4 % [30.4, 38.7] of hard games** — but most games end before the conquest era: of the games that last to turn 7 it is reached in 47 % (100/212, nn) and 60 % (169/284, hh). So not "almost nobody": about half of the long games.
- **Late and Qin's.** First reach on turn 7 or 8 in every normal game (7:45, 8:55) and in 154 of 172 hard games (4:2 5:8 6:8 7:102 8:52). First there: Qin 91 / Chu 9 (nn), 129 / 43 (hh). The 4-op cards that take the last step are 長平 and 王翦 (Qin, conquest), 信陵君 (Chu, conquest), 合縱攻秦 (Chu, alliance), 蘇秦 (Chu, reform); and Qin has more reform events.
- **Reaching it first does not predict the win**: the first-there side won 44 % [35, 54] (nn) and 56 % [48, 63] (hh). Median Mandate from its side at the end: 0 (nn), +5 (hh). The games where it was reached mostly ended by 終局 (nn 23 won / 29 lost) or 天命 (14 / 8).
- **Final track position** (0…6): Qin 2.96, Chu 2.49 on average (nn); 3.75 / 3.32 (hh); full distributions below.
- **The track moves more by events than by the reform use**: per game 2.2 reform uses and 3.2 advances by event (nn), 3.6 and 3.5 (hh). Ops discarded to reform are 4.1 % (nn) / 6.5 % (hh) of the ops spent on place + campaign + lobby + reform.

## Reading

- **`vp5` changes nothing measurable.** Qin +2.0 pp (nn) / +1.6 pp (hh), both inside the interval; same end reasons, same reform effort, same turn. Two more points on a box reached late and mostly by Qin move some 終局 losses into 天命 wins for the first-there side (first-there won +10.7 / +9.4 pp, intervals touch 0). If the aim is a heavier 稱帝, +5 is not heavy enough to be felt.
- **`win` makes the late game a reform race, and hands Qin +9.4 pp (nn) / +14.4 pp (hh)**, both outside the interval. 37 % (nn) / 53 % (hh) of games end by 稱帝; 終局 almost disappears (18.4 → 1.6 %, 26.6 → 0.2 %); games are 0.3 / 0.8 turns shorter; 天命 and 相印 ends fall. Ops to reform rise to 6.6 % / 10.2 % of ops (+2.5 / +3.7 pp) — a race, but most ops still go to the board. Qin gets there first 124:65 (nn) and 185:79 (hh). About 40 % of 稱帝 wins go to the side behind on the Mandate. Even the unaware bot, which only takes a win it sees one action away, gives Qin +9.4 / +11.4 pp.
- **`win-late` is `win`**: identical Qin % in both levels and the same end mix, because box 6 is almost never reached before turn 5 even under `win` (first reach before turn 5: 3 of 189 nn games, 16 of 264 hh). The turn-5 gate guards against something that does not happen. A gate that bites would have to be later (117 of the 264 hard first reaches under `win` are on turns 5-6); not measured.
- **`win-lead` is the middle.** Qin +5.4 pp (nn) / +5.6 pp (hh), intervals just touching 0; 22 % / 34 % of games end by 稱帝; 終局 survives at 7.6 % / 9.2 %; no steal by construction, and the winner led by 10 or more in 44 of 111 (nn) and 71 of 171 (hh) 稱帝 wins, so it often closes a game that was already being won. Reform share +1.1 / +1.9 pp.

**Recommendation (the owner decides; the default is unchanged).** If 稱帝 should be able to end the game, `win-lead`: it makes the box decisive without letting a side far behind on the Mandate take the game, it keeps the final scoring alive, and it tilts to Qin least of the three winning values. It still leans Qin (first there 107:44 nn, 172:58 hh), and that tilt — Qin's reform events and its conquest-era 4-op cards — is what to look at next if a win by reform is adopted. `vp5` is not worth a rule change: it does not show in the numbers. `win` and `win-late` I would not adopt: +9 to +14 pp for Qin, 40 % of their 稱帝 wins by the side behind, and the last turns stop being about the board.

**Caveats.** The `win*` numbers depend on the bot's new race term (weights chosen by reasoning, not tuned; no sensitivity run). Bots do not plan across turns (hold a 4-op card for two turns, deny the opponent's). Differences are computed as independent samples although the seeds are shared, so the intervals are conservative.

<!-- below: the output of --report-emperor, unedited -->

| cell | n | errors / stuck | Qin win % [95%] | avg end turn | box 6 reached by anyone, % [95%] | games that lasted to turn 7: box 6 reached, % (k/n) | by Qin % | by Chu % | first there: Qin / Chu | first-there side won, % [95%] (of games reached) |
|---|---|---|---|---|---|---|---|---|---|---|
| emp/nn/vp | 500 | 0 / 0 | 47.2 [42.9, 51.6] | 5.72 ±0.19 | 20.0 [16.7, 23.7] | 47.2 (100/212) | 18.6 | 3.2 | 91 / 9 | 44.0 [34.7, 53.8] (44/100) |
| emp/nn/vp5 | 500 | 0 / 0 | 49.2 [44.8, 53.6] | 5.72 ±0.19 | 21.2 [17.8, 25.0] | 50.0 (106/212) | 19.0 | 3.6 | 94 / 12 | 54.7 [45.2, 63.9] (58/106) |
| emp/nn/win | 500 | 0 / 0 | 56.6 [52.2, 60.9] | 5.39 ±0.17 | 37.8 [33.7, 42.1] | 81.7 (147/180) | 24.8 | 13.0 | 124 / 65 | 100.0 [98.0, 100.0] (189/189) |
| emp/nn/win@unaware-bot | 500 | 0 / 0 | 56.6 [52.2, 60.9] | 5.64 ±0.18 | 20.0 [16.7, 23.7] | 46.9 (99/211) | 17.0 | 3.0 | 85 / 15 | 100.0 [96.3, 100.0] (100/100) |
| emp/nn/win-late | 500 | 0 / 0 | 56.6 [52.2, 60.9] | 5.40 ±0.17 | 37.6 [33.5, 41.9] | 81.7 (147/180) | 24.6 | 13.0 | 123 / 65 | 99.5 [97.0, 99.9] (187/188) |
| emp/nn/win-lead | 500 | 0 / 0 | 52.6 [48.2, 56.9] | 5.52 ±0.18 | 30.2 [26.3, 34.4] | 67.5 (131/194) | 22.0 | 9.2 | 107 / 44 | 82.1 [75.2, 87.4] (124/151) |
| emp/hh/vp | 500 | 0 / 0 | 47.2 [42.9, 51.6] | 6.40 ±0.17 | 34.4 [30.4, 38.7] | 59.5 (169/284) | 29.8 | 9.6 | 129 / 43 | 55.8 [48.3, 63.0] (96/172) |
| emp/hh/vp5 | 500 | 0 / 0 | 48.8 [44.4, 53.2] | 6.39 ±0.17 | 36.8 [32.7, 41.1] | 63.0 (177/281) | 32.0 | 11.2 | 137 / 47 | 65.2 [58.1, 71.7] (120/184) |
| emp/hh/win | 500 | 0 / 0 | 61.6 [57.3, 65.8] | 5.56 ±0.14 | 52.8 [48.4, 57.1] | 82.4 (131/159) | 37.0 | 15.8 | 185 / 79 | 100.0 [98.6, 100.0] (264/264) |
| emp/hh/win@unaware-bot | 500 | 0 / 0 | 58.6 [54.2, 62.8] | 6.11 ±0.15 | 37.0 [32.9, 41.3] | 61.3 (160/261) | 28.2 | 8.8 | 141 / 44 | 100.0 [98.0, 100.0] (185/185) |
| emp/hh/win-late | 500 | 0 / 0 | 61.6 [57.3, 65.8] | 5.61 ±0.13 | 52.4 [48.0, 56.7] | 82.7 (134/162) | 37.0 | 15.4 | 185 / 77 | 99.6 [97.9, 99.9] (261/262) |
| emp/hh/win-lead | 500 | 0 / 0 | 52.8 [48.4, 57.1] | 5.92 ±0.15 | 46.0 [41.7, 50.4] | 73.6 (162/220) | 35.0 | 13.4 | 172 / 58 | 81.7 [76.2, 86.2] (188/230) |

End reasons, % of games [Wilson 95%]:

| cell | 稱帝 | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 |
|---|---|---|---|---|---|---|---|---|---|
| emp/nn/vp | 0 | 43.4 [39.1, 47.8] | 1.8 [0.9, 3.4] | 17.0 [14.0, 20.5] | 1.8 [0.9, 3.4] | 15.2 [12.3, 18.6] | 0.2 [0.0, 1.1] | 18.4 [15.2, 22.0] | 2.2 [1.2, 3.9] |
| emp/nn/vp5 | 0 | 43.6 [39.3, 48.0] | 1.8 [0.9, 3.4] | 16.0 [13.0, 19.5] | 1.8 [0.9, 3.4] | 15.4 [12.5, 18.8] | 0.2 [0.0, 1.1] | 19.6 [16.4, 23.3] | 1.6 [0.8, 3.1] |
| emp/nn/win | 37.4 [33.3, 41.7] | 33.4 [29.4, 37.6] | 0.8 [0.3, 2.0] | 12.0 [9.4, 15.1] | 2.2 [1.2, 3.9] | 12.6 [10.0, 15.8] | 0 | 1.6 [0.8, 3.1] | 0 |
| emp/nn/win@unaware-bot | 20.0 [16.7, 23.7] | 38.4 [34.2, 42.7] | 1.6 [0.8, 3.1] | 14.0 [11.2, 17.3] | 1.6 [0.8, 3.1] | 14.6 [11.8, 18.0] | 0.2 [0.0, 1.1] | 8.6 [6.4, 11.4] | 1.0 [0.4, 2.3] |
| emp/nn/win-late | 36.6 [32.5, 40.9] | 33.8 [29.8, 38.1] | 0.8 [0.3, 2.0] | 12.4 [9.8, 15.6] | 2.2 [1.2, 3.9] | 12.6 [10.0, 15.8] | 0 | 1.6 [0.8, 3.1] | 0 |
| emp/nn/win-lead | 22.2 [18.8, 26.0] | 36.4 [32.3, 40.7] | 1.8 [0.9, 3.4] | 17.0 [14.0, 20.5] | 1.6 [0.8, 3.1] | 13.0 [10.3, 16.2] | 0 | 7.6 [5.6, 10.3] | 0.4 [0.1, 1.4] |
| emp/hh/vp | 0 | 37.0 [32.9, 41.3] | 1.8 [0.9, 3.4] | 14.8 [12.0, 18.2] | 4.6 [3.1, 6.8] | 12.8 [10.2, 16.0] | 0.2 [0.0, 1.1] | 26.6 [22.9, 30.6] | 2.2 [1.2, 3.9] |
| emp/hh/vp5 | 0 | 39.2 [35.0, 43.5] | 1.6 [0.8, 3.1] | 14.4 [11.6, 17.7] | 4.2 [2.8, 6.3] | 13.2 [10.5, 16.4] | 0.2 [0.0, 1.1] | 26.0 [22.3, 30.0] | 1.2 [0.6, 2.6] |
| emp/hh/win | 52.6 [48.2, 56.9] | 22.6 [19.2, 26.5] | 0.8 [0.3, 2.0] | 9.2 [7.0, 12.1] | 4.0 [2.6, 6.1] | 10.6 [8.2, 13.6] | 0 | 0.2 [0.0, 1.1] | 0 |
| emp/hh/win@unaware-bot | 37.0 [32.9, 41.3] | 27.8 [24.1, 31.9] | 1.0 [0.4, 2.3] | 12.2 [9.6, 15.4] | 3.4 [2.1, 5.4] | 12.8 [10.2, 16.0] | 0.2 [0.0, 1.1] | 5.2 [3.6, 7.5] | 0.4 [0.1, 1.4] |
| emp/hh/win-late | 51.6 [47.2, 56.0] | 22.8 [19.3, 26.7] | 0.8 [0.3, 2.0] | 9.2 [7.0, 12.1] | 4.2 [2.8, 6.3] | 11.0 [8.5, 14.0] | 0 | 0.4 [0.1, 1.4] | 0 |
| emp/hh/win-lead | 34.2 [30.2, 38.5] | 27.4 [23.7, 31.5] | 0.6 [0.2, 1.7] | 12.4 [9.8, 15.6] | 3.0 [1.8, 4.9] | 12.6 [10.0, 15.8] | 0.2 [0.0, 1.1] | 9.2 [7.0, 12.1] | 0.4 [0.1, 1.4] |

Games in which box 6 was reached: how they ended, as first-there side won / lost, and the Mandate at the end from the first-there side's point of view (median; for a 稱帝 win it is the Mandate at that moment):

| cell | games | 稱帝 | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | first-there's Mandate, median |
|---|---|---|---|---|---|---|---|---|---|---|---|
| emp/nn/vp | 100 | – | 14 / 8 | – | 1 / 14 | 2 / 0 | 3 / 1 | – | 23 / 29 | 1 / 4 | 0 |
| emp/nn/vp5 | 106 | – | 23 / 3 | – | 0 / 12 | 2 / 0 | 5 / 0 | – | 27 / 31 | 1 / 2 | 4 |
| emp/nn/win | 189 | 187 / 0 | 2 / 0 | – | – | – | – | – | – | – | 1 |
| emp/nn/win@unaware-bot | 100 | 100 / 0 | – | – | – | – | – | – | – | – | 2 |
| emp/nn/win-late | 188 | 183 / 0 | 3 / 1 | – | 1 / 0 | – | – | – | – | – | 1 |
| emp/nn/win-lead | 151 | 111 / 0 | 2 / 2 | 1 / 2 | 2 / 9 | 0 / 1 | 1 / 1 | – | 7 / 11 | 0 / 1 | 6 |
| emp/hh/vp | 172 | – | 24 / 16 | 2 / 1 | 2 / 11 | 1 / 3 | 5 / 0 | – | 60 / 39 | 2 / 6 | 5 |
| emp/hh/vp5 | 184 | – | 41 / 11 | 1 / 1 | 3 / 12 | 2 / 1 | 6 / 0 | – | 67 / 36 | 0 / 3 | 8 |
| emp/hh/win | 264 | 263 / 0 | 1 / 0 | – | – | – | – | – | – | – | 3 |
| emp/hh/win@unaware-bot | 185 | 185 / 0 | – | – | – | – | – | – | – | – | 2 |
| emp/hh/win-late | 262 | 258 / 0 | 1 / 0 | – | – | 0 / 1 | 1 / 0 | – | 1 / 0 | – | 3 |
| emp/hh/win-lead | 230 | 171 / 0 | 3 / 10 | 0 / 1 | 1 / 5 | 2 / 0 | 1 / 2 | – | 10 / 22 | 0 / 2 | 6 |

Is it a reform race? Per game, both sides together [95%]; ops are face values; 'reform share' = ops discarded to reform ÷ ops spent on place + campaign + lobby + reform.

| cell | reform uses / game | Qin uses | Chu uses | advances by event | final box Qin | final box Chu | ops: place | ops: campaign | ops: lobby | ops: reform | reform share of ops, % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| emp/nn/vp | 2.23 ±0.17 | 0.94 | 1.28 | 3.23 | 2.96 ±0.17 | 2.49 ±0.14 | 83.3 | 23.6 | 12.1 | 6.08 ±0.51 | 4.1 |
| emp/nn/vp5 | 2.24 ±0.17 | 0.95 | 1.29 | 3.21 | 2.96 ±0.17 | 2.49 ±0.14 | 83.2 | 23.5 | 12.1 | 6.14 ±0.51 | 4.2 |
| emp/nn/win | 2.99 ±0.21 | 1.37 | 1.62 | 2.93 | 3.17 ±0.18 | 2.75 ±0.17 | 72.3 | 20.3 | 8.9 | 8.25 ±0.60 | 6.6 |
| emp/nn/win@unaware-bot | 2.19 ±0.17 | 0.96 | 1.23 | 3.12 | 2.90 ±0.17 | 2.41 ±0.14 | 80.6 | 22.3 | 11.1 | 5.97 ±0.50 | 4.3 |
| emp/nn/win-late | 2.98 ±0.21 | 1.36 | 1.62 | 2.93 | 3.16 ±0.18 | 2.75 ±0.17 | 72.4 | 20.3 | 8.9 | 8.22 ±0.60 | 6.5 |
| emp/nn/win-lead | 2.54 ±0.18 | 1.10 | 1.44 | 3.01 | 2.97 ±0.17 | 2.59 ±0.16 | 76.6 | 21.5 | 10.4 | 6.97 ±0.54 | 5.3 |
| emp/hh/vp | 3.60 ±0.20 | 1.62 | 1.98 | 3.48 | 3.75 ±0.17 | 3.32 ±0.15 | 86.7 | 29.9 | 14.8 | 9.96 ±0.59 | 6.5 |
| emp/hh/vp5 | 3.64 ±0.20 | 1.65 | 1.99 | 3.47 | 3.77 ±0.17 | 3.34 ±0.15 | 86.4 | 30.0 | 14.7 | 10.11 ±0.60 | 6.6 |
| emp/hh/win | 4.26 ±0.20 | 2.19 | 2.06 | 2.86 | 3.87 ±0.18 | 3.25 ±0.16 | 66.6 | 24.0 | 9.3 | 11.84 ±0.60 | 10.2 |
| emp/hh/win@unaware-bot | 3.39 ±0.18 | 1.62 | 1.77 | 3.32 | 3.62 ±0.17 | 3.08 ±0.14 | 78.9 | 26.7 | 12.5 | 9.32 ±0.53 | 6.9 |
| emp/hh/win-late | 4.27 ±0.20 | 2.19 | 2.08 | 2.88 | 3.87 ±0.18 | 3.27 ±0.16 | 67.4 | 24.1 | 9.4 | 11.84 ±0.60 | 10.0 |
| emp/hh/win-lead | 3.91 ±0.20 | 1.94 | 1.97 | 3.12 | 3.78 ±0.18 | 3.25 ±0.16 | 74.7 | 26.4 | 11.5 | 10.89 ±0.59 | 8.4 |

Distributions: turn the first side reached box 6 (turn:games); final box per side (box:games, 0…6); end turn (turn:games); the highest reform-use games.

- **emp/nn/vp**: first reach turn 7:45 8:55; final box Qin 0:37 1:99 2:109 3:86 4:31 5:45 6:93, Chu 0:44 1:133 2:64 3:145 4:38 5:60 6:16; end turn 1:16 2:21 3:62 4:51 5:73 6:65 7:38 8:174; most reform uses seed 469 (9, final), seed 187 (8, final), seed 351 (8, mandate)
- **emp/nn/vp5**: first reach turn 7:52 8:54; final box Qin 0:37 1:99 2:109 3:88 4:31 5:41 6:95, Chu 0:44 1:133 2:63 3:146 4:38 5:58 6:18; end turn 1:16 2:21 3:62 4:51 5:73 6:65 7:40 8:172; most reform uses seed 187 (8, mandate), seed 402 (8, final), seed 475 (8, final)
- **emp/nn/win**: first reach turn 4:3 5:24 6:15 7:94 8:53; final box Qin 0:37 1:105 2:84 3:71 4:39 5:40 6:124, Chu 0:49 1:128 2:62 3:100 4:49 5:47 6:65; end turn 1:16 2:23 3:60 4:55 5:85 6:81 7:116 8:64; most reform uses seed 488 (9, emperor), seed 11 (8, emperor), seed 74 (8, emperor)
- **emp/nn/win@unaware-bot**: first reach turn 6:1 7:49 8:50; final box Qin 0:37 1:103 2:110 3:86 4:36 5:43 6:85, Chu 0:44 1:135 2:68 3:151 4:42 5:45 6:15; end turn 1:16 2:21 3:62 4:51 5:73 6:66 7:79 8:132; most reform uses seed 475 (8, emperor), seed 469 (8, emperor), seed 60 (7, emperor)
- **emp/nn/win-late**: first reach turn 4:3 5:24 6:14 7:94 8:53; final box Qin 0:37 1:105 2:85 3:72 4:37 5:41 6:123, Chu 0:49 1:127 2:62 3:101 4:49 5:47 6:65; end turn 1:16 2:23 3:60 4:54 5:86 6:81 7:116 8:64; most reform uses seed 488 (9, emperor), seed 11 (8, emperor), seed 81 (8, emperor)
- **emp/nn/win-lead**: first reach turn 4:1 5:13 6:6 7:81 8:50; final box Qin 0:36 1:106 2:112 3:78 4:31 5:27 6:110, Chu 0:48 1:138 2:62 3:120 4:34 5:52 6:46; end turn 1:16 2:24 3:63 4:50 5:79 6:74 7:84 8:110; most reform uses seed 123 (8, collapse), seed 308 (8, emperor), seed 397 (8, emperor)
- **emp/hh/vp**: first reach turn 4:2 5:8 6:8 7:102 8:52; final box Qin 0:25 1:60 2:62 3:91 4:39 5:74 6:149, Chu 0:23 1:69 2:55 3:130 4:72 5:103 6:48; end turn 1:10 2:11 3:32 4:36 5:58 6:69 7:47 8:237; most reform uses seed 57 (9, tie), seed 89 (9, final), seed 393 (9, mandate)
- **emp/hh/vp5**: first reach turn 4:2 5:7 6:9 7:105 8:61; final box Qin 0:25 1:60 2:62 3:91 4:40 5:62 6:160, Chu 0:23 1:70 2:52 3:136 4:63 5:100 6:56; end turn 1:10 2:11 3:32 4:36 5:60 6:70 7:46 8:235; most reform uses seed 57 (9, final), seed 77 (9, final), seed 89 (9, final)
- **emp/hh/win**: first reach turn 3:2 4:14 5:55 6:62 7:106 8:25; final box Qin 0:29 1:57 2:58 3:87 4:29 5:55 6:185, Chu 0:30 1:76 2:66 3:113 4:78 5:58 6:79; end turn 1:9 2:11 3:35 4:51 5:117 6:118 7:126 8:33; most reform uses seed 213 (9, emperor), seed 230 (9, emperor), seed 15 (8, emperor)
- **emp/hh/win@unaware-bot**: first reach turn 4:3 5:6 6:16 7:106 8:54; final box Qin 0:25 1:63 2:65 3:106 4:45 5:55 6:141, Chu 0:25 1:79 2:70 3:143 4:66 5:73 6:44; end turn 1:10 2:11 3:32 4:39 5:61 6:86 7:140 8:121; most reform uses seed 213 (8, emperor), seed 359 (8, emperor), seed 103 (7, emperor)
- **emp/hh/win-late**: first reach turn 3:2 4:1 5:64 6:62 7:107 8:26; final box Qin 0:29 1:57 2:57 3:87 4:30 5:55 6:185, Chu 0:30 1:72 2:64 3:114 4:82 5:61 6:77; end turn 1:9 2:11 3:33 4:39 5:128 6:118 7:127 8:35; most reform uses seed 213 (9, emperor), seed 230 (9, emperor), seed 15 (8, emperor)
- **emp/hh/win-lead**: first reach turn 3:2 4:8 5:33 6:35 7:109 8:43; final box Qin 0:28 1:61 2:65 3:85 4:38 5:48 6:175, Chu 0:26 1:81 2:64 3:120 4:55 5:87 6:67; end turn 1:10 2:10 3:36 4:46 5:79 6:99 7:110 8:110; most reform uses seed 166 (9, tie), seed 188 (9, emperor), seed 213 (9, mandate)

Difference from `vp` at the same level [95%]; ** = the interval leaves out 0:

| cell − vp | Qin win pp | end turn | box 6 reached pp | first-there won pp | reform uses / game | reform share pp | 天命 end pp | 相印 end pp | 終局 end pp |
|---|---|---|---|---|---|---|---|---|---|
| emp/nn/vp5 | +2.0 [-4.2, 8.2] | -0.00 [-0.27, +0.26] | +1.2 [-3.8, 6.2] | +10.7 [-2.9, 24.3] | +0.02 [-0.23, +0.26] | +0.04 [-0.38, +0.47] | +0.2 [-5.9, 6.3] | -1.0 [-5.6, 3.6] | +1.2 [-3.7, 6.1] |
| emp/nn/win | **+9.4 [3.2, 15.6]** | **-0.33 [-0.58, -0.08]** | **+17.8 [12.3, 23.3]** | **+56.0 [46.3, 65.7]** | **+0.76 [+0.49, +1.03]** | **+2.48 [+1.94, +3.02]** | **-10.0 [-16.0, -4.0]** | **-5.0 [-9.4, -0.6]** | **-16.8 [-20.4, -13.2]** |
| emp/nn/win@unaware-bot | **+9.4 [3.2, 15.6]** | -0.09 [-0.35, +0.17] | +0.0 [-5.0, 5.0] | **+56.0 [46.3, 65.7]** | -0.04 [-0.28, +0.20] | +0.18 [-0.26, +0.61] | -5.0 [-11.1, 1.1] | -3.0 [-7.5, 1.5] | **-9.8 [-14.0, -5.6]** |
| emp/nn/win-late | **+9.4 [3.2, 15.6]** | **-0.33 [-0.58, -0.08]** | **+17.6 [12.1, 23.1]** | **+55.5 [45.7, 65.3]** | **+0.75 [+0.49, +1.02]** | **+2.42 [+1.89, +2.95]** | **-9.6 [-15.6, -3.6]** | **-4.6 [-9.0, -0.2]** | **-16.8 [-20.4, -13.2]** |
| emp/nn/win-lead | +5.4 [-0.8, 11.6] | -0.20 [-0.46, +0.06] | **+10.2 [4.9, 15.5]** | **+38.1 [26.6, 49.6]** | **+0.31 [+0.06, +0.57]** | **+1.14 [+0.67, +1.62]** | **-7.0 [-13.1, -0.9]** | +0.0 [-4.7, 4.7] | **-10.8 [-14.9, -6.7]** |
| emp/hh/vp5 | +1.6 [-4.6, 7.8] | -0.01 [-0.25, +0.22] | +2.4 [-3.5, 8.3] | +9.4 [-0.7, 19.5] | +0.04 [-0.24, +0.32] | +0.10 [-0.38, +0.58] | +2.2 [-3.8, 8.2] | -0.4 [-4.8, 4.0] | -0.6 [-6.1, 4.9] |
| emp/hh/win | **+14.4 [8.3, 20.5]** | **-0.84 [-1.06, -0.63]** | **+18.4 [12.4, 24.4]** | **+44.2 [36.8, 51.6]** | **+0.66 [+0.38, +0.94]** | **+3.72 [+3.12, +4.32]** | **-14.4 [-20.0, -8.8]** | **-5.6 [-9.6, -1.6]** | **-26.4 [-30.3, -22.5]** |
| emp/hh/win@unaware-bot | **+11.4 [5.3, 17.5]** | **-0.30 [-0.52, -0.07]** | +2.6 [-3.3, 8.5] | **+44.2 [36.8, 51.6]** | -0.21 [-0.47, +0.06] | +0.45 [-0.06, +0.95] | **-9.2 [-15.0, -3.4]** | -2.6 [-6.8, 1.6] | **-21.4 [-25.7, -17.1]** |
| emp/hh/win-late | **+14.4 [8.3, 20.5]** | **-0.80 [-1.01, -0.58]** | **+18.0 [12.0, 24.0]** | **+43.8 [36.3, 51.3]** | **+0.67 [+0.39, +0.95]** | **+3.52 [+2.94, +4.10]** | **-14.2 [-19.8, -8.6]** | **-5.6 [-9.6, -1.6]** | **-26.2 [-30.1, -22.3]** |
| emp/hh/win-lead | +5.6 [-0.6, 11.8] | **-0.48 [-0.71, -0.25]** | **+11.6 [5.6, 17.6]** | **+25.9 [17.0, 34.9]** | **+0.31 [+0.03, +0.59]** | **+1.91 [+1.37, +2.46]** | **-9.6 [-15.4, -3.8]** | -2.4 [-6.6, 1.8] | **-17.4 [-22.0, -12.8]** |

// Guard for #117 (orchestrator-owned): the advisor names 說客's pair.
//
// The owner played 說客 (The Lobbyist) and was never offered a card to pair it
// with. Part of why: the advisor's banner said 「用說客征伐大梁」 — 說客 alone —
// even when the hard bot's own move was the paired one, because advise()
// dropped `action.pair`. A player following the advisor never paired.
//
// These check the promise, not the evaluation: whenever the advised move is a
// pair, the advice says so, and both languages can say it.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { advise } from "../public/shared/advisor.js";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

const { QIN, CHU, CARD } = E;

// A turn-1 action round with the given hands, the rest of the deck untouched.
function atAction(seed, hands, actor) {
  let st = E.createGame(seed);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  const want = hands.flat();
  for (const k of ["draw", "discard", "removed"]) st[k] = (st[k] || []).filter((c) => !want.includes(c));
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !want.includes(c));
  st.hands = [hands[0].slice(), hands[1].slice()];
  Object.assign(st, { phase: "action", round: 1, actor, phasing: actor, plan: [], pending: null, headline: [null, null] });
  return st;
}

// Enemy cards for each side, highest ops first: the ones worth pairing.
const enemyOf = (side) => Object.values(CARD)
  .filter((c) => c.side === 1 - side && !c.scoring && c.era === "reform")
  .sort((a, b) => b.ops - a.ops)
  .map((c) => c.id);

test("#117: whenever the advised move pairs 說客, the advice carries the pair", () => {
  let paired = 0, checked = 0;
  for (const side of [QIN, CHU]) {
    const enemies = enemyOf(side).slice(0, 6);
    for (let seed = 1; seed <= 20; seed++) {
      const mine = ["shuoke", enemies[seed % enemies.length], enemies[(seed + 1) % enemies.length]];
      const hands = side === QIN ? [mine, []] : [[], mine];
      const st = atAction(seed, hands, side);
      const adv = advise(E.view(st, side), side, E.makeRng(seed));
      if (!adv || adv.action.type !== "play") continue;
      checked++;
      if (adv.action.pair) {
        paired++;
        assert.equal(adv.pair, adv.action.pair, `seed ${seed}: the advice dropped the pair it was built on`);
        assert.equal(adv.card, "shuoke");
        assert.ok(["place", "campaign", "lobby"].includes(adv.use), `a pair only goes with an ops use, got ${adv.use}`);
      } else {
        assert.ok(adv.pair == null, `seed ${seed}: an unpaired move must not claim a pair`);
      }
    }
  }
  assert.ok(checked > 0, "no advice was produced at all; the harness is broken");
  // Without this the test would pass on a bot that never pairs — which is the
  // very thing the owner could not see.
  assert.ok(paired > 0, `the advisor never recommended a pair in ${checked} hands holding 說客 and enemy cards`);
});

test("#117: both languages can name the pair in the advisor's sentence", () => {
  for (const [name, L] of [["en", EN], ["zh-Hant", ZH]]) {
    const s = L.advisor && L.advisor.suggestCard;
    assert.ok(s, `${name}: advisor.suggestCard missing`);
    for (const use of ["place", "campaign", "lobby"]) {
      for (const k of [`${use}Paired`, `${use}PairedNoTarget`]) {
        assert.equal(typeof s[k], "string", `${name}: advisor.suggestCard.${k} missing`);
        assert.match(s[k], /\{pair\}/, `${name}: advisor.suggestCard.${k} does not name the pair`);
        assert.match(s[k], /\{card\}/, `${name}: advisor.suggestCard.${k} does not name 說客`);
      }
    }
  }
});

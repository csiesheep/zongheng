// #35: the history section on a card's read-only view (the table's peek
// sheet, #34, and the rules page's card detail page). Keyed by the same
// card id shared/cards.js uses. Only three sample cards so far (the owner's
// own three, pasted as given — do not rewrite); the other 69 wait for the
// writer to fill in, one entry per card, same shape.
//
// #35 追加(owner, 2026-09-19): unlike the card-text box above it (which
// stays bilingual per #29), the history reads in ONE language, the current
// UI language — zh and en are both kept here so card-view.js can pick just
// one to put in the DOM (never both, never CSS-hidden), same for srcZh/
// srcEn. A card with no entry here shows no history section at all (see
// historyBox() in card-view.js).
export default {
  zhangyi: {
    zh: "秦惠文王十年(前 328 年),魏人張儀入秦為相,倡「連橫」:勸各國各自事秦,拆散合縱。前 313 年他許楚懷王商於之地六百里,誘楚與齊絕交,事成後只認六里;楚怒而伐秦,敗於丹陽、藍田。",
    en: "In 328 BC Zhang Yi of Wei became chancellor of Qin and argued for the Horizontal: each state should serve Qin on its own, which pulled the Vertical alliance apart. In 313 BC he promised King Huai of Chu 600 li of Shangyu land for breaking with Qi, then admitted to six. Chu attacked Qin in anger and lost at Danyang and Lantian.",
    srcZh: "《史記·張儀列傳》、《戰國策·秦策》",
    srcEn: "Shiji, Biography of Zhang Yi; Zhanguo Ce, Stratagems of Qin",
  },
  wuqi: {
    zh: "吳起自魏入楚,楚悼王用為令尹。他明法審令,裁汰冗官,封君子孫三世而收爵祿,省下的錢糧用來養兵,南平百越,北并陳、蔡。前 381 年悼王去世,宗室貴族圍射吳起,他伏在王屍上中箭而死;箭也射中王屍,事後因此被滅族的有七十餘家。",
    en: "Wu Qi left Wei for Chu, where King Dao made him chief minister. He tightened the laws, cut idle offices, took back noble stipends after three generations and spent the savings on the army, which subdued the Yue in the south and took Chen and Cai. When the king died in 381 BC the nobles shot Wu Qi as he lay across the royal corpse. Their arrows hit the king too, and more than seventy families were executed for it.",
    srcZh: "《史記·孫子吳起列傳》、《韓非子·和氏》",
    srcEn: "Shiji, Biographies of Sunzi and Wu Qi; Han Feizi, \"Mr He\"",
  },
  mianchi: {
    zh: "前 279 年,秦昭襄王與趙惠文王會於澠池。秦王請趙王鼓瑟,命史官記下;藺相如上前請秦王擊缶,說「五步之內,相如請得以頸血濺大王」,秦王只好敲了一下。終席秦不能加勝於趙,廉頗陳兵邊境,秦不敢動;次年白起轉而攻楚,拔郢。",
    en: "In 279 BC King Zhaoxiang of Qin met King Huiwen of Zhao at Mianchi. Qin had the Zhao king play the zither and had it written down; Lin Xiangru then pressed the Qin king to strike a clay drum, saying that within five paces his own blood could reach the king. Qin struck once. Neither side gained face, Lian Po's army waited on the border, and the next year Qin turned on Chu and took Ying.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
};

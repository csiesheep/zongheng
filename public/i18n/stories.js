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

  // #36 batch 1: 變法期 (era: "reform"), excluding zhangyi/wuqi above.
  shangyang: {
    zh: "衛人衛鞅入秦,說秦孝公變法。前356年起,他廢井田、開阡陌,行連坐之法,獎勵耕戰,軍功可授爵,宗室無軍功者不得列入屬籍。前340年,他率兵伐魏,以會盟為名誘擒魏將公子卬,大破魏軍。孝公死後,惠文王即位,公子虔等告商鞅欲反,他兵敗被殺,車裂於市,宗族亦遭誅滅。",
    en: "Shang Yang, born in Wei, persuaded Duke Xiao of Qin to adopt sweeping reforms from 356 BC: he abolished the old field system, enforced mutual responsibility among households, rewarded farming and fighting, and granted rank for military merit. In 340 BC he led an army against Wei, lured its general Gongzi Ang into a parley under false truce, and crushed the Wei force. After Duke Xiao died, nobles accused him of plotting revolt, and he was defeated, executed by chariots, his family destroyed.",
    srcZh: "《史記·商君列傳》",
    srcEn: "Shiji, Biography of Lord Shang",
  },
  ximu: {
    zh: "商鞅欲變法,恐百姓不信朝廷號令,乃在國都市集南門立一根三丈長的木頭,懸賞說能將它搬到北門的人給十金。百姓怪而不敢動。他又加碼為五十金,終於有人搬動,商鞅立刻照付,以此證明朝廷令出必行,隨後才正式頒布新法。",
    en: "Before announcing his reforms, Shang Yang worried the people would not trust a new decree. He set up a three-zhang pole at the south gate of the capital's market and offered ten pieces of gold to anyone who moved it to the north gate. No one dared. He raised the reward to fifty gold, someone finally moved it, and he paid at once, proving the government kept its word before the new laws were issued.",
    srcZh: "《史記·商君列傳》",
    srcEn: "Shiji, Biography of Lord Shang",
  },
  hexi: {
    zh: "河西之地原屬秦,戰國初年被魏奪去,魏文侯用吳起為西河守,長期據守此地。秦惠文君七年(前331年),秦與魏戰,虜魏將龍賈,斬首八萬;次年(前330年)魏納河西全境予秦以求和。秦國自此收復河西,東進的門戶洞開,形勢從此逆轉。",
    en: "Hexi had once belonged to Qin before Wei seized it early in the Warring States, when Marquis Wen of Wei made Wu Qi warden of the west river region. In the seventh year of Lord Huiwen of Qin, 331 BC, Qin defeated Wei, captured its general Long Jia, and took eighty thousand heads; the next year, 330 BC, Wei surrendered all of Hexi to make peace. Qin thereby regained the land and opened its gate east, turning the balance of power its way.",
    srcZh: "《史記·秦本紀》",
    srcEn: "Shiji, Basic Annals of Qin",
  },
  simacuo: {
    zh: "前316年,苴、蜀相攻擊,各向秦求援。張儀主張伐韓、兵臨二周,挾天子以令天下;司馬錯反駁,認為蜀地偏遠,取之可廣地富國,又不致招列國忌憚,一舉兩得。秦惠文王採納司馬錯之議,遣兵滅蜀,貶蜀王為侯,秦國因此據有巴蜀之地與其財富。",
    en: "In 316 BC, Ju and Shu attacked each other and both appealed to Qin. Zhang Yi urged Qin to attack Han and march on the two Zhou capitals, commanding the realm in the Zhou king's name; Sima Cuo argued that Shu was remote and rich, so taking it would enlarge Qin without alarming the other states. King Huiwen followed Sima Cuo, conquered Shu, demoted its king to a marquis, and Qin gained both the land of Ba-Shu and its wealth.",
    srcZh: "《史記·張儀列傳》",
    srcEn: "Shiji, Biography of Zhang Yi",
  },
  hangu: {
    zh: "函谷關扼守秦地東出的咽喉,是關東六國入秦的必經之路,也是有名的天險。前318年,魏、趙、韓、燕、楚五國合縱攻秦,屯兵關下,無法攻破,大敗而還。前298年,齊相孟嘗君合韓、魏之兵,以匡章為將,歷時三年攻入函谷關,秦被迫割地求和,是史書中罕見的關東聯軍破關記載。",
    en: "Hangu Pass guarded the gateway east out of Qin, the road any eastern coalition had to take. In 318 BC, Wei, Zhao, Han, Yan, and Chu jointly camped before the pass but could not break it and withdrew defeated. In 298 BC, Lord Mengchang, chancellor of Qi, joined Han and Wei under the general Kuang Zhang, and after three years broke through the pass, forcing Qin to cede land for peace, one of the rare recorded times a coalition breached it.",
    srcZh: "《史記·秦本紀》、《史記·孟嘗君列傳》",
    srcEn: "Shiji, Basic Annals of Qin; Biography of Lord Mengchang",
  },
  keqing: {
    zh: "秦國自商鞅以下,長期任用客卿(非秦國宗室的外來人才)為相,借重外人之力壓制本國貴族。前237年,秦王政因鄭國渠間諜案下令逐客,楚人李斯上書勸諫,歷數穆公、孝公、惠王、昭王皆賴客卿而成霸業,秦王政遂收回成命,復用李斯。",
    en: "From Shang Yang onward Qin regularly appointed outsiders, ministers with no ties to its own nobility, as chancellors, using their talent to check the native aristocracy. In 237 BC, after a spy scandal over the Zheng Guo canal, King Zheng ordered all such outsiders expelled. Li Si, himself from Chu, petitioned against it, listing how earlier Qin rulers had all relied on outsiders to build their power. The king reversed the order and reinstated Li Si.",
    srcZh: "《史記·李斯列傳》",
    srcEn: "Shiji, Biography of Li Si",
  },
  envoy: {
    zh: "秦國推行連橫,常遣使者赴列國游說「事秦以避禍」。張儀曾兼任魏國相國,勸魏王放棄合縱、獨自事秦以求安;晚年他又親赴楚、韓、齊、趙、燕,逐一陳說利害,勸各國拆散合縱,轉而分別與秦結盟。張儀本人即是連橫使節的代表人物。",
    en: "As part of the Horizontal strategy, Qin regularly sent envoys to argue that other states should serve Qin to avoid disaster. Zhang Yi once held the post of chancellor of Wei, urging its king to abandon the alliance and deal with Qin alone. Late in his career he also toured Chu, Han, Qi, Zhao, and Yan, urging each in turn to break with the coalition and side with Qin instead. Zhang Yi himself was the model of this kind of envoy.",
    srcZh: "《史記·張儀列傳》",
    srcEn: "Shiji, Biography of Zhang Yi",
  },
  suqin: {
    zh: "蘇秦游說六國合縱抗秦,身佩六國相印,為縱約長。傳統說法認為合縱約成於前333年,秦兵十五年不敢出函谷關;但帛書《戰國縱橫家書》顯示,蘇秦主要活動較晚,約在齊湣王時。合縱瓦解後,蘇秦在齊為燕行反間,遭爭寵齊大夫遣人行刺,臨死自請齊王車裂其屍於市,以誘出真凶。",
    en: "Su Qin persuaded six states to form the Vertical alliance, carrying all six seals as its leader. Tradition dates the alliance to 333 BC, after which Qin dared not leave Hangu Pass for fifteen years, but an excavated manuscript suggests his career came later, under King Min of Qi. The alliance broke apart; spying for Yan in Qi, Su Qin was stabbed by an assassin sent by rival ministers, and before dying asked the king to tear his corpse by chariots, exposing the real killer.",
    srcZh: "《史記·蘇秦列傳》、帛書《戰國縱橫家書》",
    srcEn: "Shiji, Biography of Su Qin; the Mawangdui silk manuscript Zhanguo zonghengjia shu",
  },
  weiwei: {
    zh: "前354年,魏惠王遣龐涓率兵圍攻趙都邯鄲,趙向齊求救。齊威王以田忌為將、孫臏為軍師出兵,孫臏不直趨邯鄲,反而引兵直逼魏都大梁。龐涓被迫回師救援,齊軍在桂陵設伏,大破魏軍,趙國之圍因此得解,「圍魏救趙」一詞由此而來。",
    en: "In 354 BC, King Hui of Wei sent Pang Juan to besiege Handan, the Zhao capital, and Zhao appealed to Qi for help. King Wei of Qi sent Tian Ji as general with Sun Bin as strategist. Instead of marching straight to Handan, Sun Bin drove toward Daliang, the Wei capital, forcing Pang Juan to turn back. The Qi army ambushed and crushed the returning Wei force at Guiling, lifting the siege of Zhao and giving the phrase its name.",
    srcZh: "《史記·孫子吳起列傳》",
    srcEn: "Shiji, Biographies of Sun Bin and Wu Qi",
  },
  maling: {
    zh: "前341年,魏伐韓,韓向齊求救,齊再用孫臏之計直逼魏都大梁。魏太子申與龐涓回師迎戰,孫臏命齊軍逐日減灶,示敵以弱,誘魏軍輕騎追至馬陵。齊軍伏兵萬弩齊發,龐涓兵敗自殺,太子申被俘,魏軍主力盡沒,魏國霸業自此中衰。",
    en: "In 341 BC, Wei attacked Han, Han appealed to Qi, and Qi again used Sun Bin's plan, marching straight for Daliang. Crown Prince Shen and Pang Juan of Wei turned back to meet them. Sun Bin had the Qi army reduce its cooking fires each day to feign weakness, luring Wei's light cavalry into a trap at Maling. Massed Qi crossbows cut them down, Pang Juan killed himself in defeat, the prince was captured, and Wei's army and its dominance collapsed.",
    srcZh: "《史記·孫子吳起列傳》",
    srcEn: "Shiji, Biographies of Sun Bin and Wu Qi",
  },
  jixia: {
    zh: "齊國在都城臨淄稷門附近設立稷下學宮,招致天下賢士,不任官職而議論國事。齊宣王時學宮「復盛,且數百千人」。孟子、鄒衍、淳于髡、慎到、田駢等皆曾游學於此,荀子更三度出任學宮祭酒,在稷下諸生中「最為老師」。稷下學宮是戰國百家爭鳴最重要的舞台之一。",
    en: "Qi built the Jixia Academy near the Ji gate of its capital Linzi, drawing scholars who held no office but debated public affairs freely. Under King Xuan the academy flourished again, with scholars numbering in the hundreds. Mencius, Zou Yan, Chunyu Kun, Shen Dao, and Tian Pian all studied or taught there, and Xunzi served three times as its senior scholar, eventually honored as the most senior teacher among them.",
    srcZh: "《史記·孟子荀卿列傳》、《史記·田敬仲完世家》",
    srcEn: "Shiji, Biographies of Mencius and Xun Qing; House of Tian Jingzhong Wan",
  },
  wuguo: {
    zh: "前318年,魏、趙、韓、燕、楚五國合縱,推楚懷王為縱約長,合兵攻秦,屯於函谷關下。秦出兵迎擊,五國聯軍未能同心協力,終於大敗而還。這是戰國中期規模最大的一次合縱攻秦,也暴露出六國各懷異心、難以真正一致行動的弱點。",
    en: "In 318 BC, Wei, Zhao, Han, Yan, and Chu formed a coalition under King Huai of Chu as its leader and marched on Qin, camping before Hangu Pass. Qin met them in the field, and the five armies, unable to act as one, were routed and withdrew. It was the largest coalition attack on Qin of the mid Warring States period, and it exposed how little the six states actually trusted or coordinated with one another.",
    srcZh: "《史記·秦本紀》、《史記·六國年表》",
    srcEn: "Shiji, Basic Annals of Qin; Chronological Table of the Six States",
  },
  mozhe: {
    zh: "墨家以善守城著稱,《墨子》書中專有〈備城門〉等篇講述守城之法。公輸般為楚國造雲梯欲攻宋國,墨子聞訊兼程赴楚,與公輸般在楚王面前演示攻守九次,公輸般攻具用盡而墨子守法有餘,並言其弟子禽滑釐等三百人早已在宋城嚴陣以待,楚王因此打消攻宋之意。",
    en: "The Mohists were famous for defending cities, and the book Mozi has whole chapters on fortifying gates and walls. When Gongshu Ban built siege ladders for Chu to attack Song, Mozi traveled there without rest and staged nine mock attacks and defenses before the king of Chu, exhausting every device Gongshu Ban tried. Mozi then revealed that three hundred of his own students already held the Song walls, and the king of Chu called off the attack.",
    srcZh: "《墨子·公輸》",
    srcEn: "Mozi, Gongshu",
  },
  chumieyue: {
    zh: "楚滅越是一個延續的過程。楚威王時(約前333年)大敗越國,殺越王無彊,盡取吳地直至浙江,越國自此瓦解,諸族子孫各自為君,臣服於楚。楚懷王在位期間(約前306年前後),楚進一步「南塞厲門而郡江東」,兼併越地故土,越國殘餘勢力終被楚完全吸收。",
    en: "Chu's conquest of Yue was a gradual process. Under King Wei of Chu, around 333 BC, Chu crushed Yue, killed its king Wujiang, and seized all the old Wu lands up to the Zhe River, after which Yue fell apart into rival lords, each submitting to Chu. Under King Huai, around 306 BC, Chu further \"sealed off Liman Gate and made a commandery of Jiangdong,\" absorbing the remaining Yue territory outright.",
    srcZh: "《史記·越王句踐世家》、《史記·甘茂列傳》",
    srcEn: "Shiji, House of King Goujian of Yue; Biography of Gan Mao",
  },
  youshui: {
    zh: "戰國縱橫家憑三寸之舌游說人主,足以改變一國乃至天下的外交格局。范雎入秦,上書秦昭王,力陳「遠交近攻」之策,主張先取韓、魏,緩攻齊、楚,昭王大悅,拜為客卿,後又拜為相,封為應侯。秦國此後多年的擴張方針,長期依循范雎所定的路線。",
    en: "Warring States persuaders could reshape the diplomacy of an entire realm with argument alone. Fan Ju arrived in Qin and petitioned King Zhaoxiang, urging the policy of befriending distant states while attacking nearby ones, striking Han and Wei first and holding off Qi and Chu. The king was delighted, made him a guest minister, then chancellor, and ennobled him as Lord Ying. Qin's expansion for years afterward followed the course Fan Ju had set.",
    srcZh: "《史記·范雎蔡澤列傳》",
    srcEn: "Shiji, Biographies of Fan Ju and Cai Ze",
  },
  zhizi: {
    zh: "戰國各國常互派太子或公子為人質,以示信約或作為談和的擔保。秦公子異人(後來的秦莊襄王,秦始皇之父)曾被送往趙國邯鄲為質,處境窘迫;商人呂不韋見而視為奇貨,資助他結交趙國權貴,又助他返秦爭得太子之位,異人終於即位為王。",
    en: "Warring States rulers often exchanged princes as hostages to seal a pact or guarantee a peace. Yiren, a Qin prince who later became King Zhuangxiang and was the father of the First Emperor, was sent to Zhao's capital Handan as a hostage and lived there in reduced circumstances. The merchant Lü Buwei saw him as a rare investment, funded his ties to Zhao nobles, and helped him return to Qin and win the position of heir, after which Yiren eventually became king.",
    srcZh: "《史記·呂不韋列傳》",
    srcEn: "Shiji, Biography of Lü Buwei",
  },
  shuoke: {
    zh: "戰國說客善以迂迴譬喻打動人主。趙孝成王時,秦攻趙甚急,趙向齊求救,齊要求以太后幼子長安君為質方肯出兵。太后不肯,群臣力諫皆觸怒她。老臣觸龍先自陳衰老多病,再從疼愛子女、應為子女計長遠說起,指出長安君位尊而無功、奉厚而無勞,終於說動太后遣長安君為質,齊兵乃出。",
    en: "Warring States lobbyists often won over rulers through roundabout, homely talk rather than direct pleas. When Qin attacked Zhao hard and Zhao appealed to Qi, Qi demanded the dowager queen's youngest son as hostage before sending troops. She refused every minister who pressed her and grew angry. The old official Chu Long instead described his own poor health, then how a parent should plan for a child's future, noting her son held rank without earning it. She agreed, and Qi's army marched.",
    srcZh: "《戰國策·趙策》",
    srcEn: "Zhanguo Ce, Stratagems of Zhao",
  },
  huanghe: {
    zh: "黃河貫穿三晉之地,決口氾濫是這一帶常見的天災,也曾被當作攻城的武器。前225年,秦將王賁攻打魏都大梁,引黃河與鴻溝之水灌城,三個月後城壞,魏王假出降,魏國就此滅亡。黃河的水患與人為的謀略,在戰國歷史裡常常交織難分。",
    en: "The Yellow River ran through the Three Jin lands, and its floods were a common natural disaster there, one sometimes turned into a weapon. In 225 BC, Qin general Wang Ben besieged Daliang, the Wei capital, and diverted the Yellow River and the Hong Canal to flood the city. After three months the walls collapsed, King Jia of Wei surrendered, and Wei ceased to exist. Flood and strategy were often hard to tell apart in Warring States warfare.",
    srcZh: "《史記·魏世家》",
    srcEn: "Shiji, House of Wei",
  },
  tiangou: {
    zh: "戰國人視日食為凶兆。《史記·六國年表》數次記載秦國日食,如秦獻公在位期間便有「日蝕,晝晦」及「日蝕」的記事。至於牌名裡的「天狗」,其實另有所指:《史記·天官書》記其為墜地有聲的流星異象,主「千里破軍殺將」,本與日食無關,是後世混為一談的俗稱。",
    en: "Warring States people saw eclipses as ill omens. The Shiji's chronological tables record several eclipses for Qin, including entries reading simply \"eclipse, midday darkness\" and \"eclipse\" under Duke Xian, showing how closely historians tracked such events. The \"heavenly dog\" in the card's name is something else: the Shiji's treatise on celestial patterns calls it a meteor striking the ground with a sound, said to portend armies broken and generals killed, unrelated to eclipses until folklore merged the two.",
    srcZh: "《史記·六國年表》、《史記·天官書》",
    srcEn: "Shiji, Chronological Table of the Six States; Treatise on the Celestial Offices",
  },
  yetie: {
    zh: "戰國各地冶鐵技術漸興,鐵製兵器隨之出現。《荀子·議兵》記楚人以宛地所出鐵矛,鋒利「慘如蜂蠆」。《戰國策·韓策一》稱「天下之強弓勁弩皆自韓出」,又謂韓弩「皆射六百步之外」。馬陵之戰,齊軍萬弩俱發,射殺魏將龐涓,是弩機戰場威力的著名戰例。",
    en: "Ironworking spread across the Warring States, and iron weapons appeared with it. The Xunzi records that Chu spearheads forged from Wan iron were \"as fierce as a hornet's sting.\" The Zhanguo Ce says the strongest bows and crossbows in the world all came from Han, adding that Han crossbows \"could shoot beyond six hundred paces.\" At Maling, the massed volley of Qi crossbows that killed the Wei general Pang Juan remains the best known demonstration of what they could do.",
    srcZh: "《荀子·議兵》、《戰國策·韓策一》",
    srcEn: "Xunzi, Debating Military Affairs; Zhanguo Ce, Stratagems of Han",
  },
  zhouzuo: {
    zh: "周天子致胙(祭肉)、致伯是天子對強國示好的殊禮,不是正式的冊封。周顯王九年(約前360年),周天子致文王、武王的祭肉予秦孝公;二十六年,又致伯於秦孝公;三十五年,再致文武胙於秦惠王。",
    en: "The Zhou king sending sacrificial meat, or granting the title of hegemon, was a courtesy the fading royal house paid to rising powers, not a formal investiture. In the ninth year of King Xian, around 360 BC, the king sent Duke Xiao of Qin the meat once offered to Kings Wen and Wu; in the twenty-sixth year he granted Duke Xiao the title; in the thirty-fifth year he sent King Hui of Qin the same meat again.",
    srcZh: "《史記·周本紀》",
    srcEn: "Shiji, Basic Annals of Zhou",
  },
  daji: {
    zh: "戰國饑荒頻仍,是列國常須應對的難題。《孟子·梁惠王上》記魏惠王自述治國之法:河內遇饑荒,便將當地百姓遷往河東,把河東的糧食運來河內賑濟;河東遇饑荒時也依此法反向調度。孟子卻指出,鄰國治理未必更差,魏國百姓卻不見增多,問題不在賑災的手法,而在根本的仁政。",
    en: "Famine was a recurring problem the Warring States had to manage. In the Mencius, King Hui of Wei describes his method: when Henei suffered famine he moved its people to Hedong and shipped Hedong's grain back to feed them, and did the reverse when Hedong went hungry. Mencius answered that neighboring states were not obviously worse governed, yet Wei's population had not grown, so the flaw lay not in the relief method but in the absence of true benevolent rule.",
    srcZh: "《孟子·梁惠王上》",
    srcEn: "Mengzi, King Hui of Liang I",
  },

  // #36 batch 2: 縱橫期 (era: "alliance"), excluding mianchi above.
  zhangyi2: {
    zh: "前313年,張儀入楚,重賄大臣靳尚、寵姬鄭袖,游說楚懷王與齊絕交,許以商於之地六百里。絕齊之後,秦使只認六里,懷王大怒,發兵擊秦,兵敗於丹陽,喪師八萬,大將屈匄被虜,漢中之地亦入於秦。楚又悉起國兵再攻秦,復敗於藍田。齊因楚先絕交,不肯救楚。",
    en: "In 313 BC, Zhang Yi went to Chu, bribing a minister and the king's favorite consort, and persuaded King Huai of Chu to break with Qi for six hundred li of land at Shangyu. Once Chu broke with Qi, Qin's envoy admitted to only six li. The furious king attacked Qin and was crushed at Danyang, losing eighty thousand men and his general Qu Gai, plus Hanzhong; a second attack was again defeated at Lantian. Qi, angered by the earlier betrayal, refused to help.",
    srcZh: "《史記·楚世家》、《史記·張儀列傳》",
    srcEn: "Shiji, House of Chu; Biography of Zhang Yi",
  },
  yiyang: {
    zh: "前308年,秦武王欲通三川以窺周室,命甘茂率兵攻韓國重鎮宜陽。甘茂恐中途生變,先與武王在息壤立誓,約定縱有阻撓亦不中止。宜陽久攻不下,武王一度欲罷兵,甘茂以息壤之言相責,武王遂增兵五萬,前307年攻克宜陽,斬首六萬。同年武王入周室舉鼎,絕臏而死。",
    en: "In 308 BC, King Wu of Qin wanted a route to the Zhou capitals and ordered Gan Mao to attack Yiyang, a key Han stronghold. Fearing the king might waver, Gan Mao first made him swear an oath at Xirang to see it through. The siege dragged on and the king considered stopping, but Gan Mao invoked the oath, more troops came, and Yiyang fell in 307 BC with sixty thousand dead. That year King Wu died in Zhou after a tripod fell on him.",
    srcZh: "《史記·甘茂列傳》、《史記·秦本紀》",
    srcEn: "Shiji, Biography of Gan Mao; Basic Annals of Qin",
  },
  huaiwang: {
    zh: "前299年,秦昭王邀楚懷王會於武關,聲稱結盟修好。屈原、昭雎等力諫勿往,懷王之子子蘭勸其赴會,懷王遂行,一入武關即被秦兵劫持,挾以割地。懷王不肯,遂被扣留,後尋機逃亡未成,三年後客死於秦,楚人聞之皆悲,如喪親戚。",
    en: "In 299 BC, King Zhao of Qin invited King Huai of Chu to a meeting at Wuguan, claiming he wanted to renew friendly relations. Qu Yuan and Zhao Ju urged him not to go, but the king's son Zilan pressed him to attend, and King Huai went. He was seized on entering the pass and pressured to cede land. He refused, was held prisoner, later failed to escape, and died in Qin three years afterward; his people mourned him as a close relative.",
    srcZh: "《史記·楚世家》、《史記·屈原賈生列傳》",
    srcEn: "Shiji, House of Chu; Biography of Qu Yuan and Jia Yi",
  },
  baiqi: {
    zh: "前293年,秦將白起在伊闕大破韓、魏聯軍,斬首二十四萬,虜魏將公孫喜,連拔五城,韓、魏元氣大傷。白起長於野戰殲敵,此戰後屢建戰功,累官至武安君,是秦國東出時期最令六國畏懼的將領之一。",
    en: "In 293 BC, the Qin general Bai Qi crushed the combined armies of Han and Wei at Yique, taking two hundred and forty thousand heads, capturing the Wei general Gongsun Xi, and seizing five cities, leaving Han and Wei badly weakened. Skilled at destroying armies in open battle, Bai Qi went on to a long run of victories and rose to the rank of Lord Wu'an, becoming one of the generals the six states feared most as Qin pushed east.",
    srcZh: "《史記·白起王翦列傳》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian",
  },
  yueyi: {
    zh: "前284年,燕昭王以樂毅為上將軍,聯合秦、韓、趙、魏合縱伐齊,大敗齊軍於濟西。樂毅其後獨率燕軍長驅直入,攻下齊都臨淄,連下齊七十餘城,僅莒、即墨未下。齊湣王出奔,後死於莒,齊國幾乎亡國。",
    en: "In 284 BC, King Zhao of Yan made Yue Yi supreme commander of a coalition with Qin, Han, Zhao, and Wei against Qi, crushing the Qi army west of the Ji River. Yue Yi then drove his Yan forces alone deep into Qi territory, took the capital Linzi, and captured more than seventy cities, leaving only Ju and Jimo unconquered. King Min of Qi fled and was later killed at Ju; Qi came close to being wiped out entirely.",
    srcZh: "《史記·樂毅列傳》、《史記·田敬仲完世家》",
    srcEn: "Shiji, Biography of Yue Yi; House of Tian Jingzhong Wan",
  },
  poying: {
    zh: "前278年,秦將白起率軍攻楚,攻破楚都郢,焚燒楚先王陵墓夷陵,楚頃襄王倉皇東遷,以陳為都。白起因此功封為武安君。郢都之陷,對楚人是巨大的心理打擊,傳統上多將屈原投江之死繫於此後不久。",
    en: "In 278 BC, the Qin general Bai Qi captured Ying, the Chu capital, and burned the royal tombs at Yiling. King Qingxiang of Chu fled east and made Chen the new capital. Bai Qi was rewarded with the title Lord Wu'an for the victory. The fall of Ying was a severe blow to Chu morale, and tradition generally places Qu Yuan's suicide by drowning not long after it.",
    srcZh: "《史記·白起王翦列傳》、《史記·楚世家》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian; House of Chu",
  },
  yuanjiao: {
    zh: "前270年,秦欲越韓、魏攻打齊國剛、壽,范雎諫阻,對秦昭王說:「王不如遠交而近攻,得寸,則王之寸也;得尺,亦王之尺也。」主張先攻鄰近的韓、魏,才是真正可守之地。昭王從其言,轉而攻韓,范雎因此漸受重用,前266年拜為丞相。",
    en: "In 270 BC, Qin considered marching past Han and Wei to attack Gang and Shou in Qi. Fan Ju argued against it, telling King Zhao of Qin that befriending distant states while attacking near ones was better: land taken from a neighbor is truly yours, land taken far away is not. He urged attacking Han and Wei first instead, since they could actually be held. The king agreed, turned against Han, and Fan Ju rose steadily, becoming chancellor by 266 BC.",
    srcZh: "《史記·范雎蔡澤列傳》",
    srcEn: "Shiji, Biographies of Fan Ju and Cai Ze",
  },
  xidi: {
    zh: "前288年十月,秦昭襄王自稱「西帝」,同時尊齊湣王為「東帝」,兩強並立、瓜分天下之意甚明。蘇代(蘇秦之弟)勸齊湣王及早去帝號,以爭取列國支持、共謀伐秦。齊湣王從其議,不久便去帝號,仍稱王,秦昭王隨後也被迫取消帝號。",
    en: "In October 288 BC, King Zhao of Qin declared himself the Western Emperor while honoring King Min of Qi as the Eastern Emperor, an open bid by the two strongest states to divide the realm. Su Dai, Su Qin's younger brother, urged King Min to drop the title quickly so Qi could rally the other states against Qin instead. King Min agreed, gave up the title within two months while keeping the rank of king, and Qin soon abandoned its own title too.",
    srcZh: "《史記·田敬仲完世家》、《史記·蘇秦列傳》",
    srcEn: "Shiji, House of Tian Jingzhong Wan; Biography of Su Qin",
  },
  hufu: {
    zh: "前307年,趙武靈王推行「胡服騎射」:改穿胡人短衣窄袖,訓練騎兵,捨棄傳統以車戰為主的舊制。此議遭公子成等宗室大臣反對,武靈王親自登門勸說,公子成終於帶頭改穿胡服。趙國軍力因此大增,其後北滅中山,拓地至雲中、雁門、代郡一帶。",
    en: "In 307 BC, King Wuling of Zhao introduced Hufu Qishe: adopting short, close-fitting nomad dress and training cavalry, abandoning the old chariot-based army. The reform met resistance from royal relatives led by Lord Cheng, so the king personally visited him to argue his case, and Lord Cheng was the first to wear the new dress. Zhao's military strength grew sharply afterward, and it went on to destroy the state of Zhongshan and expand north to Yunzhong, Yanmen, and Dai.",
    srcZh: "《史記·趙世家》",
    srcEn: "Shiji, House of Zhao",
  },
  mengchang: {
    zh: "孟嘗君田文是齊國宗室,以廣納門客著稱,號稱食客三千,封地在薛。他曾入秦為相,秦昭王一度欲扣留殺害,賴門客學狗盜偷得狐白裘賄賂秦王寵妃、又學雞鳴騙開函谷關城門,才驚險逃回齊國。「雞鳴狗盜」一詞,即由此而來。",
    en: "Lord Mengchang, Tian Wen, was a Qi noble famous for keeping thousands of retainers and holding the fief of Xue. Serving as chancellor of Qin, King Zhao once tried to detain and kill him; a retainer skilled at burglary stole back a white fox-fur robe to bribe the king's consort for his release, and another who could crow like a rooster tricked the guards into opening Hangu Pass early, letting him escape home. The phrase for such petty but useful tricks comes from this episode.",
    srcZh: "《史記·孟嘗君列傳》",
    srcEn: "Shiji, Biography of Lord Mengchang",
  },
  hezong: {
    zh: "前298年,齊湣王以孟嘗君為縱約長,聯合韓、魏合縱攻秦,歷時三年,前296年攻破函谷關。秦被迫求和,割河外、武遂予韓,割封陵予魏。這是戰國中期關東合縱難得的一次實質戰果,也是函谷關少數真正被攻破的紀錄之一。",
    en: "In 298 BC, King Min of Qi made Lord Mengchang leader of a coalition with Han and Wei against Qin. After three years of fighting they broke through Hangu Pass in 296 BC, and Qin had to sue for peace, ceding the Hewai region and Wusui to Han and Fengling to Wei. It was one of the rare real successes an eastern coalition achieved against Qin in the mid Warring States period, and one of the few times Hangu Pass was actually breached.",
    srcZh: "《史記·孟嘗君列傳》、《史記·六國年表》",
    srcEn: "Shiji, Biography of Lord Mengchang; Chronological Table of the Six States",
  },
  tiandan: {
    zh: "前279年,燕將樂毅久攻即墨不下,燕惠王中齊將田單的反間計,懷疑樂毅擁兵自重,改以騎劫為將。田單趁夜以火牛陣突襲燕軍,燕軍大亂,騎劫戰死,齊軍乘勝追擊,收復失地七十餘城,迎齊襄王返臨淄復國。",
    en: "In 279 BC, the Yan general Yue Yi had besieged Jimo, the last Qi stronghold, without success. King Hui of Yan fell for a rumor spread by the Qi general Tian Dan suggesting Yue Yi had ambitions of his own, and replaced him with Qi Jie. Tian Dan launched a night attack using cattle with blades on their horns and fire on their tails, routing the Yan army; Qi Jie died, and Qi recovered more than seventy cities and restored the king to Linzi.",
    srcZh: "《史記·田單列傳》",
    srcEn: "Shiji, Biography of Tian Dan",
  },
  wanbi: {
    zh: "前283年,趙惠文王得楚國和氏璧,秦昭王聞訊,願以十五城交換。趙王恐給璧不得城、又恐拒絕招怒,遣藺相如奉璧使秦。相如見秦王無意償城,便藉口璧有瑕疵取回璧,暗中派人抄小路送璧歸趙,自己則留秦廷從容應對,聲言情願就死,秦王終究未殺他,放他回趙。此事只見於《史記》。",
    en: "In 283 BC, King Huiwen of Zhao acquired the He Shi Bi jade, and King Zhao of Qin offered fifteen cities for it. Fearing to be cheated either way, Zhao sent Lin Xiangru to Qin with the jade. Seeing Qin had no intention of paying, Lin Xiangru claimed a flaw in the jade to take it back, secretly sent it home, and stayed in the Qin court prepared to die. Qin spared him and let him return; the episode is known only from the Shiji.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  yuyu: {
    zh: "前269年,秦軍攻趙國閼與,趙將趙奢奉命救援。他先按兵不動二十八日,麻痹秦軍探子,再急行軍兩日一夜趕至前線,採納部將許歷之議搶先佔據北山制高點。秦軍後至,爭山不得上,趙奢縱兵反擊,大破秦軍,解閼與之圍。趙奢因功封為馬服君。",
    en: "In 269 BC, Qin attacked Yuyu in Zhao, and the general Zhao She was sent to relieve it. He first camped without advancing for twenty-eight days to lull Qin's scouts, then marched two days and a night to reach the front and, on his officer Xu Li's advice, seized the high ground at Beishan first. The Qin force arrived too late to take the hill, and Zhao She's counterattack crushed them, lifting the siege. Zhao She was ennobled as Lord Mafu for the victory.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  quyuan: {
    zh: "屈原是楚國貴族,曾任左徒,主張聯齊抗秦,遭上官大夫靳尚等讒害,先後被楚懷王、楚頃襄王疏遠流放。前278年,秦將白起攻破楚都郢,屈原眼見國破,傳統上以為他自沉汨羅江而死,確切年月《史記》本傳未詳載。他所作的《離騷》等辭賦,是楚辭的代表作品。",
    en: "Qu Yuan was a Chu noble who served as Left Marshal, argued for an alliance with Qi against Qin, and was slandered by the official Jin Shang before being exiled by both King Huai and King Qingxiang. In 278 BC, after Qin's general Bai Qi captured Ying, Qu Yuan, seeing his state fall, is traditionally said to have drowned himself in the Miluo River, though the Shiji gives no exact date. His poems, including the Li Sao, are the founding works of Chu ci verse.",
    srcZh: "《史記·屈原賈生列傳》",
    srcEn: "Shiji, Biography of Qu Yuan and Jia Yi",
  },
  huangjintai: {
    zh: "燕昭王即位後(約前312年),欲振興燕國、雪齊破燕之恥,向謀臣郭隗請教招賢之法。郭隗以「千金買骨」的故事勸諫,並自請「先從隗始」為表率。昭王於是築黃金臺,置千金於臺上,以此號召天下賢士,樂毅、鄒衍、劇辛等人才因此陸續來投燕國。",
    en: "After becoming king around 312 BC, King Zhao of Yan wanted to rebuild his state and avenge Qi's earlier conquest of it, and asked his advisor Guo Wei how to attract talent. Guo Wei told him the parable of paying a fortune for a dead horse's bones, urging the king to start by honoring him as proof of sincerity. The king built the Golden Terrace, piled gold on it, and called for talent; Yue Yi, Zou Yan, and Ju Xin all came to serve.",
    srcZh: "《史記·燕召公世家》、《戰國策·燕策一》",
    srcEn: "Shiji, House of Yan; Zhanguo Ce, Stratagems of Yan",
  },
  qimiesong: {
    zh: "前286年,齊湣王出兵滅宋,宋王偃因暴虐無道,號稱「桀宋」。齊國因此獨得宋地,國力大增,卻也讓列國心生猜忌,認為齊國坐大威脅均勢。滅宋之舉成為兩年後燕、秦、韓、趙、魏五國合縱伐齊的導火線之一。",
    en: "In 286 BC, King Min of Qi sent an army to destroy Song, whose king, Yan, was so notoriously cruel that people called him the Tyrant of Song. Qi's conquest gave it Song's territory and swelled its power, but it also alarmed the other states, who saw Qi's rise as a threat to the balance of power. The destruction of Song became one of the triggers for the five-state coalition that attacked Qi two years later.",
    srcZh: "《史記·宋微子世家》、《史記·田敬仲完世家》",
    srcEn: "Shiji, House of Song; House of Tian Jingzhong Wan",
  },
  shanglv: {
    zh: "白圭是魏文侯時人,以善於掌握時機買賣貨物聞名。《史記·貨殖列傳》說他「人棄我取,人取我與」,豐年買進穀物、賣出絲漆,荒年反其道而行,因此致富。白圭自比治產如伊尹、呂尚之謀,孫吳用兵,商鞅行法,後世商人多奉他為經商始祖。",
    en: "Bai Gui lived under Marquis Wen of Wei and was known for reading the market's timing. The Shiji's Records on the Money-Makers quotes his rule: sell when others buy, buy when others sell. He bought grain in good harvests and sold silk and lacquer, reversing the trade in lean years, building his fortune this way. Bai Gui likened his methods to the statecraft of Yi Yin and the lawmaking of Shang Yang; later merchants honored him as their founder.",
    srcZh: "《史記·貨殖列傳》",
    srcEn: "Shiji, Records on the Money-Makers",
  },
  yili: {
    zh: "戰國疫病流行時有記載。《史記·六國年表》記秦獻公在位期間有「民大疫」的紀事,與同年「日蝕」並列。這類疫病與異象的記錄,顯示戰國史官習慣把天災人禍一併寫入紀年,視為值得留意的國家大事。",
    en: "Warring States chronicles do record epidemics. The Shiji's chronological tables list a year during the reign of Duke Xian of Qin with the entry \"great plague among the people,\" recorded alongside a solar eclipse in the same year. Records like these show that Warring States historians routinely noted disease outbreaks and celestial omens together, treating them as events worth remembering in a state's official year-by-year record.",
    srcZh: "《史記·六國年表》",
    srcEn: "Shiji, Chronological Table of the Six States",
  },
  changcheng: {
    zh: "戰國多國各自修築長城以防外敵。燕昭王時,燕將秦開曾為質於東胡,深得信任,歸國後率兵大破東胡,東胡卻地千餘里。燕國在新拓邊境修築長城,自造陽至襄平,並置上谷、漁陽、右北平、遼西、遼東五郡以為防禦。趙、秦兩國其後也各自在北疆修築長城,後世常將三者相提並論。",
    en: "Several Warring States built long walls against outside enemies. Under King Zhao of Yan, the general Qin Kai had once been a hostage among the Donghu and won their trust; on returning he crushed them, pushing their border back over a thousand li. Yan then built a wall along its new frontier and set up five commanderies, Shanggu, Yuyang, Youbeiping, Liaoxi, and Liaodong, for defense. Zhao and Qin later built their own northern walls.",
    srcZh: "《史記·匈奴列傳》",
    srcEn: "Shiji, Treatise on the Xiongnu",
  },
  ximin: {
    zh: "戰國到秦統一之初,朝廷常把內地人口強制遷往新占的邊境地區,以充實邊防、鞏固統治。秦始皇三十三年(前214年),蒙恬北逐匈奴,取河南地,沿河修築四十四座縣城,又渡河攻取高闕、陽山一帶,將獲罪流放的百姓「徙謫,實之初縣」。",
    en: "From the Warring States into the early Qin empire, courts often forced inland populations to resettle on newly won frontier land to secure it and hold the border. In 214 BC, the thirty-third year of the First Emperor, Meng Tian drove the Xiongnu north, took the land south of the river, built forty-four walled counties along it, and crossed to seize Gaoque and Yangshan, moving convicted exiles there to fill out the new counties.",
    srcZh: "《史記·秦始皇本紀》",
    srcEn: "Shiji, Basic Annals of the First Emperor",
  },
};

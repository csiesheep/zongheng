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
    zh: "前313年,張儀入楚,游說楚懷王絕齊,許以商於六百里地。絕齊後,秦使只認六里,懷王怒而伐秦,敗於丹陽,喪師八萬,大將屈匄被虜,漢中入秦;楚再攻秦,復敗於藍田。前311年張儀二度入楚,懷王囚而欲殺之,他重賄靳尚,靳尚說動楚王寵姬鄭袖為他求情,才得以脫身返秦。",
    en: "In 313 BC, Zhang Yi persuaded King Huai of Chu to break with Qi for six hundred li at Shangyu. Once Chu broke with Qi, Qin admitted to only six li. The furious king attacked Qin and was crushed at Danyang, losing eighty thousand men and his general Qu Gai, plus Hanzhong; a second attack was defeated at Lantian. In 311 BC he returned to Chu, was seized by King Huai, and bribed the minister Jin Shang, who talked the consort into pleading for him.",
    srcZh: "《史記·張儀列傳》、《史記·楚世家》",
    srcEn: "Shiji, Biography of Zhang Yi; House of Chu",
  },
  yiyang: {
    zh: "前308年,秦武王欲通三川以窺周室,命甘茂率兵攻韓國重鎮宜陽。甘茂恐中途生變,先與武王在息壤立誓,約定縱有阻撓亦不中止。宜陽久攻不下,武王一度欲罷兵,甘茂以息壤之言相責,秦於是傾全力再攻,前307年攻克宜陽,斬首六萬。同年武王入周舉鼎,絕臏而死。",
    en: "In 308 BC, King Wu of Qin wanted a route to Zhou and sent Gan Mao to attack Yiyang, a Han stronghold. Fearing the king might waver, Gan Mao made him swear an oath at Xirang to see it through. The siege dragged on and the king wavered, but Gan Mao invoked the oath, Qin threw its full strength at the city, and Yiyang fell in 307 BC with sixty thousand dead. King Wu died that year after a tripod he lifted broke his leg.",
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
    zh: "前293年,秦將白起在伊闕大破韓、魏聯軍,斬首二十四萬,虜魏將公孫喜,連拔五城,韓、魏元氣大傷。白起長於野戰殲敵,此戰後屢建戰功,後封為武安君,是秦國東出時期最令六國畏懼的將領之一。",
    en: "In 293 BC, the Qin general Bai Qi crushed the combined armies of Han and Wei at Yique, taking two hundred and forty thousand heads, capturing the Wei general Gongsun Xi, and seizing five cities, leaving Han and Wei badly weakened. Skilled at destroying armies in open battle, Bai Qi went on to a long run of victories and was later granted the title Lord Wu'an, becoming one of the generals the six states feared most as Qin pushed east.",
    srcZh: "《史記·白起王翦列傳》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian",
  },
  yueyi: {
    zh: "前284年,燕昭王以樂毅為上將軍,聯合秦、韓、趙、魏五國伐齊,大敗齊軍於濟西。樂毅其後獨率燕軍長驅直入,攻下齊都臨淄,連下齊七十餘城,僅莒、即墨未下。齊湣王出奔,後死於莒,齊國幾乎亡國。",
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
    zh: "前270年,秦欲越韓、魏攻打齊國剛、壽,范雎諫阻,對秦昭王說:「王不如遠交而近攻,得寸,則王之寸也;得尺,亦王之尺也。」昭王從其言,先命五大夫綰伐魏,拔懷,兩年後又拔邢丘,其後才轉而攻韓。范雎因此漸受重用,前266年拜為丞相。",
    en: "In 270 BC, Qin considered marching past Han and Wei to attack Gang and Shou in Qi. Fan Ju argued against it, telling King Zhao of Qin that befriending distant states while attacking near ones was better: land taken from a neighbor is truly yours, land taken far away is not. The king agreed, first sending the officer Wan to attack Wei and take Huai, then Xingqiu two years later, before turning against Han. Fan Ju rose steadily in favor, becoming chancellor by 266 BC.",
    srcZh: "《史記·范雎蔡澤列傳》",
    srcEn: "Shiji, Biographies of Fan Ju and Cai Ze",
  },
  xidi: {
    zh: "前288年十月,秦昭襄王自稱「西帝」,同時尊齊湣王為「東帝」,兩強並立、瓜分天下之意甚明。蘇代(蘇秦之弟)勸齊湣王及早去帝號,以爭取列國支持、共謀伐秦。齊湣王從其議,同年十二月便去帝號,仍稱王,秦昭王隨後也被迫取消帝號。",
    en: "In the tenth month of 288 BC, King Zhao of Qin declared himself the Western Emperor, honoring King Min of Qi as the Eastern Emperor, a bid to divide the realm between the two strongest states. Su Dai, Su Qin's younger brother, urged King Min to drop the title quickly so Qi could rally the other states against Qin instead. King Min agreed, gave up the title that twelfth month while keeping the rank of king, and Qin soon abandoned its own title too.",
    srcZh: "《史記·田敬仲完世家》、《史記·六國年表》",
    srcEn: "Shiji, House of Tian Jingzhong Wan; Chronological Table of the Six States",
  },
  hufu: {
    zh: "前307年,趙武靈王欲行「胡服騎射」:改穿胡人短衣窄袖,訓練騎兵,捨棄傳統以車戰為主的舊制。他先自己改穿胡服,又遣王緤勸說反對的公子成,公子成稱病拒絕,武靈王便親自登門說服。公子成終於接受,次日改穿胡服上朝,趙國才正式下令推行。",
    en: "In 307 BC, King Wuling of Zhao wanted to introduce nomad dress and mounted archery: adopting short, close-fitting dress and training cavalry, abandoning the old chariot-based army. He first wore the new dress himself, then sent an envoy named Wang Xie to win over Lord Cheng, who refused, pleading illness; the king then visited Cheng's home in person and persuaded him. Cheng accepted and wore it to court the next day, and only then did Zhao formally decree the change.",
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
    zh: "前298年,齊相孟嘗君與韓、魏合兵攻秦,借兵糧於西周。三國聯軍歷時三年,前296年進逼至鹽氏而還,秦被迫與韓、魏議和,割黃河以北之地及封陵求和。",
    en: "In 298 BC, Lord Mengchang, chancellor of Qi, joined Han and Wei in attacking Qin, borrowing troops and grain from the Western Zhou court. The three armies campaigned for three years and advanced to Yanshi in 296 BC before turning back; Qin was forced to make peace with Han and Wei, ceding land north of the Yellow River and the town of Fengling.",
    srcZh: "《史記·秦本紀》、《史記·孟嘗君列傳》",
    srcEn: "Shiji, Basic Annals of Qin; Biography of Lord Mengchang",
  },
  tiandan: {
    zh: "前279年,燕將樂毅久攻即墨不下,燕惠王中齊將田單的反間計,懷疑樂毅擁兵自重,改以騎劫為將。田單趁夜以火牛陣突襲燕軍,燕軍大亂,騎劫戰死,齊軍乘勝追擊,收復失地七十餘城,迎齊襄王返臨淄復國。",
    en: "In 279 BC, the Yan general Yue Yi had besieged Jimo, one of Qi's last two strongholds, without success. King Hui of Yan fell for a rumor spread by the Qi general Tian Dan suggesting Yue Yi had ambitions of his own, and replaced him with Qi Jie. Tian Dan launched a night attack using cattle with blades on their horns and fire on their tails, routing the Yan army; Qi Jie died, and Qi recovered more than seventy cities and restored the king.",
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
    zh: "前269年,秦軍攻趙國閼與,趙將趙奢奉命救援。他先按兵不動二十八日,麻痹秦軍探子,再急行軍兩日一夜趕至前線,採納軍士許歷之議搶先佔據北面山頭。秦軍後至,爭山不得上,趙奢縱兵反擊,大破秦軍,解閼與之圍。趙奢因功封為馬服君。",
    en: "In 269 BC, Qin attacked Yuyu in Zhao, and Zhao She was sent to relieve it. He camped without advancing for twenty-eight days to lull Qin's scouts, then marched two days and a night to reach the front and, on a soldier named Xu Li's advice, seized the high ground on a hill to the north first. The Qin force arrived too late to take it, and Zhao She's counterattack crushed them, lifting the siege. Zhao She was ennobled Lord Mafu for it.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  quyuan: {
    zh: "屈原是楚國貴族,曾任左徒,主張聯齊抗秦,遭上官大夫讒害,先被楚懷王疏遠,頃襄王時又被放逐。前278年,秦將白起攻破楚都郢,屈原眼見國破,傳統上以為他自沉汨羅江而死,確切年月《史記》本傳未詳載。他所作的《離騷》等辭賦,是楚辭的代表作品。",
    en: "Qu Yuan was a Chu noble who held the office of Left Minister, or zuotu, argued for alliance with Qi against Qin, and was slandered by the official Shangguan. King Huai grew estranged from him, and King Qingxiang later banished him. In 278 BC, after Qin's general Bai Qi took Ying, Qu Yuan, seeing his state fall, is traditionally said to have drowned himself in the Miluo River, though the Shiji gives no exact date. His poems, including the Li Sao, founded Chu ci verse.",
    srcZh: "《史記·屈原賈生列傳》",
    srcEn: "Shiji, Biography of Qu Yuan and Jia Yi",
  },
  huangjintai: {
    zh: "燕昭王即位後(約前311年),欲雪齊破燕之恥,向謀臣郭隗請教招賢之法。郭隗以千金買馬骨的故事勸諫,並自請「先從隗始」為表率。昭王為郭隗改建宮室,以師禮事之,樂毅、鄒衍、劇辛等因此陸續來投。後世相傳昭王曾築臺置金以待賢士,即黃金臺一名的由來。",
    en: "After becoming king around 311 BC, King Zhao of Yan wanted to avenge Qi's conquest and asked Guo Wei how to attract talent. Guo Wei told the parable of paying a fortune for a dead horse's bones, urging the king to honor him first. The king built Guo Wei a residence and treated him as a teacher; Yue Yi, Zou Yan, and Ju Xin came to serve. Later tradition held the king piled gold on a terrace to invite talent, giving this card its name.",
    srcZh: "《史記·燕召公世家》、《戰國策·燕策一》",
    srcEn: "Shiji, House of Yan; Zhanguo Ce, Stratagems of Yan",
  },
  qimiesong: {
    zh: "前286年,齊湣王出兵滅宋,宋王偃因暴虐無道,號稱「桀宋」。〈宋微子世家〉記齊聯合魏、楚滅宋,三分其地;〈田敬仲完世家〉則只記齊滅宋,未提三分。無論何者為是,齊國滅宋都讓列國心生猜忌,認為齊國坐大威脅均勢,成為兩年後五國伐齊的導火線之一。",
    en: "In 286 BC, King Min of Qi destroyed Song, whose king, Yan, was so cruel that people called him the Tyrant of Song. The Shiji's House of Song has Qi joining Wei and Chu to destroy Song and split its land three ways; its House of Tian Jingzhong Wan credits Qi alone. Either way, the conquest alarmed the other states, who saw Qi's rise as a threat, and it became one of the triggers for the coalition that attacked Qi two years later.",
    srcZh: "《史記·宋微子世家》、《史記·田敬仲完世家》",
    srcEn: "Shiji, House of Song; House of Tian Jingzhong Wan",
  },
  shanglv: {
    zh: "白圭是周人,活躍於魏文侯時代,以善於掌握時機買賣貨物聞名。《史記·貨殖列傳》說他「人棄我取,人取我與」:穀物豐收時買進穀物、賣出絲漆,蠶繭盛產時買進帛絮、賣出糧食,順應時節逐利而致富。白圭自比治產如伊尹、呂尚之謀,孫吳用兵,商鞅行法,後世商人多奉他為經商始祖。",
    en: "Bai Gui was a man of the Zhou domain in the time of Marquis Wen of Wei, known for reading the market. The Shiji's Records on the Money-Makers quotes his rule: sell when others buy, buy when others sell. In good harvests he bought grain and sold silk and lacquer; when cocoons came in, he bought silk floss and sold grain, following the seasons to profit. Bai Gui likened his methods to Yi Yin's statecraft and Shang Yang's lawmaking; merchants honored him as their founder.",
    srcZh: "《史記·貨殖列傳》",
    srcEn: "Shiji, Records on the Money-Makers",
  },
  yili: {
    zh: "戰國疫病流行時有記載。《史記·六國年表》秦國前369年條記「民大疫,日蝕」,兩件事同年並列。前243年(秦王政四年),《史記·秦始皇本紀》又記「蝗蟲從東方來,蔽天。天下疫。」",
    en: "Warring States chronicles do record epidemics. The Shiji's chronological tables list, for Qin in 369 BC, the entry \"great plague among the people, an eclipse,\" the two recorded together in the same year. In 243 BC, the fourth year of the future First Emperor, the Shiji's Basic Annals record a locust swarm from the east that darkened the sky, adding \"there was plague across the realm.\"",
    srcZh: "《史記·六國年表》、《史記·秦始皇本紀》",
    srcEn: "Shiji, Chronological Table of the Six States; Basic Annals of the First Emperor",
  },
  changcheng: {
    zh: "戰國多國修築長城防外敵。《史記·匈奴列傳》記秦昭王滅義渠後修隴西、北地、上郡長城拒胡;趙武靈王胡服騎射後,築長城自代至陰山,置雲中、雁門、代郡。其後燕將秦開曾質於東胡,深得信任,歸國後大破東胡,燕因此築長城,自造陽至襄平,置五郡。此事一般認為在燕昭王時。",
    en: "Several Warring States built long walls against outsiders. The Shiji's Treatise on the Xiongnu says Qin, after destroying the Yiqu, built walls in Longxi, Beidi, and Shangjun; Zhao built a wall from Dai to the Yin Mountains after adopting nomad dress and mounted archery. After that, the Yan general Qin Kai, once a hostage among the Donghu who won their trust, crushed them and pushed their border back, and Yan built a wall too. This is usually dated to King Zhao of Yan's reign.",
    srcZh: "《史記·匈奴列傳》",
    srcEn: "Shiji, Treatise on the Xiongnu",
  },
  ximin: {
    zh: "戰國到秦統一之初,朝廷常把人口遷往新占邊境以充實邊防。秦昭襄王二十一年(前286年),魏獻安邑,秦遷出魏人,招募百姓徙居河東並賜爵,又赦罪人遷去充實當地,二十六、二十七年又分遷穰與南陽。秦始皇三十二年(前215年)蒙恬逐匈奴,次年朝廷才把罪人遷去充實新縣。",
    en: "From the Warring States into the early Qin empire, courts forced populations onto newly won frontier land to secure the border. In the twenty-first year of King Zhaoxiang, 286 BC, Wei surrendered Anyi, Qin moved out its people, recruited settlers for Hedong with rank, and pardoned convicts to fill the area, then made similar moves to Rang and Nanyang. In the First Emperor's thirty-second year, 215 BC, Meng Tian drove out the Xiongnu; only the next year were convicts moved to fill the new counties.",
    srcZh: "《史記·秦本紀》、《史記·秦始皇本紀》",
    srcEn: "Shiji, Basic Annals of Qin; Basic Annals of the First Emperor",
  },

  // #36 batch 3: 兼併期 (era: "conquest"), all 20 cards.
  changping: {
    zh: "前262年,秦攻韓野王,截斷上黨與韓國本土的聯繫,上黨太守遂舉城降趙。前260年,秦趙兩軍在長平對峙,趙以趙括代廉頗為將,冒進出擊,被秦將白起分割包圍,趙軍斷糧四十六日。趙括突圍戰死,四十餘萬降卒盡遭白起坑殺,《史記》本傳的這個數字後世史家多有存疑。",
    en: "In 262 BC, Qin attacked Han's Yewang, cutting Shangdang off from Han, and its governor surrendered it to Zhao instead. In 260 BC, Qin and Zhao faced off at Changping. Zhao replaced Lian Po with the untested Zhao Kuo, who advanced rashly and was surrounded by the Qin general Bai Qi, his army starving forty-six days before he died breaking out. Bai Qi then had the surrendered troops, over four hundred thousand by the Shiji's count, put to death, a figure historians have long questioned.",
    srcZh: "《史記·白起王翦列傳》、《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian; Lian Po and Lin Xiangru",
  },
  miezhou: {
    zh: "前256年,西周君背秦與諸侯合縱,秦昭襄王大怒,遣將攻西周。西周君奔秦頓首請罪,獻出三十六邑、三萬人口,秦受其獻;同年周赧王去世,九鼎等寶器也隨之入秦,《史記·秦本紀》記此事為周室滅亡之始,東周的殘餘勢力要到前249年才真正被秦所滅。",
    en: "In 256 BC, the ruler of Western Zhou broke with Qin and joined a coalition of other states, and an enraged King Zhao of Qin sent an army against him. The ruler surrendered, kowtowing and offering thirty-six settlements and thirty thousand people; Qin accepted, King Nan of Zhou died that year, and the Nine Cauldrons passed to Qin with the rest, an event the Basic Annals of Qin treats as the start of Zhou's end, though Eastern Zhou was not destroyed until 249 BC.",
    srcZh: "《史記·周本紀》、《史記·秦本紀》",
    srcEn: "Shiji, Basic Annals of Zhou; Basic Annals of Qin",
  },
  lvbuwei: {
    zh: "前249年,秦莊襄王元年,以呂不韋為丞相,封文信侯。太子政即位後,尊呂不韋為相國,號稱「仲父」。他召集門下食客編纂《呂氏春秋》,匯集八覽、六論、十二紀,二十餘萬言。書成後懸掛於咸陽城門,佈告能增損一字者賞千金,後人因此以一字千金形容此事。",
    en: "In 249 BC, the first year of King Zhuangxiang of Qin, Lü Buwei was made chancellor and Lord Wenxin. Once the crown prince, later King Zheng, took the throne, Lü Buwei was raised to chancellor of state and titled Zhongfu. He gathered his household scholars to compile the Lüshi Chunqiu, over two hundred thousand words in eight surveys, six discourses, and twelve almanacs, then hung it at a gate of Xianyang, offering a thousand gold pieces to anyone who could add or remove a word.",
    srcZh: "《史記·呂不韋列傳》",
    srcEn: "Shiji, Biography of Lü Buwei",
  },
  zhengguoqu: {
    zh: "前246年,韓國派水工鄭國游說秦國修建大型灌溉渠道,實為消耗秦國國力、拖延東進的計謀。工程中途,鄭國的間諜身分被識破,秦王欲殺之,鄭國辯稱「渠成亦秦之利也」,秦王認為有理,命他繼續完工。渠成後灌溉鹽鹼地四萬餘頃,關中從此成為沃野,不再有凶年,渠因此得名鄭國渠。",
    en: "In 246 BC, Han sent the engineer Zheng Guo to persuade Qin to build a great irrigation canal, really a scheme to drain Qin's resources and delay its eastward advance. Partway through, Qin discovered he was a spy and wanted to execute him; he argued the canal would still benefit Qin regardless, and the king let him finish it. Once built, it irrigated over forty thousand qing of salty land, turning Guanzhong fertile with no more bad harvest years, and it was named after him.",
    srcZh: "《史記·河渠書》",
    srcEn: "Shiji, Treatise on Rivers and Canals",
  },
  fanjian: {
    zh: "前260年,秦趙相持於長平,廉頗堅壁不出。秦人使人赴趙散布流言:「秦之所惡,獨畏馬服君趙奢之子趙括為將耳。」趙孝成王信以為真,遂以趙括代廉頗為將,而後趙括冒進兵敗,四十萬趙軍覆沒。這是戰國反間計裡最具決定性的一次。",
    en: "In 260 BC, Qin and Zhao faced off at Changping, and Lian Po refused to be drawn into battle. Qin agents spread a rumor in Zhao that Qin feared only Zhao Kuo, son of the famed general Zhao She, as an opposing commander. King Xiaocheng of Zhao believed it and replaced Lian Po with Zhao Kuo, who then advanced rashly and lost, wiping out four hundred thousand Zhao soldiers. It was the most decisive use of sown discord in the Warring States.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  wangjian: {
    zh: "前225年,秦王問諸將伐楚兵力,李信說二十萬,王翦說非六十萬不可,秦王用李信,結果兵敗。秦王親赴頻陽向王翦道歉,請他出山,王翦仍堅持六十萬。前224年,王翦待楚軍疲憊乘機大破之,於蘄南擊殺項燕(〈秦始皇本紀〉另有兵敗自殺之說);前223年虜楚王負芻,楚亡。",
    en: "In 225 BC, King Zheng asked how many troops it would take to conquer Chu. Li Xin said two hundred thousand, Wang Jian said six hundred thousand; the king chose Li Xin, who lost. The king visited Wang Jian to apologize and beg him to lead, granting the troops he wanted. In 224 BC Wang Jian wore down the Chu army, crushed it, and killed Xiang Yan; the Annals of the First Emperor has him die by his own hand. Chu fell in 223 BC.",
    srcZh: "《史記·白起王翦列傳》、《史記·秦始皇本紀》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian; Basic Annals of the First Emperor",
  },
  hanfei: {
    zh: "韓非是韓國宗室,與李斯同學於荀子,口吃不善言談而善於著書,著有《孤憤》《五蠹》等篇十餘萬言。秦王政讀其書大為讚賞,為得韓非而急攻韓國,韓王安遂遣他使秦。李斯、姚賈嫉其才,進讒言說他終究心向韓國,秦王下之於獄,李斯派人送毒藥令自殺;秦王后悔,遣人赦免已來不及。",
    en: "Han Fei, a Han prince, studied under Xunzi with Li Si; a stutterer, he wrote instead of speaking, producing Solitary Indignation and The Five Vermin. King Zheng of Qin admired his writings so much he attacked Han to obtain their author, and Han sent him to Qin. Li Si and Yao Jia, jealous of him, told the king he would always favor Han over Qin; the king jailed him, Li Si sent poison, and by the time the king reconsidered, Han Fei was dead.",
    srcZh: "《史記·老子韓非列傳》",
    srcEn: "Shiji, Biographies of Laozi and Han Fei",
  },
  xinlingjun: {
    zh: "前257年,秦圍趙都邯鄲,趙求救於魏,魏王命晉鄙率兵駐鄴觀望,不敢進兵。魏公子信陵君屢諫不聽,採納門客侯嬴之計,透過魏王寵姬如姬竊得兵符,假傳王命奪晉鄙之軍,力士朱亥椎殺晉鄙。信陵君遂率兵擊秦,大破秦軍,解邯鄲之圍,但因矯殺晉鄙、竊符出兵,不敢返魏,留趙十年。",
    en: "In 257 BC, Qin besieged Handan, and Zhao appealed to Wei. King Anxi of Wei ordered his general Jin Bi to camp and wait, ignoring Lord Xinling's pleas. Xinling, on a retainer's plan, had the king's consort steal the military tally, seized Jin Bi's command by forged order, and had a strongman club him to death. Xinling then crushed the Qin army, lifting the siege, but for killing Jin Bi he dared not return to Wei and stayed in Zhao for ten years.",
    srcZh: "《史記·魏公子列傳》",
    srcEn: "Shiji, Biography of the Lord of Wei",
  },
  maosui: {
    zh: "前257年,秦圍邯鄲,趙求救於楚,平原君挑二十名門客同赴楚國,只湊足十九人,毛遂自薦。平原君以「錐之處囊中,其末立見」質疑他未曾露鋒,毛遂答以「使遂蚤得處囊中,乃穎脫而出」。至楚,毛遂按劍直陳利害,終於說動楚王救趙,平原君因此稱他「三寸之舌,強於百萬之師」。",
    en: "In 257 BC, with Qin besieging Handan, Zhao appealed to Chu, and Lord Pingyuan chose twenty retainers, finding only nineteen worth taking until Mao Sui volunteered himself. Pingyuan doubted him, since a capable man, like an awl placed in a sack, should show its point by now; Mao Sui answered he was only now asking to be placed in the sack. In Chu he argued bluntly until the king agreed to send troops, and Pingyuan called his tongue mightier than a million soldiers.",
    srcZh: "《史記·平原君虞卿列傳》",
    srcEn: "Shiji, Biographies of Lord Pingyuan and Yu Qing",
  },
  lianpo: {
    zh: "廉頗與李牧都是趙國後期名將。前260年,秦將王齕攻趙,廉頗於長平堅壁抵禦,七月趙孝成王中反間計換以趙括,終致慘敗。李牧常年鎮守雁門,大破匈奴十餘萬騎,又屢次擊退秦軍。前229年,趙王遷聽讒言處死李牧,三個月後趙國即為秦所滅,後世常感嘆李牧一死、趙國隨之覆亡。",
    en: "Lian Po and Li Mu were both late Zhao generals. In 260 BC, Qin's Wang He attacked Zhao, and Lian Po held Changping by refusing battle, until King Xiaocheng replaced him with Zhao Kuo in the seventh month through a rumor, leading to disaster. Li Mu guarded the north at Yanmen for years, crushing Xiongnu horsemen, and beat back Qin's armies too. In 229 BC, King Qian had Li Mu executed on false charges, and Zhao fell three months later, long called cause and effect.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  chunshenjun: {
    zh: "黃歇是楚人,學識淵博,遊歷四方,侍奉楚頃襄王,後於楚考烈王時為相,號春申君,廣納門客三千餘人,是四公子中唯一非王室出身者。他曾隨太子完(考烈王)在秦為質,用計讓太子詐扮車夫出關逃歸,自己稱病留守,助太子繼位。晚年因門客李園設計,遭刺客斬殺於棘門。",
    en: "Huang Xie was a man of Chu, learned and well traveled, who served King Qingxiang before becoming chancellor under King Kaolie as Lord Chunshen, the only one of the Four Lords not born a prince. He went with the crown prince, later King Kaolie, as a hostage in Qin, and had him slip out disguised as his driver while staying behind pleading illness, letting the prince return and take the throne. Late in life, his retainer Li Yuan had him assassinated at the palace gate.",
    srcZh: "《史記·春申君列傳》",
    srcEn: "Shiji, Biography of Lord Chunshen",
  },
  jingke: {
    zh: "前227年,燕太子丹派荊軻刺秦王,携帶督亢地圖與秦國逃將樊於期(得罪秦王政,逃亡至燕)的首級進獻為由接近秦王。易水送別時,高漸離擊筑,荊軻和而歌:「風蕭蕭兮易水寒,壯士一去兮不復還。」入秦後圖窮匕見,荊軻刺秦王未中,反被侍衛所殺。",
    en: "In 227 BC, Crown Prince Dan of Yan sent Jing Ke to kill the king of Qin, using the severed head of Fan Wuqi, a fugitive Qin general who angered the king, plus a map of Dukang. Gao Jianli played the zhu at the Yi River farewell while Jing Ke sang: the wind sighs, the river is cold; the brave man once gone will never return. In Qin, the map unrolled to reveal a dagger, but his strike missed, and the guards cut him down.",
    srcZh: "《史記·刺客列傳》",
    srcEn: "Shiji, Biographies of the Assassins",
  },
  liuguo: {
    zh: "前241年,趙、楚、魏、韓、燕(一說衛)五國最後一次合縱攻秦,推楚考烈王為縱約長,楚相春申君主持此役,聯軍進逼函谷關,被秦軍擊退而還。這是戰國史上最後一次真正成形的合縱行動,此後山東六國再也無力組織聯合抗秦。",
    en: "In 241 BC, Zhao, Chu, Wei, Han, and Yan, joined by some accounts by Wey, made a final coalition attack on Qin under King Kaolie of Chu as its leader, with Lord Chunshen of Chu directing the campaign, advancing on Hangu Pass before Qin's army drove them back. It was the last coalition the eastern states ever managed to form against Qin, and none of them could organize a joint resistance again afterward.",
    srcZh: "《史記·楚世家》、《史記·春申君列傳》",
    srcEn: "Shiji, House of Chu; Biography of Lord Chunshen",
  },
  lixin: {
    zh: "前225年,秦王政問李信伐楚需兵若干,李信答二十萬即可,遂與蒙恬率二十萬兵伐楚,連戰連捷,攻破平輿、鄢郢。李信西向與蒙恬會師城父,楚軍尾隨三日三夜不曾休整,突襲李信軍,攻入兩壁,斬殺秦軍七都尉。傳統上以為統兵楚將是項燕,但〈白起王翦列傳〉此段本身未點名。",
    en: "In 225 BC, King Zheng of Qin asked Li Xin how many troops he needed to conquer Chu; he said two hundred thousand, and led that force south with Meng Tian, winning victories at Pingyu and the towns of Yan and Ying. Turning west to join Meng Tian, he was shadowed for three days and nights without rest by a Chu army, then ambushed, losing two camps and seven commanders. Tradition credits the Chu general Xiang Yan, though this passage does not name him.",
    srcZh: "《史記·白起王翦列傳》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian",
  },
  duojiang: {
    zh: "廉頗晚年因趙悼襄王以樂乘取代他為將,憤而攻樂乘,樂乘敗走,廉頗遂奔魏都大梁。楚國聽聞廉頗在魏,暗中派人接他到楚國為將,但廉頗未立戰功,自言「我思用趙人」,最終客死於楚地壽春,未能再回趙國效力。",
    en: "Late in life, Lian Po was replaced as Zhao's general by Yue Cheng; furious, he attacked Yue Cheng, who fled, and Lian Po himself fled to Daliang in Wei. Hearing he was in Wei, Chu secretly sent someone to bring him over as a general, but he won no victories there, saying only that he wished he could command Zhao's men again. He died in exile at Shouchun in Chu, never given the chance to serve Zhao once more.",
    srcZh: "《史記·廉頗藺相如列傳》",
    srcEn: "Shiji, Biographies of Lian Po and Lin Xiangru",
  },
  xizuo: {
    zh: "范雎隨魏國使者須賈出使齊國,齊襄王聞其辯才,私下贈他黃金與牛酒,范雎辭謝不受。須賈卻懷疑他洩露魏國機密給齊國,回國後告訴魏相魏齊。魏齊大怒,命人笞打范雎,打斷肋骨、擊落牙齒。范雎裝死才得以逃脫,更名張祿,後來輾轉入秦,終於官至丞相。",
    en: "Fan Ju accompanied the Wei envoy Xu Jia on a mission to Qi, where King Xiang of Qi, impressed by his eloquence, privately sent him gold and wine, which Fan Ju declined. Xu Jia suspected he had leaked Wei secrets to Qi and reported it to the Wei chancellor on returning, who had Fan Ju beaten until his ribs and teeth broke. Fan Ju played dead to escape, changed his name to Zhang Lu, made his way to Qin, and rose there to chancellor.",
    srcZh: "《史記·范雎蔡澤列傳》",
    srcEn: "Shiji, Biographies of Fan Ju and Cai Ze",
  },
  zhukeling: {
    zh: "前237年,鄭國渠被揭穿是間諜之計。〈秦始皇本紀〉把呂不韋因嫪毐之亂免相與逐客令記在同一年。秦國宗室大臣趁機進言:「諸侯人來事秦者,大抵為其主游間於秦耳,請一切逐客。」秦王政下令驅逐非秦國出身的客卿;李斯也在被逐之列,上書勸阻,秦王政遂收回成命,復其官職。",
    en: "In 237 BC, the Zhengguo Canal was exposed as a spying scheme, and the Annals of the First Emperor records Lü Buwei was also dismissed that year over the Lao Ai affair. Qin's own nobles told the king that outsiders serving Qin mostly worked for their home states, so all such guests should be expelled, and the king ordered every official not born in Qin driven out. Li Si, among those expelled, petitioned against it, and the king reversed the order and restored his post.",
    srcZh: "《史記·李斯列傳》、《史記·秦始皇本紀》",
    srcEn: "Shiji, Biography of Li Si; Basic Annals of the First Emperor",
  },
  dunbing: {
    zh: "前259年,秦乘長平大勝之勢圍攻趙都邯鄲,久攻不下。白起認為邯鄲城堅難拔,加以秦軍傷亡未復,力諫不可強攻,秦王不聽,仍派兵猛攻,結果頓兵堅城下達兩年有餘,直到魏、楚援軍抵達,秦軍才在內外夾擊下大敗撤退。",
    en: "In 259 BC, fresh off its victory at Changping, Qin besieged Handan, the Zhao capital, but could not take it. Bai Qi argued the city was too strong to storm and Qin's own army too battered to try, but the king pressed the attack anyway; Qin stayed bogged down before the walls for more than two years until Wei and Chu's relief armies arrived, and caught between the city and the relief force, Qin's army broke and retreated.",
    srcZh: "《史記·白起王翦列傳》",
    srcEn: "Shiji, Biographies of Bai Qi and Wang Jian",
  },
  mibing: {
    zh: "「弭兵」一詞源自春秋末年向戌弭兵之會。前546年,宋國大夫向戌倡議弭兵,促成晉、楚等十四國在宋會盟,約定除齊、秦外互相朝見,此後晉楚之間大規模戰爭停止近四十年。戰國時,宋牼聽聞秦楚交兵,也說「吾聞秦楚構兵,我將見楚王說而罷之」,可見弭兵的想法戰國仍有人提起。",
    en: "The term for laying down arms traces to the Covenant of Song near the end of the Spring and Autumn period. In 546 BC, Xiang Xu of Song proposed a truce, bringing fourteen states, including Jin and Chu, to a covenant of mutual visits except Qi and Qin; fighting between Jin and Chu stopped for nearly forty years. In the Warring States, Song Keng, hearing Qin and Chu were at war, said he meant to see the Chu king and talk him out of it.",
    srcZh: "《左傳·襄公二十七年》、《孟子·告子下》",
    srcEn: "Zuo Zhuan, Duke Xiang Year 27; Mengzi, Gaozi II",
  },
  jianbing: {
    zh: "戰國小邦常在大國夾縫中苟延殘喘,魯國就是一例。前249年,楚考烈王出兵滅魯,魯頃公被廢為庶人,遷居下邑,魯國自此絕祀。衛國則撐得更久,直到秦二世元年(前209年)才被廢為庶人,是姬姓封國中最後滅亡的一個。",
    en: "Small states often survived only precariously wedged between the great powers, and Lu is one example. In 249 BC, King Kaolie of Chu destroyed Lu, stripped Duke Qing of his rank, and moved him to Xiayi, ending Lu's sacrifices. Wey held on much longer, and only in 209 BC, the first year of the Second Emperor, was its last ruler stripped of rank, making it the last of the Ji-surnamed states to fall.",
    srcZh: "《史記·魯周公世家》、《史記·衛康叔世家》",
    srcEn: "Shiji, House of the Duke of Zhou at Lu; House of Kangshu of Wey",
  },

  // #36 batch 4: the five scoring cards plus 九鼎 (E.JIUDING), completing all 72.
  score_jin: {
    zh: "三晉(韓、魏、趙)地處天下之中,是列國交兵必經之地,戰禍也最頻繁。前403年,周威烈王正式冊封晉大夫魏斯、趙籍、韓虔為諸侯,《史記·六國年表》記此事為「命韓、魏、趙為諸侯」,《資治通鑑》開篇更記「初命晉大夫魏斯、趙籍、韓虔為諸侯」,史稱三家分晉。",
    en: "The Three Jin, Han, Wei, and Zhao, sat at the crossroads of the realm, ground every army had to cross, and the fighting there was heaviest. In 403 BC, King Weilie of Zhou formally recognized the Jin ministers Wei Si, Zhao Ji, and Han Qian as lords in their own right; the Shiji records this, and the Zizhi Tongjian opens with the same event, calling it the Partition of Jin and the start of the Warring States era.",
    srcZh: "《史記·六國年表》、《資治通鑑》",
    srcEn: "Shiji, Chronological Table of the Six States; Zizhi Tongjian",
  },
  score_west: {
    zh: "西土是秦國的根基所在。蘇秦游說秦惠王時形容關中:「秦四塞之國,被山帶渭,東有關河,西有漢中,南有巴蜀,北有代馬,此天府也。」巴蜀是前316年司馬錯滅蜀所得,漢中則是前312年丹陽之戰後從楚國奪來,兩地連同關中,構成秦國東出的糧倉與屏障。",
    en: "The West was Qin's home base. Su Qin, urging King Hui of Qin to act, described Guanzhong as walled in on four sides, backed by mountains and the Wei River, with the Yellow River and Hangu Pass east, Hanzhong west, Ba-Shu south, and the horses of Dai north, a natural storehouse for a ruler. Sima Cuo took Ba-Shu in 316 BC, and Qin won Hanzhong from Chu after Danyang in 312 BC, giving Qin its granary and shield for pushing east.",
    srcZh: "《史記·蘇秦列傳》",
    srcEn: "Shiji, Biography of Su Qin",
  },
  score_south: {
    zh: "楚國以疆域廣大著稱。蘇秦游說楚威王時說:「楚,天下之強國也……地方五千里,帶甲百萬,車千乘,騎萬匹,粟支十年。」楚國本都郢,前278年秦將白起攻破郢都後,楚被迫東遷,先徙都陳,前241年又因秦軍逼近而再遷壽春,國勢從此一蹶不振。",
    en: "Chu was known for the size of its territory. Su Qin, urging King Wei of Chu to lead the alliance, called Chu the strongest state under heaven, five thousand li across, with a million soldiers, a thousand chariots, ten thousand horsemen, and grain for ten years. Chu's capital was originally Ying, but after Qin's general Bai Qi took it in 278 BC, the court fled east to Chen, and in 241 BC, with Qin closing in again, moved once more to Shouchun, never to recover.",
    srcZh: "《史記·蘇秦列傳》",
    srcEn: "Shiji, Biography of Su Qin",
  },
  score_east: {
    zh: "齊國以臨淄的富庶聞名。蘇秦游說齊宣王時說:「臨淄之中七萬戶……車轂擊,人肩摩,連衽成帷,舉袂成幕,揮汗成雨。」齊國自太公建國起便「通商工之業,便魚鹽之利」,以漁鹽致富。宋、魯兩個小國夾在齊、楚、魏等大國之間,同在此區,難逃被兼併的命運。",
    en: "Qi was known for the wealth of its capital, Linzi. Su Qin told King Xuan of Qi that Linzi alone held seventy thousand households, its streets so packed that carriage hubs knocked together, shoulders brushed shoulders, and sweat fell like rain. Since the founding of Qi, its rulers had opened trade and craft and taken advantage of fish and salt, building wealth from the coast. Song and Lu, wedged between Qi, Chu, and Wei in this same region, could not escape being swallowed eventually.",
    srcZh: "《史記·蘇秦列傳》、《史記·齊太公世家》",
    srcEn: "Shiji, Biography of Su Qin; House of Duke Tai of Qi",
  },
  score_north: {
    zh: "北疆是趙、燕兩國對抗胡人的邊疆地帶。趙武靈王胡服騎射後拓地雲中、雁門、代地,前296年趙又滅中山國,遷其王於膚施。燕國則在名將秦開大破東胡後,於新拓邊境設上谷、漁陽、右北平、遼西、遼東五郡。這裡是戰國少數同時面對中原混戰與塞外遊牧民族的地帶。",
    en: "The North was the frontier where Zhao and Yan faced the nomadic peoples beyond the settled states. After King Wuling of Zhao adopted nomad dress and mounted archery, Zhao expanded into Yunzhong, Yanmen, and Dai, and in 296 BC destroyed Zhongshan, exiling its king to Fushi. Yan, after its general Qin Kai crushed the Donghu, set up five commanderies on its new frontier: Shanggu, Yuyang, Youbeiping, Liaoxi, and Liaodong. It was one of the few regions facing both rivalry and the steppe.",
    srcZh: "《史記·趙世家》、《史記·匈奴列傳》",
    srcEn: "Shiji, House of Zhao; Treatise on the Xiongnu",
  },
  jiuding: {
    zh: "相傳夏禹鑄九鼎象徵九州,是天下共主的象徵。前606年,楚莊王陳兵周郊,向周使者王孫滿問鼎輕重,王孫滿答以「在德不在鼎」,楚莊王因此退兵。九鼎下落有兩說:《史記·秦本紀》說前255年周室東亡,「其器九鼎入秦」;另一說是一鼎沉入泗水,始皇南巡曾派人打撈未果。",
    en: "The Nine Cauldrons were said to be cast by Yu to represent the nine regions, a symbol of who held the Mandate. In 606 BC, King Zhuang of Chu camped at the Zhou border and asked how heavy they were; the envoy Wangsun Man said the Mandate rests on virtue, not cauldrons, and the king withdrew. Their end has two versions: Qin's Annals has them reaching Qin in 255 BC; another has one lost in the Si River, never found despite a 219 BC search.",
    srcZh: "《左傳·宣公三年》、《史記·秦本紀》",
    srcEn: "Zuo Zhuan, Duke Xuan Year 3; Shiji, Basic Annals of Qin",
  },
};

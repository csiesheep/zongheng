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
    zh: "河西之地原屬秦,戰國初年被魏奪去,魏文侯用吳起為西河守,長期據守此地。秦惠文君七年(前330年),秦與魏戰,虜魏將龍賈,斬首八萬;次年魏納河西全境予秦以求和。秦國自此收復河西,東進的門戶洞開,形勢從此逆轉。",
    en: "Hedong had once belonged to Qin before Wei seized it early in the Warring States, when Marquis Wen of Wei made Wu Qi warden of the west river region. In the seventh year of Lord Huiwen of Qin, 330 BC, Qin defeated Wei, captured its general Long Jia, and took eighty thousand heads; the next year Wei surrendered all of Hedong to make peace. Qin thereby regained the land and opened its gate east, turning the balance of power its way.",
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
    zh: "蘇秦游說六國合縱抗秦,身佩六國相印,為縱約長。傳統說法認為合縱約成於前333年,秦兵十五年不敢出函谷關;但出土帛書《戰國縱橫家書》顯示,蘇秦主要活動其實較晚,約在齊湣王時。合縱瓦解後,蘇秦在齊為燕行反間,遭大夫刺殺,臨死前自請齊王車裂其屍於市,以誘出真凶。",
    en: "Su Qin persuaded six states to form the Vertical alliance, carrying all six seals as its leader. Tradition dates the alliance to 333 BC, after which Qin dared not leave Hangu Pass for fifteen years, but a manuscript excavated in modern times suggests his career came later, under King Min of Qi. The alliance broke apart; Su Qin, spying for Yan in Qi, was stabbed by a rival, and before dying asked the king to tear his corpse by chariots to expose the real killer.",
    srcZh: "《史記·蘇秦列傳》",
    srcEn: "Shiji, Biography of Su Qin",
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
    zh: "齊國在都城臨淄稷門附近設立稷下學宮,招致天下賢士,不任官職而議論國事。齊宣王時學宮盛況空前,學士多達數百上千人。孟子、鄒衍、淳于髡、慎到、田駢等皆曾游學於此,荀子更三度出任學宮祭酒,在稷下諸生中「最為老師」。稷下學宮是戰國百家爭鳴最重要的舞台之一。",
    en: "Qi built the Jixia Academy near the Ji gate of its capital Linzi, drawing scholars who held no office but debated public affairs freely. Under King Xuan the academy reached its height, with scholars numbering in the hundreds. Mencius, Zou Yan, Chunyu Kun, Shen Dao, and Tian Pian all studied or taught there, and Xunzi served three times as its senior scholar, eventually honored as the most senior teacher among them.",
    srcZh: "《史記·孟子荀卿列傳》",
    srcEn: "Shiji, Biographies of Mencius and Xun Qing",
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
    zh: "周天子致胙(祭肉)、致伯是天子對強國示好的殊禮,不是正式的冊封。周顯王二十六年,周天子致伯於秦孝公;三十五年,又致文王、武王的祭肉予秦惠王。此後周天子屢次以類似方式賜胙、致伯於崛起的諸侯,象徵性地維繫著名存實亡的天下共主地位。",
    en: "The Zhou king sending sacrificial meat, or granting the title of hegemon, was a courtesy the fading royal house paid to rising powers, not a formal investiture. In the twenty-sixth year of King Xian, the king granted Duke Xiao of Qin the title; in the thirty-fifth year, he sent King Hui of Qin the meat once offered to Kings Wen and Wu. The Zhou kings kept extending such gestures afterward, a hollow way of still claiming to preside over a realm no longer theirs.",
    srcZh: "《史記·周本紀》",
    srcEn: "Shiji, Basic Annals of Zhou",
  },
  daji: {
    zh: "戰國饑荒頻仍,是列國常須應對的難題。《孟子·梁惠王上》記魏惠王自述治國之法:河內遇饑荒,便將當地百姓遷往河東,把河東的糧食運來河內賑濟;河東遇饑荒時也依此法反向調度。孟子卻指出,鄰國治理未必更差,魏國百姓卻不見增多,問題不在賑災的手法,而在根本的仁政。",
    en: "Famine was a recurring problem the Warring States had to manage. In the Mencius, King Hui of Wei describes his method: when Henei suffered famine he moved its people to Hedong and shipped Hedong's grain back to feed them, and did the reverse when Hedong went hungry. Mencius answered that neighboring states were not obviously worse governed, yet Wei's population had not grown, so the flaw lay not in the relief method but in the absence of true benevolent rule.",
    srcZh: "《孟子·梁惠王上》",
    srcEn: "Mengzi, King Hui of Liang I",
  },
};

// 繁體中文字串。所有玩家看得到的字都在這裡或 en.js;app.js 自己不帶文案。
export default {
  lang: "zh-Hant",
  title: "縱橫",
  tagline: "橫成則秦帝,縱成則楚王",
  about: "兩人對弈的戰國卡驅動策略遊戲。秦以連橫逐一吞併,楚以合縱把六國綁在一起。八回合,約一小時。可與電腦對弈,或開一個四碼房間與朋友對戰。中英文。",
  soon: "施工中。規則已寫好,接下來是引擎、電腦與房間。",
  credit: "同人、免費。靈感來自《冷戰熱鬥》的卡驅動設計;與 GMT Games 無關。",
  // #62 part 2:「回首頁」只在 bar 擠到要拿掉 back link 文字時當 aria-label/title
  // 用(app.js 的 syncBackLabel());其他時候還是原本「‹ 縱橫」那句。
  nav: { back: "‹ 縱橫", rules: "規則", hub: "csiesheep games", lang: "EN", home: "回首頁" },
  // 規則頁牌表的第 72 列:九鼎不在 shared/cards.js 的 CARDS 裡(它是引擎的
  // 特殊牌 st.jiuding,不是一張 CARDS 紀錄),rules.js 沒辦法像其他 71 張
  // 那樣直接從牌堆讀名字/說明。文字沿用這個檔案裡規則頁本來就有的「九鼎」
  // 那句話(見 rules.js 自己的 specialText)。
  rules: {
    jiuding: "九鼎", jiudingText: "4 點行動點,全部用在三晉或周視為 5;只能放置、征伐、遊說;用後蓋著交給對手,對方下回合起可用;開局由楚持有。",
    // #40:規則頁的區塊導覽(sticky chip 列)短標,對應 rules.js render() 裡
    // 每個 h2 的順序;top 是列尾固定的「回頂端」那顆。
    // #91:「特殊」改名為「九鼎與洛邑」(滅國/相印移到自己的新分節「滅國與相印」)。
    nav: { ends: "結局", board: "棋盤", control: "控制", uses: "用法", tracks: "軌道", special: "九鼎與洛邑", mie: "滅國與相印", turn: "回合", scoring: "記分", cards: "牌表", top: "回到頂端 ↑" },
    search: "搜尋牌名…",
    eraFilter: { all: "全部", reform: "變法期", alliance: "縱橫期", conquest: "兼併期" },
    sideFilter: { all: "全部", qin: "秦", chu: "楚", neutral: "中立", scoring: "記分" },
    count: "{n} 張",
    empty: "沒有符合的牌。",
    // #44:桌面版兩個分頁的短標,以及還沒選牌時卡片欄裡的提示字。
    tabs: { rules: "規則", cards: "七十二張牌" },
    pickHint: "從左邊選一張牌看詳情。",
    // #45 round 1:桌面 tile 第二行——沒有年份的牌一律要有第二行(不能只有
    // 名字):一般牌顯示「年代不詳」,記分卡顯示它自己的期別,九鼎顯示
    // 「每個時期」(它不屬於任何一期,見 rules.js 對 era==="" 的說明)。
    undated: "年代不詳",
    everyEra: "每個時期",
  },
  sides: { qin: "秦", chu: "楚", neutral: "中立", scoring: "記分卡" },
  // #51:圓盤的控制環拿掉、只留色調之後,「誰控制」只能靠色調的深淺看出來
  // (黑/紅 = 控制,灰/粉紅 = 有影響力但沒控制)——所以每個據點的點擊按鈕
  // title 要把兩邊點數與控制方講清楚(hitInf、controls),不能只靠畫面。
  map: {
    hitTitle: "{space} · 安定{stability}", hitInf: "秦{qin} 楚{chu}", controls: "{side}控制",
    // #90: 已相印的國都標記是 app.js 直接畫的「印」朱印角章,不走翻譯(是印
    // 章,不是字,中英文都一樣)。sealHelp 是點狀態列 相印 數字時顯示在提示
    // 區的一句話說明。
    sealHelp: "楚控制國都且影響力堆滿(穩定度 +2)才得相印",
  },
  names: { qin: ["范雎", "司馬錯", "王齕"], chu: ["昭陽", "屈匄", "項燕"] },
  setup: { defaultName: "玩家" },
  sys: { joined: "{name} 進來了。", left: "{name} 離開了。", leftGame: "{name} 離開了,由電腦代打。", dealt: "發牌了。", timeout: "{name} 逾時,由桌面代為決定。", over: "{side}({name})獲勝:{reason}。", fallback: "對手這一手出了問題,已改用保底動作:{action}。", stuck: "對手無法行動,這一局無法繼續。" },
  ends: { unification: "三國同滅", alliance: "四國相印", mandate: "天命達 20", collapse: "對方把天下推到土崩", scoring: "對方回合結束時手上還有記分卡", scoringBoth: "雙方都留著記分卡,依平手規則", final: "終局結算後的天命", tie: "天命平手,依平手規則" },
  errors: { noRoom: "沒有這個房號。", full: "房間已滿。", needMore: "需要兩個座位。", notReady: "對方尚未就緒。", notYet: "牌桌還沒蓋好。", notYourTurn: "現在不是你決定。" },
  landing: { backToRoom: "回到房間 {code}", resume: "繼續上一局", play: "與電腦對弈", create: "多人遊戲", join: "加入", code: "房號", codePlaceholder: "CODE", rulesLink: "規則與七十二張牌", rulesShort: "規則", name: "你的名字" },
  side: {
    qin: { headline: "連橫", sub: "逐一吞併六國。", cta: "以秦開局" },
    chu: { headline: "合縱", sub: "把六國綁在一起。", cta: "以楚開局" },
  },
  lobby: { say: "說點什麼", title: "房間", hint: "把房號給朋友,或讓電腦補上另一邊。斷線的人由電腦代打,回來即可接手。", you: "你", host: "房主", bot: "電腦", away: "離線", empty: "空位", ready: "已就緒", notReady: "尚未就緒", addBot: "加入電腦", removeBot: "移除電腦", swap: "換邊", start: "開局", leave: "離開", rematch: "再戰(換邊)", waiting: "等房主開局。", connecting: "連線中…", closed: "連線已中斷。", clock: "{s} 秒", gateHint: "先取個名字才能入座,入座後就不能改了。", join: "入座", copy: "複製連結", copied: "已複製" },
  setup: {
    defaultName: "玩家", title: "與電腦對弈", side: "你的陣營", random: "隨機", randomTag: "任一陣營", level: "電腦強度", easy: "簡單", normal: "普通", hard: "困難", start: "開局", back: "返回",
    desc: {
      qin: "你扮演秦:逐一吞併六國。八回合,約一小時;遊戲會自動存在這個瀏覽器裡。",
      chu: "你扮演楚:把六國綁在一起。八回合,約一小時;遊戲會自動存在這個瀏覽器裡。",
      random: "開局時隨機決定你的陣營。八回合,約一小時;遊戲會自動存在這個瀏覽器裡。",
    },
    // #97: startSolo() used to silently overwrite `zh.solo` -- shown as a
    // confirm sheet (not window.confirm) only when a save actually exists.
    overwriteWarn: "開新局會蓋掉目前的存檔(第 {n} 回合)。",
  },
  eras: { reform: "變法期", alliance: "縱橫期", conquest: "兼併期" },
  tracks: { mandate: "天命", weariness: "疲敝", reform: "變法", seals: "相印", mie: "滅", jiuding: "九鼎", faceDown: "蓋著", turn: "回合", round: "行動", of: "／" },
  // #41: 據點上「上一手」標記用的短籤,只在一個國家的滅/復國狀態剛好翻轉時出現
  // ——不是 log 裡的完整句子(那句還是用上面 log.mie/log.restore),是貼在圓盤
  // 旁邊、只有幾個字寬的小籤。
  lastMove: { destroyed: "滅", restored: "復國" },
  weariness: { 5: "承平", 4: "兵連", 3: "禍結", 2: "民困", 1: "土崩" },
  prompt: {
    setup: "放置 {n} 點起始影響力(剩 {left})。點地圖。", setupBonus: "在已有影響力處放 {n} 點補償(剩 {left})。",
    headline: "蓋一張牌當標題:雙方同時翻開,行動點高者先結算,事件一定發生。",
    // #60:紀錄/側欄裡說的是「電腦做了什麼」,不是「玩家該做什麼」——見 app.js
    // actionText() 自己的註解。
    headlineDone: "蓋下了標題牌",
    yourAction: "輪到你,選一張牌。", wait: "等待 {name}…",
    points: "選 {n} 個(剩 {left})。", pointsMin: "最多選 {n} 個。", card: "選一張牌。", cardOptional: "選一張牌,或略過。", option: "請選擇。", ops: "使用 {ops} 點行動點:怎麼用?",
    place: "放置 {ops} 點(剩 {left})。點地圖;對手控制處每點 2。", campaign: "征伐,{ops} 點:點目標。", lobby: "遊說,{ops} 點:點目標。",
    over: "遊戲結束。",
    // #97: always on, independent of the advisor -- shown once the actions
    // left this round are at most the scoring cards still in hand.
    scoringWarn: "還剩 {n} 次行動,手上有 {m} 張記分卡:要在回合結束前打出,否則判負。",
  },
  uses: { event: "事件", place: "放置", campaign: "征伐", lobby: "遊說", reform: "變法", bog: "棄牌(頓兵)", pair: "搭配", opsFirst: "先行動點", eventFirst: "先事件" },
  buttons: { send: "送出", board: "看棋盤", result: "結果", confirm: "確認", done: "完成", cancel: "取消", skip: "略過", playAgain: "再來一局", swap: "換邊", home: "回首頁", headline: "蓋下標題牌", show: "展開", hide: "收起", log: "紀錄", logChat: "紀錄與聊天", expand: "看牌", close: "關閉", resumeSolo: "繼續舊局", newGame: "開新局" },
  // #97: the always-on "must play" tag on a scoring card in hand -- a
  // separate short label (badge) and a longer sentence (its `title`), never
  // the prompt-area/pinned-area line above (that one adds the count).
  hand: { mustPlay: "必打", mustPlayTitle: "記分卡留到回合結束會輸" },
  preview: { campaign: "移除對方 {removed},放置己方 {placed};疲敝 {w}。", lobby: "局勢 {edge}:最多移除 {n}。", locked: "疲敝封鎖中。", enemyEvent: "這是對方的牌:事件也會觸發。" },
  over: {
    winner: "{side}獲勝", mandate: "終局天命",
    reasons: {
      unification: { title: "秦并天下", body: "三國盡滅,天下再無缺口歸秦。", win: "你贏了。天下已歸秦所有。", lose: "你輸了。秦并天下。" },
      alliance: { title: "合縱成", body: "四方相印盡合,秦再無可乘之隙。", win: "你贏了。合縱已成。", lose: "你輸了。合縱已成,你被困其中。" },
      mandate: { title: "天命歸{winner}", body: "天命積滿二十,天下已為{winner}所決。", win: "你贏了。天命在你。", lose: "你輸了。天命歸於{winner}。" },
      collapse: { title: "天下先向{loser}崩", body: "疲敝先耗盡,{winner}未耗盡自己的氣力。", win: "你贏了。對手先撐不住。", lose: "你輸了。你先撐不住。" },
      scoring: { title: "記分未清", body: "回合結束時記分卡仍在手上,結算歸於{winner}。", win: "你贏了。對手手上還握著記分卡。", lose: "你輸了。記分卡還留在你手上。" },
      scoringBoth: { title: "記分兩不清", body: "雙方回合結束時都還握著記分卡,結算仍歸{winner}。", win: "你贏了。雙方都還握著記分卡,結算仍算你贏。", lose: "你輸了。雙方都還握著記分卡,結算算你輸。" },
      final: { title: "終局論定", body: "第八回合終了,天命偏向{winner}。", win: "你贏了。終局時天命在你這邊。", lose: "你輸了。終局時天命偏向{winner}。" },
      tie: { title: "天命持平,歸{winner}", body: "天命持平,依規則判給{winner}。", win: "你贏了。天命持平,依規則判你勝。", lose: "你輸了。天命持平,依規則判{winner}勝。" },
    },
  },
  log: {
    setup: "{side}起始配置:{spaces}。", turn: "第 {turn} 回合,{era}。", headline: "標題:{qin}、{chu};{first}先結算。",
    // #58(orchestrator 審 #57 時發現,不是 owner 的話):牌沒了的一方不出
    // 標題。前一行 log.skip(「{side}無牌可出。」)已經說過那一方沒牌,這行
    // 就不再重複「沒牌」,只補上結果(「不出標題」),避免這一對讀起來像贅述。
    headlineOne: "{side}的標題:{card};{other}不出標題。",
    headlineNone: "雙方都沒有手牌,跳過標題階段。",
    play: "{side}打出{card}({use})。",
    place: "{side}在{spaces}放置。", campaign: "{side}以 {ops} 點征伐{target}:移除 {removed},放置 {placed}。", lobby: "{side}遊說{target}:移除 {removed}。",
    score: "{region}結算:秦 {q},楚 {c}。", vp: "天命 {mandate}。", tire: "疲敝降至{to}。", seal: "楚取得{state}相印。", unseal: "楚失去{state}相印。",
    mie: "秦滅{state}。", restore: "{state}復國。", reform: "{side}變法軌到第 {box} 格。", jiuding: "九鼎蓋著交給{side}。", discard: "{side}棄掉{card}。",
    bog: "{side}頓兵堅城,棄掉{card}。", skip: "{side}無牌可出。", opsLost: "{side}的 {ops} 點行動點無處可用。", reshuffle: "棄牌堆重洗。", era: "{era}牌庫洗入。",
    endTurn: "第 {turn} 回合結束;疲敝{weariness}。", over: "遊戲結束:{side},{reason}。",
  },
  // #88(design A 逐手卷軸):紀錄面板自己的短字串——區段標頭、一列一手的
  // 標題行、以及牌下那排小標籤(chip)。log 上面那段是引擎原句(整句、有
  // 標點),這裡的都是面板專用的短版本,能用引擎那句的地方已經直接重用
  // (見 oppmove 那段的 tickerMandate/tickerScore/tickerSeal/tickerUnseal/
  // tickerMie/tickerRestore/tickerJiuding,log-view.js 直接讀那幾把)。
  logPanel: {
    filterAll: "全部", filterQin: "秦", filterChu: "楚", filterChat: "對話",
    setupHeader: "佈局", turnHeader: "第 {turn} 回合 · {era}", round: "行動 {round}",
    headlineLine: "標題:{qinSide} {qinCard} · {chuSide} {chuCard}", headlineFirst: "{first}先結算",
    chipPlace: "{space} +{n}", chipRemove: "{target}:移除{side} {n}",
    chipReform: "變法 → 第 {box} 格", chipTire: "疲敝 → {to}",
    chipDiscard: "{side}棄掉{card}", chipOpsLost: "{side}的 {ops} 點行動點無處可用",
    close: "收起",
  },
  // #79/#87:對手的一手亮牌——卡牌面板(①,等待一次點按)與地圖演出(②)。
  // #85 的常駐膠囊/底部清單已移除(#87)。只有 oppmove-ui.js 讀這一段。
  oppmove: {
    playedTag: "{side}打出", useOps: "用來{use} · {ops} 點",
    useEvent: "當事件打出", useScoringEvent: "記分牌 · 當事件打出",
    eventMine: "這是{side}的牌,它的事件也為你發生:{text}",
    eventNeutral: "這是中立牌,它的事件也為你發生:{text}",
    eventTheirs: "事件:{text}", eventHeadline: "標題:{text}",
    tapHint: "點一下繼續",
    tickerPlace: "{side}在{space}放置 {n}", tickerCampaign: "{side}征伐{target}:移除{removed}、放置{placed}",
    tickerLobby: "{side}遊說{target}:移除{removed}", tickerReform: "{side}變法軌到第 {box} 格",
    // 天命變化與得利方,例如「天命 楚 +1」——絕不只顯示結果總值(那樣讀起來像
    // 對面得利)。tickerMandateArrow 只在總值也值得一併顯示時才接在後面。
    tickerMandate: "天命 {side} +{n}", tickerMandateArrow: " → {to}",
    tickerScore: "{region}結算:秦 {q},楚 {c}",
    tickerTire: "疲敝降至{to}", tickerSeal: "楚取得{state}相印",
    tickerUnseal: "楚失去{state}相印", tickerMie: "秦滅{state}", tickerRestore: "{state}復國",
    tickerJiuding: "九鼎蓋著交給{side}", tickerFinal: "事件造成的改變",
  },
  useNames: { event: "事件", place: "放置", campaign: "征伐", lobby: "遊說", reform: "變法", bog: "頓兵" },
  scoringLevel: { none: "無", presence: "存在", domination: "優勢", control: "獨佔" },
  regionShort: { west: "西土", jin: "三晉", zhou: "周", east: "東方", south: "南方", north: "北疆" },
  tutorial: {
    button: "教學 · 5 分鐘",
    intro: { kicker: "教學 · 約 5 分鐘", title: "初入戰國", sub: "", text: "你扮演秦。十個小步驟裡,你會拿下一個據點、學會一張牌的四種用法、打一次征伐,還會滅掉韓。對方照劇本走,不會出錯。", start: "開始", notNow: "先不要" },
    skip: "跳過教學", back: "上一步", stepOf: "第 {n} / {total} 課", topbar: "教學 · 第 {n} / {total} 課", gotIt: "知道了",
    wrong: "要點亮著的地方。",
    steps: {
      map: { title: "地圖", text: "26 個據點,分五個記分區加上周;★ 是要衝。圓盤的顏色是影響力:黑是秦、紅是楚;灰和粉紅是有影響力但還沒控制。", do: "點{space}" },
      control: { title: "控制", text: "我方影響力 ≥ 對方 + 安定值就控制,上限是安定值+2。{space}:{qin}≥{chu}+{stability},所以歸你控制。", do: "點{space}" },
      hand: { title: "手牌", text: "圓形徽章是點數;黑是秦的事件、紅是楚的、白是中立的。一張牌有五種用法,先學最簡單的:放置。", do: "點亮著的牌" },
      place: { title: "放置", text: "放在已有自己影響力的據點,或自己控制的據點旁邊,每點花 1;對方控制的據點每點花 2。放 {n} 點到 {space},它就歸你控制。", do: "點{space} {n} 次" },
      event: { title: "事件", text: "把自己的牌當事件打:{card},變法 +1。先到的人得分,更重要的是解鎖能力。", do: "選「事件」" },
      enemyCard: { title: "敵方的牌", text: "把對方的牌當行動點用,它的事件還是會發生;由你決定事件先、還是行動點先。", do: "選「先行動點」" },
      campaign: { title: "征伐", text: "征伐有對方影響力的據點,最多移除 {n} 點,剩下的變成我方的;打要衝疲敝 +1,把疲敝推到{to}的人立刻輸。", do: "確認征伐{space}" },
      lobby: { title: "遊說", text: "局勢 = 我方控制的相鄰據點數 − 對方的;最多移除 {n} 點,但不超過局勢。不放置,也不增加疲敝。", do: "遊說{space}" },
      scoring: { title: "記分", text: "打三晉記分:存在、優勢或控制,每個要衝再 +1;差額移動天命。記分卡留在手上到回合結束就輸。", do: "打記分卡" },
      destroy: { title: "滅國", text: "秦控制一整國的所有據點,那國就滅:{state} 滅,秦 +{n}。滅三國,秦統一;教學到這裡完成。", do: "完成" },
    },
    done: {
      title: "{state}已滅", sub: "",
      lead: "你已經知道正式對局要準備什麼了。遊戲有六種結束方式:",
      ends: ["秦同時滅掉三國", "楚同時持有四國相印", "天命到達 20", "有人把疲敝推到土崩", "記分卡留在手上到回合結束", "第 8 回合結束,天命領先的一方(平手楚勝)"],
      also: "教學沒教到的:標題階段怎麼排順序、九鼎怎麼借出、洛邑替誰加天命、相印怎麼算合縱、變法解鎖了什麼技能,都在規則頁裡。",
      play: "與電腦對弈 · 簡單", replay: "重玩", rules: "規則", home: "回首頁",
    },
  },
  // #62: 同 advisor.* 的形狀(標籤 + 開/關的 aria-label)。
  // #62 part 2(owner裁決:音效音樂同一開關):只剩一對字串。
  audio: { on: "聲音:開", off: "聲音:關" },
  // #72:開場影片的起手層,每次進站都播(?opening 仍可強制重播)。
  opening: { tap: "點一下開始", skip: "跳過 ›" },
  advisor: {
    name: "軍師",
    on: "軍師:開", off: "軍師:關",
    thinking: "軍師思考中",
    suggestCard: {
      event: "打出{card}的事件。",
      place: "用{card}在{space}放置影響力。",
      // #60:還沒選到目標(對手的牌、先觸發事件——advisor-ui.js 的
      // bannerTitle() 在 {space} 是空字串時改選這幾個)。
      placeNoTarget: "用{card}放置影響力。",
      campaign: "用{card}征伐{space}。",
      campaignNoTarget: "用{card}征伐。",
      lobby: "用{card}遊說{space}。",
      lobbyNoTarget: "用{card}遊說。",
      reform: "用{card}變法。",
      score: "現在打出{card}。",
      bog: "棄掉{card}。",
    },
    suggestUse: {
      event: "打出它的事件。",
      place: "在{space}放置影響力。",
      campaign: "征伐{space}。",
      lobby: "遊說{space}。",
      reform: "拿它變法。",
      score: "現在打出它。",
      bog: "棄掉它。",
    },
    suggestTarget: "目標:{space}",
    suggestOrder: { opsFirst: "先用行動點,再讓事件發生。", eventFirst: "先觸發事件,再用行動點。" },
    suggestHeadline: "蓋下{card}當標題。",
    suggestSetup: "在{space}放置{n}點影響力。",
    // #69 追加:一個「card」/「option」的待決選擇(回合結束棄牌,以及
    // cards.js 的每一張選牌/選項——呂不韋、韓非入秦、春申君、細作都在內)
    // 都點不到地圖上的任何一格,所以以前 bannerTitle() 一路 fall through
    // 到什麼都不顯示。discard/retrieve/choose 是「card」選擇來源可能的三種
    // 動詞(advisor-ui.js 的 cardPickVerb() 三選一);skip 刻意不寫張數
    // (可選的牌可能不只兩張);option 直接包住 pending 自己 options 陣列
    // 裡已經有的文字(那是 cards.js 的資料,不是這個檔案的)。
    suggestPick: {
      discard: "棄掉{card}。",
      retrieve: "取回{card}。",
      choose: "選{card}。",
      skip: "略過,手牌不動。",
      option: "選{option}。",
    },
    anyLegal: "亮著的都能選,金色只是軍師的推薦。",
    reasons: {
      takeControl: "這一手讓你拿下{space}的控制。",
      breakControl: "這一手讓對方失去{space}的控制。",
      battleground: "{space}是要衝,記分時多算一分。",
      scoringSoon: "手上有{region}的記分卡,先把這區做好。",
      destroyState: "這一手滅掉{state}。",
      nearDestroy: "{state}只差{n}個據點就滅了。",
      seal: "這一手拿到{state}的相印。",
      denySeal: "這一手不讓楚拿到{state}的相印。",
      mandate: "天命往我方移動{n}。",
      reform: "推進變法,解鎖新的能力。",
      dumpEnemyEvent: "現在用掉這張對手的牌,事件此時傷害最小。",
      bogDiscard: "頓兵堅城只能棄牌。棄{card},它的事件不會發生。",
      mustPlayScoring: "記分卡留到回合結束會輸,現在打出來。",
      avoidCollapse: "疲敝已經很高,這一手不會讓它更糟。",
      best: "目前最划算的一手。",
    },
  },
  // #29:牌頁一行說明「這張牌對你是哪一種」——自己的事件、中立牌、對手的
  // 牌、記分卡。固定文案(issue 自己的表),不套即時比分;renderPromptAndSheet
  // 仍另外用 scoringPanel 顯示完整的記分試算。
  sheet: {
    // #71 (owner, iPhone screenshot): replaces sheet.hint.enemy below while
    // no order is chosen yet on an opponent's card (place/campaign/lobby);
    // sheet.hint.enemy itself stays put further down once an order is picked.
    chooseOrder: "先選順序:先行動點,或先事件",
    hint: {
      own: "你自己的事件:打出就發生。",
      neutral: "中立牌:事件或行動點,二選一。",
      enemy: "對手的牌:行動點照用,但事件也會發生;先後由你選。",
      score: "記分卡:本回合內一定要打出。",
      // #34:唯讀牌頁自己的一行說明(owner 授權文案);{side} 是打出/棄掉/
      // 蓋標題牌的那一方,不是目前看牌的玩家自己那一邊。
      played: "{side}打出的牌。",
    },
    // #35:唯讀牌頁自己多出的兩行——牌頭第二行的陣營/是否移除(card-view.js),
    // 以及牌文下方的史事區塊(只有 stories.js 有這張牌的資料時才顯示)。
    removeYes: "事件觸發後移除。",
    removeNo: "打出後入棄牌堆。",
    history: "史事",
    source: "出處:",
  },
};

// The map: 26 spaces in 5 scoring regions plus 周室, and the second layer of
// five states with capitals used by 滅國 and 相印. Pure data, straight from
// the rulebook (Projects/zongheng/zongheng - rulebook.md, section 二).
// `adj` is symmetric; tests/engine.test.js checks it.

export const REGIONS = {
  west:  { zh: "西土", en: "the West",      home: "qin", presence: 2, domination: 4, control: 6 },
  jin:   { zh: "三晉", en: "the Three Jin", home: null,  presence: 4, domination: 8, control: 10 },
  zhou:  { zh: "周室", en: "Zhou",          home: null,  presence: 0, domination: 0, control: 0 }, // never scored
  east:  { zh: "東方", en: "the East",      home: null,  presence: 3, domination: 6, control: 8 },
  south: { zh: "南方", en: "the South",     home: "chu", presence: 2, domination: 5, control: 7 },
  north: { zh: "北疆", en: "the North",     home: null,  presence: 2, domination: 4, control: 6 },
};
export const SCORED_REGIONS = ["jin", "east", "south", "north", "west"];

// 滅 pays Qin `vp` once per state; 相印 pays Chu 1 once per state.
export const STATES = {
  han:  { zh: "韓", en: "Han",  capital: "xinzheng", vp: 2 },
  wei:  { zh: "魏", en: "Wei",  capital: "daliang",  vp: 2 },
  zhao: { zh: "趙", en: "Zhao", capital: "handan",   vp: 3 },
  qi:   { zh: "齊", en: "Qi",   capital: "linzi",    vp: 3 },
  yan:  { zh: "燕", en: "Yan",  capital: "ji",       vp: 2 },
};
export const MIE_TO_WIN = 3;   // states 滅 at once for the Qin instant win
export const SEALS_TO_WIN = 4; // 相印 held at once for the Chu instant win

export const SPACES = [
  // 西土, Qin's home
  { id: "guanzhong", zh: "關中",   en: "Guanzhong",  region: "west",  state: null,   stability: 4, battleground: true,  adj: ["hangu", "hanzhong", "yiqu", "bashu"] },
  { id: "hangu",     zh: "函谷關", en: "Hangu Pass", region: "west",  state: null,   stability: 3, battleground: false, adj: ["guanzhong", "yiyang", "hedong", "luoyi"] },
  { id: "hanzhong",  zh: "漢中",   en: "Hanzhong",   region: "west",  state: null,   stability: 3, battleground: false, adj: ["guanzhong", "bashu", "qianzhong"] },
  { id: "bashu",     zh: "巴蜀",   en: "Ba-Shu",     region: "west",  state: null,   stability: 3, battleground: false, adj: ["guanzhong", "hanzhong", "qianzhong"] },
  { id: "yiqu",      zh: "義渠",   en: "Yiqu",       region: "west",  state: null,   stability: 4, battleground: false, adj: ["guanzhong", "dai"] },
  // 三晉, the main front
  { id: "yiyang",    zh: "宜陽",   en: "Yiyang",     region: "jin",   state: "han",  stability: 2, battleground: false, adj: ["hangu", "luoyi", "xinzheng", "shangdang"] },
  { id: "xinzheng",  zh: "新鄭",   en: "Xinzheng",   region: "jin",   state: "han",  stability: 2, battleground: false, adj: ["yiyang", "shangdang", "daliang", "luoyi", "chencai"] },
  { id: "hedong",    zh: "河東",   en: "Hedong",     region: "jin",   state: "wei",  stability: 2, battleground: false, adj: ["hangu", "shangdang", "handan"] },
  { id: "daliang",   zh: "大梁",   en: "Daliang",    region: "jin",   state: "wei",  stability: 2, battleground: true,  adj: ["handan", "xinzheng", "song", "huaisi"] },
  { id: "shangdang", zh: "上黨",   en: "Shangdang",  region: "jin",   state: "zhao", stability: 2, battleground: true,  adj: ["yiyang", "hedong", "handan", "xinzheng"] },
  { id: "handan",    zh: "邯鄲",   en: "Handan",     region: "jin",   state: "zhao", stability: 2, battleground: true,  adj: ["hedong", "shangdang", "daliang", "zhongshan"] },
  // 周室
  { id: "luoyi",     zh: "洛邑",   en: "Luoyi",      region: "zhou",  state: null,   stability: 3, battleground: false, adj: ["hangu", "yiyang", "xinzheng"] },
  // 東方
  { id: "linzi",     zh: "臨淄",   en: "Linzi",      region: "east",  state: "qi",   stability: 3, battleground: true,  adj: ["jimo", "ju", "xue", "zhongshan"] },
  { id: "jimo",      zh: "即墨",   en: "Jimo",       region: "east",  state: "qi",   stability: 3, battleground: false, adj: ["linzi", "ju"] },
  { id: "ju",        zh: "莒",     en: "Ju",         region: "east",  state: "qi",   stability: 3, battleground: false, adj: ["linzi", "jimo", "xue"] },
  { id: "xue",       zh: "薛",     en: "Xue",        region: "east",  state: "qi",   stability: 2, battleground: false, adj: ["linzi", "ju", "song"] },
  { id: "song",      zh: "宋",     en: "Song",       region: "east",  state: null,   stability: 2, battleground: true,  adj: ["daliang", "xue", "huaisi"] },
  // 南方, Chu's home
  { id: "ying",      zh: "郢",     en: "Ying",       region: "south", state: null,   stability: 4, battleground: true,  adj: ["chencai", "qianzhong", "huaisi", "wuyue"] },
  { id: "huaisi",    zh: "淮泗",   en: "Huai-Si",    region: "south", state: null,   stability: 2, battleground: false, adj: ["daliang", "song", "ying", "wuyue", "chencai"] },
  { id: "wuyue",     zh: "吳越",   en: "Wu-Yue",     region: "south", state: null,   stability: 3, battleground: false, adj: ["huaisi", "ying"] },
  { id: "qianzhong", zh: "黔中",   en: "Qianzhong",  region: "south", state: null,   stability: 3, battleground: false, adj: ["hanzhong", "bashu", "ying"] },
  { id: "chencai",   zh: "陳蔡",   en: "Chen-Cai",   region: "south", state: null,   stability: 2, battleground: false, adj: ["xinzheng", "ying", "huaisi"] },
  // 北疆
  { id: "ji",        zh: "薊",     en: "Ji",         region: "north", state: "yan",  stability: 3, battleground: true,  adj: ["zhongshan", "dai", "liaodong"] },
  { id: "liaodong",  zh: "遼東",   en: "Liaodong",   region: "north", state: "yan",  stability: 4, battleground: false, adj: ["ji"] },
  { id: "zhongshan", zh: "中山",   en: "Zhongshan",  region: "north", state: "zhao", stability: 2, battleground: false, adj: ["handan", "linzi", "ji", "dai"] },
  { id: "dai",       zh: "代",     en: "Dai",        region: "north", state: "zhao", stability: 3, battleground: false, adj: ["yiqu", "ji", "zhongshan"] },
];

export const SPACE = Object.fromEntries(SPACES.map((s) => [s.id, s]));
export const BATTLEGROUNDS = SPACES.filter((s) => s.battleground).map((s) => s.id);
export const CAP_OVER_STABILITY = 2; // influence cap = stability + 2 (rulebook 未決項 3)

export function spacesOf(region) { return SPACES.filter((s) => s.region === region).map((s) => s.id); }
export function spacesOfState(state) { return SPACES.filter((s) => s.state === state).map((s) => s.id); }
export function cap(id) { return SPACE[id].stability + CAP_OVER_STABILITY; }

// Setup from the rulebook: fixed points, then the free points the players place.
export const SETUP = {
  qin: { fixed: { guanzhong: 4, hangu: 2, hanzhong: 1, yiqu: 1 }, free: 4, freeIn: ["west", "jin"] },
  chu: { fixed: { ying: 4, chencai: 2, qianzhong: 1, huaisi: 1 }, free: 4, freeIn: ["south", "east"], bonus: 2 },
};

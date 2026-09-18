// Pure rules. Runs unchanged in the browser (solo) and in the room Durable
// Object. Deterministic: the seeded RNG lives in the state, so a game replays
// from seed + actions, which is what makes the tests and the harness cheap.
//
// Scaffold (M0): the board data, the RNG and the constants. M1 adds
// createGame / legal / apply / view and the 72 cards (cards.js).
export * from "./board.js";

export const QIN = 0, CHU = 1;
export const SIDES = ["qin", "chu"];
export const MIN_PLAYERS = 2, MAX_PLAYERS = 2;
export const TURNS = 8;
// era: which deck is shuffled in before that turn's refill; hand and rounds
// follow the era (rulebook 三, 回合結構).
export const ERAS = [
  { id: "reform",  zh: "變法期", en: "Reform era",   turns: [1, 2, 3], hand: 8, rounds: 6 },
  { id: "alliance", zh: "縱橫期", en: "Alliance era", turns: [4, 5, 6], hand: 9, rounds: 7 },
  { id: "conquest", zh: "兼併期", en: "Conquest era", turns: [7, 8],    hand: 9, rounds: 7 },
];
export const MANDATE_TO_WIN = 20;
export const WEARINESS = ["土崩", "民困", "禍結", "兵連", "承平"]; // index = level 1..5 minus 1

// ---------- RNG (mulberry32) ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(rng.next() * n); },
    getState() { return a; },
    setState(s) { a = s >>> 0; },
  };
  return rng;
}
export function randomSeed() { return Math.floor(Math.random() * 2 ** 31); }
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// JSON clone on purpose: structuredClone crashes V8 on the development machine.
export const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- the game (M1) ----------
export function createGame() { throw new Error("engine: createGame lands in M1"); }
export function legal() { throw new Error("engine: legal lands in M1"); }
export function apply() { throw new Error("engine: apply lands in M1"); }
export function view() { throw new Error("engine: view lands in M1"); }
export function mustAct() { return []; }

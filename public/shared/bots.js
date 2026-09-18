// The bot (M2): a scored one-ply search over the engine's legal actions, with
// a static evaluation (region scoring value, 要衝 count, 滅 and 相印 progress,
// weariness safety, hand quality, reform unlocks) and sampled opponent hands
// for the headline. Every decision carries a `why` for table talk.
export const LEVELS = ["easy", "normal", "hard"];
export function decide() { throw new Error("bots: decide lands in M2"); }

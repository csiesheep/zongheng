// #137: a game's log as a download (.json; the .txt is built from this).
//
// `exportGame(view, meta)` takes what the client holds -- a per-seat or
// spectator VIEW (engine.js `view()`), never the raw state -- plus what a view
// does not know about itself, and returns the contract object:
//
//   { format: "zongheng-log", version: 1, exportedAt, lang,
//     game: { mode, level, viewer, names: [qin, chu], options },
//     result: null | { winner, reason, turn, mandate },
//     log: [...the view's log...],
//     final: null | view.final }
//
// Because it only reads the view, a download holds exactly what that viewer
// sees: mid-game there is no seed and no hidden card in it (#131); once the
// game is over `view.final` carries the reveal for every seat and spectators,
// and `final.actions`, every action the engine applied, in order:
// `E.replay(final.seed, game.options, final.actions)` rebuilds the game
// exactly. A game with no recorded actions (a save from before #137, the
// tutorial) has no `final.actions` key: that absence means "not replayable".
//
// meta: { mode: "solo" | "room", level: "easy"|"normal"|"hard"|null,
//         names: [qin, chu] or { qin, chu } (the room's `names` message),
//         lang: "zh" / "zh-Hant" / "en" (anything starting with "zh" is zh-Hant),
//         viewer: 0 | 1 | null (the seat the view was made for; null = spectator),
//         exportedAt: ISO string (optional; defaults to now) }
//
// Pure apart from that clock default, DOM-free and dependency-free, so the
// browser, the Worker and Node all load it as is.
const SIDE_KEYS = ["qin", "chu"];
const copy = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));

function namesOf(names) {
  if (Array.isArray(names)) return [0, 1].map((i) => (names[i] == null ? null : String(names[i])));
  if (names && typeof names === "object") return SIDE_KEYS.map((k) => (names[k] == null ? null : String(names[k])));
  return [null, null];
}

export function exportGame(view, meta = {}) {
  if (!view || typeof view !== "object") throw new Error("exportGame: a view is required");
  const lang = typeof meta.lang === "string" && meta.lang.toLowerCase().startsWith("zh") ? "zh-Hant" : "en";
  const viewer = meta.viewer === 0 || meta.viewer === 1 ? meta.viewer : null;
  const over = view.winner != null;
  return {
    format: "zongheng-log",
    version: 1,
    exportedAt: meta.exportedAt ?? new Date().toISOString(),
    lang,
    game: {
      mode: meta.mode === "room" ? "room" : "solo",
      level: meta.level ?? null,
      viewer,
      names: namesOf(meta.names),
      options: copy(view.options) ?? {},
    },
    result: over ? { winner: view.winner, reason: view.reason ?? null, turn: view.turn, mandate: view.mandate } : null,
    log: copy(view.log) ?? [],
    final: over && view.final ? copy(view.final) : null,
  };
}

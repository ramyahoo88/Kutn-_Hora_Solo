// How often do the last-resort tie-breaks that need extra table bookkeeping decide a choice?
// Build: "earliest acquired right" (needs rights kept in order). Mine: "first tile drawn" (needs draw order).
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {BUILDINGS, MINES} = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
let builds = 0, byRightOrder = 0, keeps = 0, multiDraw = 0, byDrawOrder = 0, games = 0;
for (const count of [2, 3, 4]) for (let i = 0; i < 40; i++) {
  let s = E.createGame({seed: `tb-${count}-${i}`, playerCount: count, setup: 1 + i % 9, starter: i % count, difficulty: 'mincmistr', mincmistr: {level: 'master'}});
  games += count - 1;
  while (s.phase !== 'end') {
    if (s.actor === 0) { s = E.transition(s, botAction(s, 'standard')); continue; }
    const n = playMincmistr(s);
    const lines = n.log.findLast(e => e.actor === s.actor && e.explanation)?.explanation ?? [];
    const fresh = lines.slice(-3).map(x => x.text);
    if (n.city.some((c, k) => c?.id && !s.city[k]?.id)) { builds++; if (fresh.some(t => t.includes('Tie broken by the earliest acquired right'))) byRightOrder++; }
    const item = s.pending[0];
    if (item?.kind === 'mine-place') { keeps++; if ((item.drawn?.length ?? 1) > 1) multiDraw++; if (fresh.some(t => t.startsWith('Keep') && t.includes('Tie broken by the first tile drawn'))) byDrawOrder++; }
    s = n;
  }
}
const per = x => +(x / games).toFixed(2);
console.log(JSON.stringify({mincmistrGames: games, builds, buildsDecidedByRightOrder: byRightOrder, perGame: per(byRightOrder), mineDraws: keeps, drawsOfSeveralTiles: multiDraw, keepsDecidedByDrawOrder: byDrawOrder, perGameDraw: per(byDrawOrder)}));

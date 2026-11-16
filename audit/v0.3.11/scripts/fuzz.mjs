// Random and bot games at every table size. After each step: checkGame, input
// immutability, preview-vs-applied effects; at round ends: independent council
// scoring; at game end: independent final scoring and winner.
// node fuzz.mjs <games-per-count> <prefix>
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const D = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {checkGame, readSave, writeSave} = await import(R + 'save.mjs');
const {shuffle} = await import(R + 'random.mjs');
const [games, prefix] = [Number(process.argv[2] ?? 10), process.argv[3] ?? 'fuzz'];

const board = s => D.GAME_RULES[s.players.length].board;
function dotsMatch(a, b) { return [...b].filter(x => a.includes(x)).length; }
function town(s, seat) {
  const {edge, neighbours} = board(s);
  let t = 0;
  s.city.forEach((c, i) => {
    if (!c?.id || c.owner !== seat) return;
    const dots = D.BUILDINGS[c.id].dots;
    t += dotsMatch(dots, edge[i] ?? '');
    for (const n of neighbours[i]) if (s.city[n]?.id) t += dotsMatch(dots, D.BUILDINGS[s.city[n].id].dots);
  });
  return t;
}
function mineAwards(s) {
  const w = board(s).mineWidth, n = s.players.length, vp = s.players.map(() => 0), counts = [];
  for (let r = 0; r < 4; r++) {
    const stars = s.players.map(() => 0), count = s.players.map(() => 0); let total = 0;
    for (let c = 0; c < w; c++) { const cell = s.mine[r * w + c]; if (!cell) continue; total += cell.stars; if (!cell.rock) { stars[cell.owner] += cell.stars; count[cell.owner]++; } }
    const table = n === 2 ? (total <= 3 ? [2,0] : total <= 6 ? [4,1] : [6,2]) : (total <= 5 ? [2,1,0] : total <= 9 ? [3,2,1] : [5,3,2]);
    stars.forEach((st, k) => { if (st > 0) vp[k] += table[stars.filter(o => o > st).length] ?? 0; });
    counts.push(count);
  }
  return {vp, counts};
}
function council(s, seat) {
  const {neighbours} = board(s);
  let green = 0;
  s.city.forEach((c, i) => { if (c?.id && c.owner === seat) green += neighbours[i].filter(n => s.city[n]?.id && D.BUILDINGS[s.city[n].id].public).length; });
  const {counts} = mineAwards(s);
  const p = s.players[seat];
  const per = {green, silver: 3 * Math.floor(p.usedPelicans / 2), yellow: 2 * Math.min(2, ...counts.map(c => c[seat])), red: 3 * Math.min(...p.houses)};
  return D.PATRICIANS.reduce((t, c) => t + per[c] * s.council[c], 0);
}
function finalScores(s) {
  const {vp} = mineAwards(s);
  return s.players.map((p, k) => {
    const inc = D.GOODS.reduce((t, g) => t + p.production[g] * E.price(s, g), 0);
    const plots = s.city.filter(c => c?.plot === k).length;
    const total = p.vp + town(s, k) + vp[k] + Math.floor(inc / 10) + (D.REP_SCORE[p.rep] ?? 0) + p.held.length + plots + p.pelicans;
    return {total, coins: p.coins};
  });
}

const tally = {games: 0, steps: 0, checks: 0, councilChecks: 0, councilBad: [], finalBad: [], mutations: 0, endings: {}, phases: {}};
for (const count of [2, 3, 4]) for (let g = 0; g < games; g++) {
  const seed = `${prefix}-${count}-${g}`;
  const difficulty = ['standard', 'quick', 'mincmistr', 'planner'][g % 4];
  const humanMode = g % 3; // 0 random, 1 standard, 2 random-with-skips
  let s = E.createGame({seed, playerCount: count, setup: 1 + g % 9, side: g % count, starter: g % count, difficulty, events: g % 2 === 0,
    mincmistr: {level: ['apprentice','journeyman','master','grandmaster'][g % 4], shared: g % 2 === 0}});
  const rng = {rng: E.seedNumber(seed)};
  let steps = 0;
  while (s.phase !== 'end') {
    if (++steps > 5000) throw Error('stall ' + seed);
    const before = JSON.stringify(s);
    let next;
    if (s.actor === 0 || difficulty === 'planner' && humanMode === 0) {
      let a;
      if (s.actor === 0 && humanMode === 1) a = botAction(s, 'standard');
      else { const legal = E.legalActions(s); const real = legal.filter(x => x.kind !== 'skip'); a = shuffle(rng, humanMode === 2 || !real.length ? legal : real)[0]; }
      next = E.transition(s, a);
    } else next = difficulty === 'mincmistr' ? playMincmistr(s) : E.transition(s, botAction(s));
    if (JSON.stringify(s) !== before) tally.mutations++;
    // Council scoring happens inside finishRound: compare VP deltas when the round advances past a scoring round.
    if ((next.round !== s.round || next.phase === 'end') && (s.phase === 'tax' || s.phase === 'action')) {
      const {redRound} = E.rulesFor(s);
      // State just before scoring: same as next minus scoring; recompute from s after the final step without scoring.
      if (s.round > redRound) {
        // Reconstruct the pre-scoring position by replaying the step with scoring disabled is not possible; check delta instead.
        for (let k = 0; k < count; k++) {
          const preVp = s.players[k].vp, postVp = next.players[k].vp;
          // Pre-scoring board equals the board after the last action/tax; tax steps do not change the board.
          const tmp = structuredClone(next); tmp.players[k].vp = preVp; tmp.council = next.council;
          const expected = council(next, k);
          const taxVpDelta = (s.phase === 'tax' && s.actor === k) ? (E.reputationChange(s.players[k].rep, -(E.rulesFor(s).repLoss[s.round])).vp) : 0;
          const tookPenalty = s.phase === 'tax' && s.actor === k && next.log.slice(s.log.length).some(e => e.actor === k && e.text.includes('in lieu of tax'));
          const delta = postVp - preVp - (tookPenalty ? taxVpDelta : 0);
          tally.councilChecks++;
          if (s.phase === 'tax' && delta !== expected) tally.councilBad.push({seed, round: s.round, seat: k, delta, expected});
        }
      }
    }
    s = next;
    tally.steps++;
    if (steps % 11 === 0) { checkGame(structuredClone(s)); tally.checks++; }
  }
  const mine = finalScores(s), app = s.result.scores;
  mine.forEach((x, k) => { if (x.total !== app[k].total) tally.finalBad.push({seed, seat: k, mine: x.total, app: app[k].total}); });
  const best = Math.max(...mine.map(x => x.total));
  const topCoins = Math.max(...mine.filter(x => x.total === best).map(x => x.coins));
  const winners = mine.flatMap((x, k) => x.total === best && x.coins === topCoins ? [k] : []);
  if (JSON.stringify(winners) !== JSON.stringify(s.result.winners)) tally.finalBad.push({seed, winners, app: s.result.winners});
  const back = readSave(writeSave(s));
  if (JSON.stringify(back.result) !== JSON.stringify(s.result)) tally.finalBad.push({seed, roundTrip: true});
  tally.games++;
}
console.log(JSON.stringify({...tally, councilBad: tally.councilBad.length, finalBad: tally.finalBad.length}));
if (tally.councilBad.length) console.log(JSON.stringify(tally.councilBad.slice(0, 5)));
if (tally.finalBad.length) console.log(JSON.stringify(tally.finalBad.slice(0, 5)));

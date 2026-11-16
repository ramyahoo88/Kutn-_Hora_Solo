// "v1.2.5 clarifies the rules without changing the Mincmistr's decisions": play the same games with the
// v0.3.5 sources and the current sources and compare every journal line and the final scores.
// node same-as-v035.mjs <path to a v0.3.5 checkout> [games per table size]
import {pathToFileURL} from 'node:url';
const old = pathToFileURL(process.argv[2] + '/src/').href, cur = new URL('../../../src/', import.meta.url).href;
const load = async R => ({E: await import(R + 'engine.mjs'), B: await import(R + 'bot.mjs'), M: await import(R + 'mincmistr.mjs')});
const A = await load(old), B = await load(cur);
const n = Number(process.argv[3] ?? 20);
let games = 0, same = 0; const diffs = [];
for (const count of [2, 3, 4]) for (let i = 0; i < n; i++) {
  const opts = {seed: `same-${count}-${i}`, playerCount: count, setup: 1 + i % 9, side: i % count, starter: i % count, difficulty: 'mincmistr', events: i % 2 === 0,
    mincmistr: {level: ['apprentice', 'journeyman', 'master', 'grandmaster'][i % 4], shared: i % 3 !== 0, tougher: false}};
  const run = ({E, B: bot, M}) => { let s = E.createGame(opts); while (s.phase !== 'end') s = s.actor === 0 ? E.transition(s, bot.botAction(s, 'standard')) : M.playMincmistr(s);
    return JSON.stringify([s.result.scores, s.log.map(e => [e.round, e.actor, e.text])]); };
  games++; run(A) === run(B) ? same++ : diffs.push(opts.seed);
}
console.log(JSON.stringify({games, identical: same, different: diffs}));

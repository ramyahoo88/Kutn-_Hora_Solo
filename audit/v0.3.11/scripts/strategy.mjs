// Purposeful human-seat strategies against shipped Mincmistr levels on matched seeds.
// node strategy.mjs <seeds> <prefix> <count> <level> <policies,comma> <out.jsonl>
import {appendFileSync} from 'node:fs';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {shuffle} = await import(R + 'random.mjs');
const [seeds, prefix, count, level, policies, out] = [Number(process.argv[2]), process.argv[3], Number(process.argv[4]), process.argv[5], process.argv[6].split(','), process.argv[7]];

// "taxdodge": Standard, but declines every tax bill (reputation instead) and favours public builds that raise tax.
// "random": uniform legal non-skip moves.
function human(s, policy, rng) {
  if (policy === 'random') { const l = E.legalActions(s); const real = l.filter(a => a.kind !== 'skip'); return shuffle(rng, real.length ? real : l)[0]; }
  if (policy === 'taxdodge' && s.phase === 'tax') return E.legalActions(s).find(a => a.kind === 'penalty');
  return botAction(s, policy === 'taxdodge' ? 'standard' : policy);
}
for (const policy of policies) for (let i = 0; i < seeds; i++) for (let starter = 0; starter < count; starter++) {
  const seed = `${prefix}-${count}-${i}`;
  let s = E.createGame({seed, playerCount: count, setup: 1 + i % 9, side: i % count, starter, difficulty: 'mincmistr', mincmistr: {level}});
  const rng = {rng: E.seedNumber(seed + policy + starter)};
  const mStats = {discards: 0, cash: 0, plays: 0, taxPaid: 0, taxDeclined: 0, plots: 0, taxRounds: 0};
  while (s.phase !== 'end') {
    if (s.actor === 0) { s = E.transition(s, human(s, policy, rng)); continue; }
    const before = s;
    s = playMincmistr(s);
    const notes = s.log.slice(before.log.length).filter(e => e.actor === before.actor).map(e => e.text);
    if (before.phase === 'action' && !before.pending.length) {
      mStats.plays++;
      if (notes.some(t => t.startsWith('Spent the') && t.endsWith('with no effect.'))) mStats.discards++;
    }
    if (before.phase === 'tax') {
      mStats.taxRounds++;
      mStats.plots += E.plotCount(before, before.actor);
      if (notes.some(t => t.startsWith('Paid'))) mStats.taxPaid += E.taxCost(before, before.actor); else mStats.taxDeclined++;
    }
  }
  const sc = s.result.scores.map(x => x.total);
  const best = Math.max(...sc.slice(1));
  appendFileSync(out, JSON.stringify({policy, level, count, seed, starter, human: sc[0], best, margin: sc[0] - best,
    win: s.result.winners.length === 1 && s.result.winners[0] === 0, shared: s.result.winners.length > 1 && s.result.winners.includes(0), mStats}) + '\n');
}

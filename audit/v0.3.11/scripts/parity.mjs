// Shadow every Mincmistr decision in digital games with the independent oracle.
// node parity.mjs <games-per-config> <prefix> [out.json]
import {writeFileSync} from 'node:fs';
import {oracle} from './oracle.mjs';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const D = await import(R + 'data.mjs');
const {playMincmistr, PLAN_DECK} = await import(R + 'mincmistr.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {checkGame, readSave, writeSave} = await import(R + 'save.mjs');
const {shuffle} = await import(R + 'random.mjs');

const games = Number(process.argv[2] ?? 4), prefix = process.argv[3] ?? 'parity', out = process.argv[4];
const strip = s => { const {log, mincmistr, ...rest} = s; return JSON.stringify(rest); };
const stats = {games: 0, decisions: 0, cardPlays: 0, mismatches: [], rules: {}, cardCounts: {ok: 0, bad: []}, roundTrips: 0, scores: []};

function humanMove(s, rng, mode) {
  if (mode === 'standard') return botAction(s, 'standard');
  const legal = E.legalActions(s);
  // Random legal move, avoiding no-effect plays when something else exists.
  const real = legal.filter(a => a.kind !== 'skip');
  const pool = real.length && rng.rng % 5 ? real : legal;
  return shuffle(rng, pool)[0];
}

const configs = [];
for (const count of [2, 3, 4]) for (const level of ['apprentice', 'journeyman', 'master', 'grandmaster'])
  for (const shared of count === 2 ? [true] : [true, false])
    for (const tougher of count === 3 && level === 'master' ? [false, true] : [false]) configs.push({count, level, shared, tougher});

for (const cfg of configs) for (let g = 0; g < games; g++) {
  const seed = `${prefix}-${cfg.count}-${cfg.level}-${cfg.shared ? 's' : 'i'}${cfg.tougher ? 't' : ''}-${g}`;
  const mode = g % 2 ? 'standard' : 'random';
  let s = E.createGame({seed, playerCount: cfg.count, setup: 1 + g % 9, side: g % cfg.count, starter: (g * 7) % cfg.count,
    difficulty: 'mincmistr', events: g % 3 === 0, mincmistr: {level: cfg.level, shared: cfg.shared, tougher: cfg.tougher}});
  const rng = {rng: E.seedNumber(seed + '/human')};
  const plays = {}; // seat/round -> card plays
  let steps = 0;
  while (s.phase !== 'end') {
    if (++steps > 4000) throw Error('stalled ' + seed);
    if (s.actor === 0) { s = E.transition(s, humanMove(s, rng, mode)); continue; }
    const seat = s.actor, m = s.mincmistr, slot = m.shared ? 0 : seat - 1;
    let plan, deckAfter = m.decks[slot];
    const cardPlay = s.phase === 'action' && !s.pending.length;
    if (cardPlay) {
      const d = structuredClone(m.decks[slot]);
      plan = PLAN_DECK[E.drawPlan(d)];
      deckAfter = d;
      const key = `${seat}/${s.round}`;
      plays[key] = (plays[key] ?? 0) + 1;
      stats.cardPlays++;
    } else plan = PLAN_DECK[m.lastPlans[seat - 1]];
    const o = oracle(s, seat, plan, m.level);
    const expected = o.a ?? o;
    if (o.rule) stats.rules[o.rule] = (stats.rules[o.rule] ?? 0) + 1;
    const app = playMincmistr(s);
    const decks = [...m.decks]; decks[slot] = deckAfter;
    const oracleNext = E.transition({...s, mincmistr: {...m, decks}}, expected);
    stats.decisions++;
    if (strip(app) !== strip(oracleNext) || JSON.stringify(app.mincmistr.decks) !== JSON.stringify(oracleNext.mincmistr.decks)) {
      if (stats.mismatches.length < 30) stats.mismatches.push({seed, cfg, round: s.round, turn: s.turn, seat, plan: plan?.number, rule: o.rule, expected, appLog: app.log.slice(s.log.length).map(e => e.text), save: writeSave(s)});
      else stats.mismatches.push({seed});
    }
    // v0.3.6+: "Why this move?" — the journal's rule label and card line must agree with the oracle.
    if (cardPlay) {
      const entry = app.log.slice(s.log.length).find(e => e.rule);
      const want = o.rule.startsWith('4.3') ? `Rule 4.3 · Goal ${plan.goals.indexOf(o.rule[3]) + 1} ` : `Rule ${o.rule.slice(0, 3)} `;
      const cardLine = entry?.explanation?.at(-1)?.text ?? '';
      const {CARDS, LABEL} = D;
      const name = CARDS[expected.card].map(k => LABEL[k]).join(' / ');
      stats.labels = (stats.labels ?? 0) + 1;
      if (!entry || !entry.rule.startsWith(want) || !cardLine.includes(name)) (stats.labelBad ??= []).push({seed, round: s.round, seat, appRule: entry?.rule, oracle: o.rule, cardLine, name});
      const n = entry?.explanation?.length ?? 0;
      stats.maxExplanation = Math.max(stats.maxExplanation ?? 0, n);
    }
    s = app;
    if (steps % 37 === 0) { checkGame(structuredClone(s)); const back = readSave(writeSave(s)); if (strip(back) !== strip(s)) throw Error('round trip ' + seed); stats.roundTrips++; }
  }
  // Rule 9: card plays per round.
  const rounds = E.rulesFor(s).rounds;
  for (let seat = 1; seat < cfg.count; seat++) for (let round = 1; round <= rounds; round++) {
    const asSix = round + 6 - rounds;
    const extra = cfg.level === 'grandmaster' || (cfg.level === 'master' && (asSix >= 4 || (cfg.tougher && asSix >= 3)));
    const want = extra ? 6 : 5, got = plays[`${seat}/${round}`] ?? 0;
    if (got === want) stats.cardCounts.ok++; else stats.cardCounts.bad.push({seed, seat, round, want, got});
  }
  stats.games++;
  stats.scores.push({seed, cfg, mode, totals: s.result.scores.map(x => x.total), winners: s.result.winners});
}
const summary = {games: stats.games, decisions: stats.decisions, cardPlays: stats.cardPlays, mismatches: stats.mismatches.length,
  cardCounts: {ok: stats.cardCounts.ok, bad: stats.cardCounts.bad.length}, roundTrips: stats.roundTrips, rules: stats.rules,
  labels: stats.labels, labelBad: (stats.labelBad ?? []).length, maxExplanation: stats.maxExplanation};
if (stats.labelBad?.length) console.log(JSON.stringify(stats.labelBad.slice(0, 4), null, 1));
console.log(JSON.stringify(summary, null, 1));
if (stats.mismatches.length) console.log(JSON.stringify(stats.mismatches.slice(0, 3).map(({save, ...x}) => x), null, 1));
if (stats.cardCounts.bad.length) console.log(JSON.stringify(stats.cardCounts.bad.slice(0, 5)));
if (out) writeFileSync(out, JSON.stringify(stats, null, 1));

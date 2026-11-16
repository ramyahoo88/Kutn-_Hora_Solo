// README playtest checks, on the engine and the shipped fixtures.
import {readFileSync} from 'node:fs';
const R = new URL('../../../src/', import.meta.url).href, F = new URL('../../../test/fixtures/', import.meta.url);
const E = await import(R + 'engine.mjs'); const {GUILDS, BUILDINGS} = await import(R + 'data.mjs');
const {readSave, readPosition} = await import(R + 'save.mjs'); const {playMincmistr} = await import(R + 'mincmistr.mjs');
const out = {};
out.oneRival = E.createGame({seed: 'silver-1308', setup: 1, side: 0}).players.map(p => p.guilds.map(k => GUILDS[k]).join(', '));
const g3 = E.createGame({seed: 'app-table-3', setup: 6, playerCount: 3});
out.twoRivals = {rounds: E.rulesFor(g3).rounds, town: g3.city.length, mineWidth: E.rulesFor(g3).board.mineWidth, redRound: E.rulesFor(g3).redRound};
// Market expansion Plan.
{ const s = readPosition(readFileSync(new URL('Market_Expansion_Plan.json', F), 'utf8')).state; let before;
  let n = playMincmistr(s, x => { before = structuredClone(x); });
  while (n.pending.length && n.actor === s.actor) n = playMincmistr(n);
  out.marketExpansion = n.log.slice(s.log.length).map(e => e.text); }
// Round-end Plan.
{ const s = readPosition(readFileSync(new URL('Round_End_Plan.json', F), 'utf8')).state; let mid = null;
  let n = s; do { n = playMincmistr(n, x => { mid = structuredClone(x); }); } while (!mid && n.phase !== 'end');
  out.roundEnd = {oreBefore: s.ore, oreAfterPlan: mid.ore, oreAfterRoundEnd: n.ore, pelicans: s.players.map((p, k) => `${p.pelicans}→${n.players[k].pelicans}`), lines: n.log.slice(mid.log.length).map(e => e.text)}; }
// Ius Regale fixture.
{ let s = readSave(readFileSync(new URL('Ius_Regale_Short_Stack.json', F), 'utf8')); const ore = s.ore, deck = s.mineDeck.length;
  s = E.transition(s, E.legalActions(s).find(a => a.kind === 'skip'));
  out.iusRegale = {deck, deckAfter: s.mineDeck.length, ore: `${ore}→${s.ore}`, line: s.log.find(e => e.text.startsWith('Ius Regale'))?.text}; }
// Grandmaster at four players: both remaining cards on the last turn of every round.
{ const g = E.createGame({seed: 'app-table-4', setup: 6, playerCount: 4, difficulty: 'mincmistr', mincmistr: {level: 'grandmaster'}});
  out.grandmaster = Array.from({length: E.rulesFor(g).rounds}, (_, r) => { const c = {...g, round: r + 1}; return Array.from({length: E.turnsPerRound(c)}, (_, t) => E.seatAtTurn(c, t) === 1 ? E.cardsThisTurn(c, t) : 0).reduce((a, b) => a + b, 0); }); }
console.log(JSON.stringify(out, null, 1));

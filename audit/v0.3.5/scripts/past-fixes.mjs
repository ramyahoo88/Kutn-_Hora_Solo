// Recheck earlier fixes and a nearby case whose outcome should differ.
import assert from 'node:assert/strict';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const D = await import(R + 'data.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {readSave, writeSave} = await import(R + 'save.mjs');
const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const at = (s, patch) => { const c = structuredClone(s); patch(c); return c; };

check('Third house row: 1, 3, 4 reputation then 8 VP; top row grants a public right instead', () => {
  const g = E.createGame({seed: 'pf-house'});
  const rewards = [];
  for (let built = 0; built < 4; built++) {
    const s = at(g, c => { const p = c.players[0]; p.houses = [0, 0, built]; p.held = ['tavern']; p.coins = 99; p.rep = 0; p.vp = 0;
      c.city = c.city.map(() => null); const space = c.city.findIndex((_, i) => E.rulesFor(c).board.town[i]); c.city[space] = {plot: 0};
      c.pop = 40; c.players[0].guilds = ['wood', 'food', 'beer']; c.market = c.market.map(r => r.filter(st => !st.tiles.includes('tavern'))); });
    const a = E.legalActions(s).find(x => x.kind === 'build' && x.id === 'tavern' && !x.as);
    const n = E.transition(s, a);
    rewards.push([n.players[0].rep - s.players[0].rep, n.players[0].vp - s.players[0].vp]);
  }
  assert.deepEqual(rewards, [[1, 0], [3, 0], [4, 0], [0, 8]]);
  // Nearby: the same build from the top row gives no reputation and opens a public-rights choice.
  const top = at(g, c => { const p = c.players[0]; p.houses = [0, 0, 0]; p.held = ['tavern']; p.coins = 99; p.rep = 0;
    c.city = c.city.map(() => null); const space = c.city.findIndex((_, i) => E.rulesFor(c).board.town[i]); c.city[space] = {plot: 0};
    c.pop = 40; p.guilds = ['beer', 'food', 'wood']; c.market = c.market.map(r => r.filter(st => !st.tiles.includes('tavern'))); });
  const n = E.transition(top, E.legalActions(top).find(x => x.kind === 'build' && !x.as));
  assert.equal(n.players[0].rep, 0);
  assert.deepEqual(n.pending[0], {kind: 'right', publicOnly: true});
});

check('Long seeds: 52, 53 and 64 characters keep three distinct individual decks; shared deck stays single', () => {
  for (const n of [52, 53, 64]) {
    const g = E.createGame({seed: 'Z'.repeat(n), playerCount: 4, difficulty: 'mincmistr', mincmistr: {shared: false}});
    assert.equal(new Set(g.mincmistr.decks.map(d => d.draw.join())).size, 3);
    const sh = E.createGame({seed: 'Z'.repeat(n), playerCount: 4, difficulty: 'mincmistr'});
    assert.equal(sh.mincmistr.decks.length, 1);
  }
  // A 65-character seed is cut to 64 by setup, so it matches the 64-character game.
  const a = E.createGame({seed: 'Q'.repeat(65), playerCount: 3, difficulty: 'mincmistr', mincmistr: {shared: false}});
  const b = E.createGame({seed: 'Q'.repeat(64), playerCount: 3, difficulty: 'mincmistr', mincmistr: {shared: false}});
  assert.deepEqual(a.mincmistr.decks, b.mincmistr.decks);
});

check('St. Barbara 9: free mines use reserve first; with an empty reserve they use the pool', () => {
  const base = E.createGame({seed: 'pf-dig'});
  for (const [reserve, pool, expect] of [[1, 1, {reserve: 0, pool: 1}], [0, 2, {reserve: 0, pool: 1}]]) {
    let s = at(base, c => { c.barbara = 9; const p = c.players[0]; p.pelicans = 1; p.reserve = reserve; p.pool = pool; p.coins = 99;
      // keep the miner total at 9 by placing dummy mines
      const placed = 9 - reserve - pool; let k = 0;
      for (let i = 0; i < c.mine.length && k < placed; i++) if (!c.mine[i]) { const id = c.mineDeck.pop(); c.mine[i] = {id, owner: 0, stars: D.MINES[id].stars}; k++; } });
    s = E.transition(s, E.legalActions(s).find(a => a.kind === 'barbara'));
    s = E.transition(s, E.legalActions(s).find(a => a.kind === 'mine'));
    const place = E.legalActions(s).find(a => a.kind === 'place-mine');
    assert.equal(place.cost, 0);
    s = E.transition(s, place);
    assert.deepEqual({reserve: s.players[0].reserve, pool: s.players[0].pool}, expect, `reserve ${reserve}`);
  }
});

check('Tax penalty at the reputation floor converts the overflow to VP; one step above does not', () => {
  for (const [rep, expectRep, expectVp] of [[-5, -5, -4], [-3, -5, 0], [-4, -5, -2]]) {
    const r = E.reputationChange(rep, -2);
    assert.deepEqual([r.rep, r.vp], [expectRep, expectVp]);
  }
});

check('Ius Regale discards 5 from a long stack and the rest from a short one', () => {
  for (const [left, discarded] of [[3, 3], [7, 5], [0, 0]]) {
    let s = E.createGame({seed: 'pf-ius'});
    s = at(s, c => { c.events[0] = 'code'; const extra = c.mineDeck.splice(left); c.mineDiscard.push(...extra); });
    while (s.round === 1) s = E.transition(s, E.legalActions(s).find(a => a.kind === 'skip' || a.kind === 'tax' || a.kind === 'penalty'));
    const line = s.log.find(e => e.text.startsWith('Ius Regale'));
    assert.match(line.text, new RegExp(`discarded ${discarded} mine`));
    assert.equal(s.mineDeck.length, left - discarded);
  }
});

check('Tile 7 overflow above reputation 9 becomes VP', () => {
  const r = E.reputationChange(8, 3);
  assert.deepEqual([r.rep, r.vp], [9, 4]);
});

check('Mincmistr edge compares with the best opponent, not the human only (4 players)', () => {
  let s = E.createGame({seed: 'pf-edge', playerCount: 4, difficulty: 'mincmistr', starter: 1});
  // Give rival 2 two used pelicans' worth (silver 3) and rival 1 four (silver 6); the human has none.
  s = at(s, c => { c.players[1].usedPelicans = 4; c.players[2].usedPelicans = 6; c.players[1].coins = 15; c.patrons.silver = 1; c.bank.silver = 2; });
  // Rival 1 has < 20 g: rule 4.1 Income. Silver edge vs best opponent = 6 - 9 = -3 -> plain Income.
  const n = playMincmistr(s);
  assert.equal(n.council.silver, 0);
  // Nearby: if rival 2 had used only 2 pelicans, edge = 6 - 3 = 3 -> seats silver.
  const s2 = at(s, c => { c.players[2].usedPelicans = 2; });
  assert.equal(playMincmistr(s2).council.silver, 1);
});

check('v0.1.0 saves migrate III-3 to two stars (fixture regenerated)', () => {
  const g = E.createGame({seed: 'pf-mig'});
  const old = structuredClone(g); old.schema = 1; delete old.setupVersion;
  const i = old.mine.findIndex(c => !c);
  const id = 'm3-3'; old.mineDeck = old.mineDeck.filter(x => x !== id); old.mine[i] = {id, owner: 0, stars: 0}; old.players[0].pool = 0;
  const back = readSave(JSON.stringify({kind: 'kutna-hora-solo', state: old}));
  assert.equal(back.mine[i].stars, D.MINES[id].stars);
  assert.equal(back.setupVersion, 1);
});

check('Master: 6 card plays in rounds 4-6 at 2 players, rounds 3-5 at 4; tougher 3-player adds round 3', () => {
  for (const [count, opts, doubled] of [[2, {level: 'master'}, [4, 5, 6]], [4, {level: 'master'}, [3, 4, 5]], [3, {level: 'master', tougher: true}, [3, 4, 5, 6]], [3, {level: 'master', tougher: false}, [4, 5, 6]]]) {
    const g = E.createGame({seed: 'pf-master', playerCount: count, difficulty: 'mincmistr', mincmistr: opts});
    const rounds = E.rulesFor(g).rounds;
    for (let round = 1; round <= rounds; round++) {
      const c = at(g, x => { x.round = round; });
      const total = Array.from({length: E.turnsPerRound(c)}, (_, t) => E.seatAtTurn(c, t) === 1 ? E.cardsThisTurn(c, t) : 0).reduce((a, b) => a + b, 0);
      assert.equal(total, doubled.includes(round) ? 6 : 5, `${count}p round ${round}`);
    }
  }
});

for (const r of results) console.log(r.join(' · '));
process.exitCode = results.some(r => r[0] === 'FAIL') ? 1 : 0;

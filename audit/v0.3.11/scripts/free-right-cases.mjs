// Rare branches of v1.2.5 rule 6.5, checked on the v0.3.5 audit's P1 position.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {BUILDINGS} = await import(R + 'data.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {readSave} = await import(R + 'save.mjs');
const base = readSave(readFileSync(new URL('../positions/House_Right_No_Public_Pending.json', import.meta.url), 'utf8'));
const seat = base.actor, held = s => s.players[seat].held.map(id => BUILDINGS[id].name);
const why = s => s.log.findLast(e => e.actor === seat && e.explanation)?.explanation.filter(x => x.rule === '6.5').map(x => x.text);
const offer = E.marketOffer(base).map(o => `${BUILDINGS[o.id].name}${BUILDINGS[o.id].public ? ' (public)' : ''}`);
console.log('offer:', offer.join(', '), '· guilds:', base.players[seat].guilds.join(', '), '· held:', held(base).join(', '));

// 1. House reward, no public tile on offer: takes nothing (the v0.3.5 P1 case).
let n = playMincmistr(base);
assert.deepEqual(held(n), held(base));
console.log('house reward, no public →', held(n).join(', '), '|', why(n));

// 2. Same market as a St. Barbara tile 2 right: own-guild tile with the highest income value (Sawmill), never the Tavern.
const tile2 = structuredClone(base); tile2.pending[0] = {kind: 'right'};
n = playMincmistr(tile2);
assert.deepEqual(held(n), [...held(base), 'Sawmill']);
console.log('tile 2, no public →', held(n).join(', '), '|', why(n));

// 3. Tile 2 with three rights held: nothing, limit named.
const full = structuredClone(tile2); const p = full.players[seat];
const spare = Object.keys(BUILDINGS).filter(id => !BUILDINGS[id].public && !p.held.includes(id) && !E.marketOffer(full).some(o => o.id === id) && !full.city.some(c => c?.id === id));
full.market = full.market.map(row => row.map(st => ({...st, tiles: st.tiles.filter(id => !spare.slice(0, 2).includes(id))})).filter(st => st.tiles.length));
p.held = [...p.held, ...spare.slice(0, 2)];
assert.equal(p.held.length, 3);
n = playMincmistr(full);
assert.deepEqual(held(n), held(full));
console.log('tile 2, three rights →', why(n));


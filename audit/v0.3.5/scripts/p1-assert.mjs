// Finding P1: a house-row free right with no public tile on offer.
// node audit/v0.3.5/scripts/p1-assert.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {BUILDINGS} = await import(R + 'data.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {readSave} = await import(R + 'save.mjs');
const s = readSave(readFileSync(new URL('../positions/House_Right_No_Public_Pending.json', import.meta.url), 'utf8'));
const p = s.players[s.actor];
assert.deepEqual(s.pending[0], {kind: 'right', publicOnly: true});           // house-row reward (top row, third house)
const offer = E.marketOffer(s);
assert.equal(offer.filter(o => BUILDINGS[o.id].public).length, 0);         // no public tile on offer
assert.deepEqual(E.legalActions(s), [{kind: 'skip'}]);                      // base rules: nothing to take
const after = playMincmistr(s);
assert.deepEqual(after.players[s.actor].held, p.held);                      // app takes nothing (correct)
// Printed rule 6.5, last sentence, read literally:
const value = o => BUILDINGS[o.id].production * E.price(s, BUILDINGS[o.id].group);
const literal = [...offer].sort((a, b) => value(b) - value(a))[0];
const ownGuild = [...offer].filter(o => p.guilds.includes(BUILDINGS[o.id].group)).sort((a, b) => value(b) - value(a))[0];
console.log(`Printed 6.5 fallback picks ${BUILDINGS[literal.id].name} (${value(literal)}); own-guild reading picks ${BUILDINGS[ownGuild.id].name} (${value(ownGuild)}). App and base rules: no tile.`);

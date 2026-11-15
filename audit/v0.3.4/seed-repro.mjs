import assert from 'node:assert/strict';
import {createGame,createPlanDeck} from '../../src/engine.mjs';
import {checkGame,writeSave} from '../../src/save.mjs';
import {writeFileSync} from 'node:fs';
// Intended to reproduce the current defect; replace deepEqual with notDeepEqual after repair.
const seed='A'.repeat(53);
const game=createGame({seed,playerCount:4,starter:1,difficulty:'mincmistr',mincmistr:{level:'master',shared:false}});
checkGame(game);
assert.equal(game.mincmistr.decks.length,3);
assert.deepEqual(game.mincmistr.decks[0],game.mincmistr.decks[1]);
assert.deepEqual(game.mincmistr.decks[1],game.mincmistr.decks[2]);
assert.notDeepEqual(createPlanDeck('A'.repeat(52),1),createPlanDeck('A'.repeat(52),2));
writeFileSync(new URL('./positions/identical-individual-decks.json',import.meta.url),writeSave(game));
console.log(JSON.stringify({seedLength:seed.length,individualDecks:3,uniqueOrders:1,firstPlans:game.mincmistr.decks.map(d=>d.draw.slice(0,5).map(i=>i+1)),nearby52CharacterSeed:'distinct orders'}));

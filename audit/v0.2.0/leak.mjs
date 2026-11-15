// Mid-game information boundary: at every rival decision, scramble everything a player cannot see
// and check that the rival's choice is unchanged.
import {createGame,legalActions,transition,actionKey} from '../../src/engine.mjs';
import {botAction} from '../../src/bot.mjs';
import {MINES} from '../../src/data.mjs';

const games=Number(process.argv[2]??6);
let checked=0, differ=[];
const rot=a=>a.length>1?[...a.slice(1),a[0]]:a;
for (let g=0; g<games; g++) {
  let s=createGame({seed:`leak-${g}`,setup:1+g%9,starter:g%2});
  let steps=0;
  while (s.phase!=='end' && steps++<220) {
    const strategy=s.actor===1?'standard':'quick';
    const a=botAction(s,strategy);
    if (s.actor===1 && s.phase==='action' && legalActions(s).length>1) {
      const r=structuredClone(s);
      r.rng^=0x9e37; r.red=[...r.red].reverse();
      r.events=[...r.events.slice(0,r.round),...r.events.slice(r.round).reverse()];
      if (r.mineMixed) {
        // shuffle the union of unseen deck+discard while keeping the deck size
        const all=[...r.mineDeck,...r.mineDiscard]; const k=r.mineDeck.length;
        const rr=rot(all); r.mineDeck=rr.slice(0,k); r.mineDiscard=rr.slice(k);
      } else {
        r.mineDeck=[1,2,3].flatMap(t=>r.mineDeck.filter(id=>MINES[id].tier===t).reverse());
      }
      for (const row of r.market) for (const st of row) {
        const [top,...rest]=st.tiles; const marked=rest.at(-1);
        st.tiles=[top,...rest.slice(0,-1).reverse(),...(marked?[marked]:[])];
      }
      const b=botAction(r,strategy);
      checked++;
      if (actionKey(a)!==actionKey(b)) differ.push({seed:s.seed,round:s.round,turn:s.turn,a,b});
    }
    s=transition(s,a);
  }
}
console.log(JSON.stringify({checked,differ:differ.length,examples:differ.slice(0,3)},null,1));

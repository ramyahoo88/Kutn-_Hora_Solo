// Nearby cases for the Ius ruling: 6 left (one survives, no reshuffle), and a 2-tile draw from a 1-tile stack.
import {createGame,legalActions,transition} from '../../src/engine.mjs';
const run=(remaining,tech)=>{
  let g=createGame({seed:'ius-nearby'}); g.events=['code','fever','rush','michal','king']; g.tax=0; g.technology=tech;
  const deck=g.mineDeck, split=deck.length-remaining; g.mineDeck=deck.slice(split); g.mineDiscard=deck.slice(0,split);
  for (let i=0;i<10;i++) g=transition(g,legalActions(g).find(a=>a.kind==='skip'));
  const left=[...g.mineDeck];
  const n=transition(g,legalActions(g).find(a=>a.kind==='mine'&&a.refill===0&&!a.as));
  console.log(`remaining ${remaining}, draw ${tech+1}: after Ius deck=${left.length}`,
    `| drawn=${JSON.stringify(n.pending[0].drawn)} first=${n.pending[0].drawn[0]===left[0]} reshuffled=${n.mineMixed} deck now=${n.mineDeck.length} discard=${n.mineDiscard.length}`);
};
run(6,0); run(6,1); run(5,0);

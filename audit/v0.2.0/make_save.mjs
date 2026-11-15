// Importable save: your 2nd Innkeepers (row 3) building is one click away.
import {writeFileSync} from 'node:fs';
import {createGame,legalActions,transition} from '../../src/engine.mjs';
import {readSave,writeSave} from '../../src/save.mjs';

const s=createGame({seed:'audit-house-row-3',setup:1,side:0}); // You: Metallurgists, Miners, Innkeepers (row 3)
const take=id=>{for (const row of s.market) for (const st of row) st.tiles=st.tiles.filter(t=>t!==id);
  for (const row of s.market) for (let i=row.length-1;i>=0;i--) if (!row[i].tiles.length) row.splice(i,1);};
// Earlier Innkeepers build already in town (first row-3 house gone, +1 reputation taken).
take('bathhouse'); s.city[15]={id:'bathhouse',owner:0};
s.players[0].houses=[0,0,1]; s.players[0].rep=1; s.players[0].production.beer=2; s.arms.beer=1; s.pop=1; s.barbara=2;
// Next Innkeepers right and a plot beside it.
take('tavern'); s.players[0].held=['tavern']; s.city[14]={plot:0}; s.players[0].coins=30;
s.log.push({round:1,actor:null,text:'Audit position: build Tavern at C3 with Building/Income to take the 2nd Innkeepers house.'});
const text=writeSave(s);
const loaded=readSave(text);
const a=legalActions(loaded).find(x=>x.kind==='build'&&x.id==='tavern'&&x.space===14&&x.card===2);
const after=transition(loaded,a);
console.log('save valid; build cost',a.cost,'| reputation',loaded.players[0].rep,'->',after.players[0].rep,'(printed board: 1 -> 4)');
writeFileSync('Kutna_Audit_HouseRow3.json',text);

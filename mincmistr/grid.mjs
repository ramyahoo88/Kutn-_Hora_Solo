// Grid search over a few rule parameters (lab automa). node grid.mjs <part> <parts> <games> <groups,comma> <out>
import {readFileSync,appendFileSync} from 'node:fs';
import {evaluate} from './sim.mjs';
import {DEFAULT} from './automa.mjs';
const base=JSON.parse(readFileSync(new URL('./base.json',import.meta.url)));
const [part,parts,games,groups,out]=[Number(process.argv[2]),Number(process.argv[3]),Number(process.argv[4]),process.argv[5].split(','),process.argv[6]];
const grid=[];
for (const brokeAt of [15,20,25]) for (const rightsLimit of ['simple','three']) for (const minePlace of ['spread','contest']) grid.push({brokeAt,incomeCap:brokeAt,rightsLimit,minePlace});
grid.forEach((over,i)=>{
  if (i%parts!==part) return;
  const cfg={...DEFAULT,...base,...over};
  const ms=[]; let w=0;
  for (const group of groups) { const {out:o}=evaluate({games,group,config:cfg,quiet:true}); ms.push(o.margin); w+=o.wins; }
  appendFileSync(out,JSON.stringify({over,avg:+(ms.reduce((a,b)=>a+b)/ms.length).toFixed(2),ms,w})+'\n');
});

// node vs.mjs '<variants json: name -> overrides merged onto base.json>' games groups...
import {readFileSync} from 'node:fs';
import {evaluate} from './sim.mjs';
import {DEFAULT} from './automa.mjs';
const base=JSON.parse(readFileSync(new URL('./base.json',import.meta.url)));
const variants=JSON.parse(process.argv[2]);
const games=Number(process.argv[3]??24);
const groups=process.argv.slice(4).length?process.argv.slice(4):['pl','co'];
const rows=[];
for (const [name,over] of Object.entries(variants)) {
  const cfg={...DEFAULT,...base,...over,patrician:{...base.patrician,...(over.patrician??{})}};
  const ms=[]; let w=0, g=0, vp=0;
  for (const group of groups) { const {out:o}=evaluate({games,group,config:cfg,quiet:true}); ms.push(o.margin); w+=o.wins; g+=o.games; vp+=o.vp; }
  const avg=ms.reduce((a,b)=>a+b,0)/ms.length;
  console.log(name.padEnd(14),'avg',avg.toFixed(2).padStart(7),'|',ms.map(m=>m.toFixed(2).padStart(7)).join(' '),'| wins',w,'| vp',(vp/groups.length).toFixed(1));
}

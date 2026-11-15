// Summarise final evaluation JSONL files: node summarize.mjs file1 [file2 ...]
import {readFileSync} from 'node:fs';
const lines=process.argv.slice(2).flatMap(f=>readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)));
const groups=new Map();
for (const {level,opponent,group,rows} of lines) {
  const key=`${level}|${opponent}`;
  if (!groups.has(key)) groups.set(key,{level,opponent,rows:[],groups:[]});
  const g=groups.get(key); g.rows.push(...rows); g.groups.push(group);
}
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const se=xs=>{const m=mean(xs); return Math.sqrt(xs.reduce((t,x)=>t+(x-m)**2,0)/(xs.length-1)/xs.length);};
const out=[];
for (const g of groups.values()) {
  const r=g.rows, margins=r.map(x=>x.margin);
  const first=r.filter(x=>x.starter), second=r.filter(x=>!x.starter);
  const rules={}; for (const x of r) for (const [k,v] of Object.entries(x.rules)) rules[k]=(rules[k]??0)+v;
  const cards=r.reduce((t,x)=>t+x.cards,0);
  const parts=k=>+mean(r.map(x=>x.parts[k])).toFixed(1), opp=k=>+mean(r.map(x=>x.oppParts[k])).toFixed(1);
  out.push({level:g.level,opponent:g.opponent,games:r.length,margin:+mean(margins).toFixed(2),se:+se(margins).toFixed(2),
    winPct:+(100*mean(r.map(x=>x.win))).toFixed(1),drawPct:+(100*mean(r.map(x=>x.draw))).toFixed(1),
    vp:+mean(r.map(x=>x.vp)).toFixed(1),oppVP:+mean(r.map(x=>x.opp)).toFixed(1),
    marginFirst:+mean(first.map(x=>x.margin)).toFixed(2),marginSecond:+mean(second.map(x=>x.margin)).toFixed(2),
    checksPerCard:+(r.reduce((t,x)=>t+x.checks,0)/cards).toFixed(2),cardsPerGame:+(cards/r.length).toFixed(1),
    rulesPct:Object.fromEntries(Object.entries(rules).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(100*v/cards).toFixed(1)])),
    parts:Object.fromEntries(['earned','town','mines','income','reputation','extras'].map(k=>[k,[parts(k),opp(k)]])),
    groups:g.groups.join(',')});
}
const order=['apprentice','journeyman','master','grandmaster'];
out.sort((a,b)=>order.indexOf(a.level)-order.indexOf(b.level)||a.opponent.localeCompare(b.opponent));
if (process.env.JSON) console.log(JSON.stringify(out,null,1));
else for (const o of out) console.log(`${o.level.padEnd(12)} ${o.opponent.padEnd(9)} n=${o.games} margin ${String(o.margin).padStart(6)} ±${o.se} win ${o.winPct}% vp ${o.vp} vs ${o.oppVP} | 1st ${o.marginFirst} 2nd ${o.marginSecond} | checks/card ${o.checksPerCard}`);

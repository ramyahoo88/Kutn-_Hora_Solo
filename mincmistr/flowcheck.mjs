// Check the paper priority flow independently of the automa's tallies.
import {createGame,transition,legalActions,canBuildGuild,plotCount} from '../src/engine.mjs';
import {BUILDINGS,CARDS} from '../src/data.mjs';
import {botAction} from '../src/bot.mjs';
import {createMincmistr,mincmistrAction} from './mincmistr.mjs';

const PRINTED_ROW=[0,5,1,2,4,3];
const PRIZE_TILES=[6,7,8,9,11];

function qualifies(state,id) {
  const tile=BUILDINGS[id],p=state.players[state.actor];
  if (!tile||tile.public) return false;
  const row=p.guilds.indexOf(tile.group);
  return row>=0&&p.houses[row]<4&&canBuildGuild(state,tile.group);
}

function expectedPlay(state,plan) {
  const p=state.players[state.actor];
  const choices=legalActions(state);
  function allowed(kind,eligible=()=>true) {
    const card=PRINTED_ROW.find(c=>(p.hand&(1<<c))&&CARDS[c].includes(kind));
    return choices.find(a=>a.kind===kind&&a.card===card&&!a.as&&eligible(a));
  }
  function construct() {
    const plots=plotCount(state,state.actor);
    const build=p.held.length&&plots?allowed('build'):null;
    if (build) return build;
    const plot=p.held.length>plots&&plots<3?allowed('plot'):null;
    if (plot) return plot;
    if (p.held.length>=2) return null;
    return allowed('rights',a=>qualifies(state,a.id));
  }
  const income=allowed('income'),barbara=allowed('barbara'),mine=allowed('mine');
  if (p.coins<20&&income) return {check:'cash',move:income};
  if (barbara&&(p.pelicans>=2||p.pelicans===1&&PRIZE_TILES.includes(state.barbara))) {
    return {check:'pelicans',move:barbara};
  }
  for (const goal of plan.goals) {
    const move=goal==='C'?construct():goal==='M'?mine:barbara;
    if (move) return {check:`goal:${goal}`,move};
  }
  if (income) return {check:'fallback:I',move:income};
  if (mine) return {check:'fallback:M',move:mine};
  return {check:'discard',move:{kind:'skip',card:PRINTED_ROW.find(c=>p.hand&(1<<c))}};
}

let plays=0,bad=0;
const examples=[];
for (let i=0;i<20;i++) for (const seat of [0,1]) {
  let state=createGame({seed:`fc-${i}`,setup:1+i%9,side:i%2,starter:(i>>1)%2});
  const memory=createMincmistr(state,seat,'journeyman');
  while (state.phase!=='end') {
    const isPlan=state.actor===seat&&state.phase==='action'&&!state.pending.length;
    const before=isPlan?{...memory.stats.rules}:null;
    const action=state.actor===seat?mincmistrAction(state,memory):botAction(state,'quick');
    if (isPlan) {
      plays++;
      const actual=Object.keys(memory.stats.rules).filter(key=>memory.stats.rules[key]!==(before[key]??0));
      const {check,move}=expectedPlay(state,memory.card);
      const badRight=action.kind==='rights'&&!qualifies(state,action.id);
      if (actual.length!==1||actual[0]!==check||action.kind!==move.kind||action.card!==move.card||action.as||badRight) {
        bad++;
        if (examples.length<5) examples.push({seed:state.seed,round:state.round,turn:state.turn,
          plan:memory.card.number,expected:{check,kind:move.kind,card:move.card},actual,action});
      }
    }
    state=transition(state,action);
  }
}
console.log('card plays',plays,'flow mismatches',bad);
for (const example of examples) console.log(JSON.stringify(example));
if (bad) process.exitCode=1;

import {createPlanDeck,drawPlan,validPlanDeck} from './engine.mjs';
import {describePlan,PLAN_DECK} from './mincmistr.mjs';

const STORAGE='kutna-hora-mincmistr-deck-v1';
const byId=id=>document.getElementById(id);

export function setPlanFace(face,plan) {
  const index=plan.number-1;
  face.style.backgroundPosition=`${index%3*50}% ${Math.floor(index/3)*25}%`;
  face.setAttribute('aria-label',`${describePlan(plan)}. Take Income with fewer than 20 groschen. Take St. Barbara with two pelicans or one on a prize tile.`);
}

function freshDeck() {
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  return createPlanDeck(`paper-${seed.toString(36)}`,1);
}

export function startPaperDrawer() {
  const face=byId('paper-face');
  const status=byId('paper-status');
  const warning=byId('paper-warning');
  const undo=byId('paper-undo');
  const confirm=byId('paper-confirm');
  let deck;
  let previous=null;

  try {
    const raw=localStorage.getItem(STORAGE);
    if (raw!==null) {
      const saved=JSON.parse(raw);
      if (!validPlanDeck(saved?.deck) || (saved.previous!==null && !validPlanDeck(saved.previous))) {
        throw Error('Invalid saved Plan deck.');
      }
      ({deck,previous}=saved);
    }
  } catch {
    warning.textContent='The saved deck could not be opened. A new deck is ready.';
  }
  deck ??= freshDeck();

  function render() {
    const plan=PLAN_DECK[deck.discard.at(-1)];
    const count=deck.draw.length;
    status.textContent=`${plan?`Plan ${plan.number} · `:''}${count} ${count===1?'card':'cards'} left${count?'':' · Draw to reshuffle'}`;
    face.hidden=!plan;
    byId('paper-instruction').hidden=!!plan;
    if (plan) setPlanFace(face,plan);
    undo.disabled=previous===null;
    warning.hidden=!warning.textContent;
  }

  function update(next,undoDeck) {
    deck=next;
    previous=undoDeck;
    try {
      localStorage.setItem(STORAGE,JSON.stringify({deck,previous}));
      warning.textContent='';
    } catch {
      warning.textContent='Deck progress is available until this page closes or reloads.';
    }
    render();
  }

  byId('paper-draw').addEventListener('click',()=>{
    const next={rng:{...deck.rng},draw:[...deck.draw],discard:[...deck.discard]};
    drawPlan(next);
    update(next,deck);
  });
  undo.addEventListener('click',()=>{ if (previous) update(previous,null); });
  byId('paper-new').addEventListener('click',()=>confirm.showModal());
  byId('paper-cancel').addEventListener('click',()=>confirm.close());
  byId('paper-reset').addEventListener('click',()=>{
    confirm.close();
    update(freshDeck(),null);
  });
  render();
}

// Independent Mincmistr v1.2.5 decision oracle, written from the printed rules
// (rules 2, 4, 5, 6, 7, 9). It uses the engine only for the list of legal
// actions and for printed data (buildings, mines, prices, board geometry).
// It does not import src/mincmistr.mjs.
const R = new URL('../../../src/', import.meta.url).href;
const {BUILDINGS, CARDS, MINES, PATRICIANS, GAME_RULES} = await import(R + 'data.mjs');
const E = await import(R + 'engine.mjs');

// Rule 2: Mine/Joker, Rights/St. Barbara, Mine/Plot, Build/Income, Rights/Income, Build/Plot.
const PRINTED_ROW = [['mine','joker'],['rights','barbara'],['mine','plot'],['build','income'],['rights','income'],['build','plot']];
const ROW = PRINTED_ROW.map(pair => CARDS.findIndex(c => c[0] === pair[0] && c[1] === pair[1]));
const PRIZE = [6, 7, 8, 9, 11];

const board = s => GAME_RULES[s.players.length].board;
function townPointsAt(s, space, id) {
  // Rule 6.2/6.3: matching dots with neighbouring buildings and the board edge.
  const {edge, neighbours} = board(s);
  const dots = BUILDINGS[id].dots;
  const match = other => [...other].filter(d => dots.includes(d)).length;
  let pts = match(edge[space] ?? '');
  for (const n of neighbours[space]) if (s.city[n]?.id) pts += match(BUILDINGS[s.city[n].id].dots);
  return pts;
}
function award(stars, total, me, n) {
  // Rule 6.4 and the mine aid table.
  const table = n === 2 ? (total <= 3 ? [2,0] : total <= 6 ? [4,1] : [6,2])
                        : (total <= 5 ? [2,1,0] : total <= 9 ? [3,2,1] : [5,3,2]);
  if (stars[me] === 0) return 0;
  const ahead = stars.filter(x => x > stars[me]).length;
  return table[ahead] ?? 0;
}
function rowInfo(s, row) {
  const w = board(s).mineWidth;
  const stars = s.players.map(() => 0), count = s.players.map(() => 0);
  let total = 0;
  for (let c = 0; c < w; c++) {
    const cell = s.mine[row * w + c];
    if (!cell) continue;
    total += cell.stars;
    if (!cell.rock) { stars[cell.owner] += cell.stars; count[cell.owner]++; }
  }
  return {stars, count, total};
}
function councilPoints(s, seat) {
  // Rule 6.6 table.
  const {neighbours} = board(s);
  let green = 0;
  s.city.forEach((cell, i) => {
    if (cell?.id && cell.owner === seat) green += neighbours[i].filter(n => s.city[n]?.id && BUILDINGS[s.city[n].id].public).length;
  });
  const p = s.players[seat];
  let weakest = Infinity;
  for (let r = 0; r < 4; r++) weakest = Math.min(weakest, rowInfo(s, r).count[seat]);
  return {green, silver: 3 * Math.floor(p.usedPelicans / 2), yellow: 2 * Math.min(2, weakest), red: 3 * Math.min(...p.houses)};
}
function edge(s, seat, color) {
  const own = councilPoints(s, seat)[color];
  let best = -Infinity;
  for (let k = 0; k < s.players.length; k++) if (k !== seat) best = Math.max(best, councilPoints(s, k)[color]);
  return own - best;
}
const arrowKey = (plan, space) => plan.arrow === 'low' ? space : -space;

export function oracle(s, seat, plan, level) {
  const p = s.players[seat];
  const points = level !== 'apprentice';
  const legal = E.legalActions(s);
  if (s.phase === 'tax') return legal.find(a => a.kind === 'tax') ?? legal.find(a => a.kind === 'penalty');

  // Choices (rule 6).
  const incomeChoice = xs => {
    const seats = xs.filter(a => a.color && edge(s, seat, a.color) >= 1)
      .sort((a, b) => edge(s, seat, b.color) - edge(s, seat, a.color) || PATRICIANS.indexOf(a.color) - PATRICIANS.indexOf(b.color));
    return seats[0] ?? xs.find(a => !a.color);
  };
  const plotChoice = xs => {
    const v = a => points ? Math.max(0, ...p.held.map(id => townPointsAt(s, a.space, id))) : 0;
    return [...xs].sort((a, b) => v(b) - v(a) || a.cost - b.cost || arrowKey(plan, a.space) - arrowKey(plan, b.space))[0];
  };
  const buildChoice = xs => {
    const prod = a => BUILDINGS[a.id].public ? 0 : BUILDINGS[a.id].production;
    const v = a => points ? townPointsAt(s, a.space, a.id) : 0;
    return [...xs].sort((a, b) => prod(b) - prod(a) || v(b) - v(a) || arrowKey(plan, a.space) - arrowKey(plan, b.space) || p.held.indexOf(a.id) - p.held.indexOf(b.id))[0];
  };
  const rightsChoice = xs => {
    const offers = E.marketOffer(s);
    const where = id => offers.find(o => o.id === id);
    const ok = xs.filter(a => {
      const t = BUILDINGS[a.id];
      const row = p.guilds.indexOf(t.group);
      return !t.public && row >= 0 && p.houses[row] < 4 && E.canBuildGuild(s, t.group);
    });
    const val = a => BUILDINGS[a.id].production * E.price(s, BUILDINGS[a.id].group);
    return ok.sort((a, b) => val(b) - val(a) || a.cost - b.cost || where(a.id).row - where(b.id).row || where(a.id).col - where(b.id).col)[0] ?? null;
  };
  const placeChoice = xs => {
    const placed = xs.filter(a => a.kind === 'place-mine' || a.kind === 'technology');
    if (!placed.length) return xs.find(a => a.kind === 'skip');
    const drawn = [...new Set(placed.map(a => a.id))];
    const order = s.pending[0].drawn ?? drawn;
    const sum = id => MINES[id].stars + MINES[id].ore + MINES[id].vp;
    const keep = [...drawn].sort((a, b) => sum(b) - sum(a) || MINES[b].stars - MINES[a].stars || order.indexOf(a) - order.indexOf(b))[0];
    const w = board(s).mineWidth;
    const info = a => rowInfo(s, Math.floor(a.space / w));
    const gain = a => {
      const r = info(a), after = [...r.stars];
      after[seat] += MINES[keep].stars;
      return award(after, r.total + MINES[keep].stars, seat, s.players.length) - award(r.stars, r.total, seat, s.players.length);
    };
    const mines = a => info(a).count[seat];
    const opts = placed.filter(a => a.id === keep);
    if (!points) return opts.sort((a, b) => mines(a) - mines(b) || a.cost - b.cost || arrowKey(plan, a.space) - arrowKey(plan, b.space))[0];
    return opts.sort((a, b) => gain(b) - gain(a) || a.cost - b.cost || mines(a) - mines(b) || arrowKey(plan, a.space) - arrowKey(plan, b.space))[0];
  };

  // Bonus steps (rule 6.5).
  if (s.pending.length) {
    const item = s.pending[0];
    const skip = legal.find(a => a.kind === 'skip');
    const of = k => legal.filter(a => a.kind === k);
    switch (item.kind) {
      case 'mine-place': case 'technology': return placeChoice(legal);
      case 'right': {
        const xs = of('rights');
        if (!xs.length) return skip;
        // v1.2.5 rule 6.5: eligible public by printed rewards; tile 2 falls back to its own guilds by income value;
        // a house reward takes public only; ties by market reading order; else nothing.
        const offers = E.marketOffer(s);
        const where = id => offers.find(o => o.id === id);
        const reading = (x, y) => where(x.id).row - where(y.id).row || where(x.id).col - where(y.id).col;
        const pub = xs.filter(a => BUILDINGS[a.id].public);
        const pv = a => { const t = BUILDINGS[a.id]; return t.vp + 2 * t.pelicans + 2 * t.rep; };
        if (pub.length) return pub.sort((a, b) => pv(b) - pv(a) || reading(a, b))[0];
        if (item.publicOnly) return skip;
        const own = xs.filter(a => p.guilds.includes(BUILDINGS[a.id].group));
        const val = a => BUILDINGS[a.id].production * E.price(s, BUILDINGS[a.id].group);
        return own.sort((a, b) => val(b) - val(a) || reading(a, b))[0] ?? skip;
      }
      case 'house': {
        const xs = of('house');
        if (!xs.length) return skip;
        const row = a => p.guilds.indexOf(a.id);
        return xs.sort((a, b) => p.houses[row(b)] - p.houses[row(a)] || row(a) - row(b))[0];
      }
      case 'patrician': {
        const xs = of('patrician');
        if (!xs.length) return skip;
        return xs.sort((a, b) => edge(s, seat, b.color) - edge(s, seat, a.color) || PATRICIANS.indexOf(a.color) - PATRICIANS.indexOf(b.color))[0];
      }
      case 'score-building': {
        const xs = of('score-building');
        if (!xs.length) return skip;
        const v = a => townPointsAt(s, a.space, s.city[a.space].id);
        return xs.sort((a, b) => v(b) - v(a) || arrowKey(plan, a.space) - arrowKey(plan, b.space))[0];
      }
      case 'plot': { const xs = of('plot'); return xs.length ? plotChoice(xs) : skip; }
      case 'build': { const xs = of('build'); return xs.length ? buildChoice(xs) : skip; }
      case 'income': { const xs = of('income'); return xs.length ? incomeChoice(xs) : skip; }
      case 'mine': { const xs = of('mine'); return xs.length ? xs[0] : skip; }
    }
    throw Error('oracle: unknown pending ' + item.kind);
  }

  // Card play (rule 4).
  const inHand = c => (p.hand & (1 << c)) !== 0;
  const cardFor = kind => ROW.find(c => inHand(c) && CARDS[c].includes(kind)) ?? null;
  const with_ = kind => { const c = cardFor(kind); return c === null ? [] : legal.filter(a => a.card === c && a.kind === kind && !a.as); };
  const doIncome = () => { const xs = with_('income'); return xs.length ? incomeChoice(xs) : null; };
  const doMine = () => {
    const xs = with_('mine');
    if (!xs.length) return null;
    return xs.find(a => a.refill === 0) ?? [...xs].sort((a, b) => b.refill - a.refill)[0];
  };
  const doBarbara = () => with_('barbara')[0] ?? null;
  const plots = s.city.filter(c => c?.plot === seat).length;
  const doConstruct = () => {
    if (p.held.length >= 1 && plots >= 1) { const xs = with_('build'); if (xs.length) return buildChoice(xs); }
    if (p.held.length > plots && plots < 3) { const xs = with_('plot'); if (xs.length) return plotChoice(xs); }
    if (p.held.length < 2) { const xs = with_('rights'); if (xs.length) { const a = rightsChoice(xs); if (a) return a; } }
    return null;
  };
  if (p.coins < 20) { const a = doIncome(); if (a) return {a, rule: '4.1'}; }
  const tile = Math.min(s.barbara, 12);
  if (p.pelicans >= 2 || (p.pelicans >= 1 && PRIZE.includes(tile))) { const a = doBarbara(); if (a) return {a, rule: '4.2'}; }
  for (const g of plan.goals) {
    const a = g === 'C' ? doConstruct() : g === 'M' ? doMine() : doBarbara();
    if (a) return {a, rule: '4.3' + g};
  }
  const i = doIncome(); if (i) return {a: i, rule: '4.4I'};
  const m = doMine(); if (m) return {a: m, rule: '4.4M'};
  const left = ROW.find(inHand);
  return {a: legal.find(a => a.kind === 'skip' && a.card === left), rule: '4.4X'};
}

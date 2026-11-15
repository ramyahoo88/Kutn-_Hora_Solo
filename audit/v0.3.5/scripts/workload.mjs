// Tabletop workload per paper Mincmistr, measured on the printed procedure.
// node workload.mjs <seeds> <prefix>
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const D = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr, PLAN_DECK} = await import(R + 'mincmistr.mjs');
const [seeds, prefix] = [Number(process.argv[2]), process.argv[3]];
const out = {};
for (const count of [2, 3, 4]) for (const level of ['journeyman', 'master']) {
  const w = {mincmistrGames: 0, plays: 0, bonus: 0, taxes: 0, minePlacements: 0, rowsCompared: 0, plotDecisions: 0, plotCandidates: 0, plotPairs: 0,
    buildDecisions: 0, buildCandidates: 0, arrowDecided: 0, arrowDecisions: 0, incomeColourChecks: 0, flipsByCheck: {}};
  for (let i = 0; i < seeds; i++) {
    let s = E.createGame({seed: `${prefix}-${count}-${i}`, playerCount: count, setup: 1 + i % 9, starter: i % count, difficulty: 'mincmistr', mincmistr: {level}});
    w.mincmistrGames += count - 1;
    while (s.phase !== 'end') {
      if (s.actor === 0) { s = E.transition(s, botAction(s, 'standard')); continue; }
      const before = s, seat = s.actor;
      const legal = E.legalActions(s);
      s = playMincmistr(s);
      if (before.phase === 'tax') { w.taxes++; continue; }
      if (before.pending.length) w.bonus++; else w.plays++;
      // What did it do? Infer from the changed state.
      const item = before.pending[0];
      const after = s;
      const plan = PLAN_DECK[after.mincmistr.lastPlans[seat - 1]];
      const placeOpts = legal.filter(a => a.kind === 'place-mine' || a.kind === 'technology');
      if (placeOpts.length) {
        w.minePlacements++;
        const width = E.rulesFor(before).board.mineWidth;
        w.rowsCompared += new Set(placeOpts.map(a => Math.floor(a.space / width))).size;
      }
      const placedPlot = after.city.findIndex((c, k) => c?.plot === seat && !before.city[k]);
      if (placedPlot >= 0) {
        const plots = legal.filter(a => a.kind === 'plot' && !a.as);
        const cands = new Set(plots.map(a => a.space)).size;
        w.plotDecisions++; w.plotCandidates += cands; w.plotPairs += cands * Math.max(1, before.players[seat].held.length);
      }
      const built = after.city.findIndex((c, k) => c?.id && !before.city[k]?.id);
      if (built >= 0) {
        const builds = legal.filter(a => a.kind === 'build' && !a.as);
        w.buildDecisions++; w.buildCandidates += builds.length;
        // Arrow decisive? Same right, equal town points elsewhere.
        const id = after.city[built].id;
        const pts = sp => E.cityPointsAt({...before, city: before.city.map((c, k) => k === sp ? {id, owner: seat} : c)}, sp);
        const best = pts(built);
        const ties = builds.filter(a => a.id === id && pts(a.space) === best).length;
        w.arrowDecisions++; if (ties > 1) w.arrowDecided++;
      }
      if (legal.some(a => a.kind === 'income' && a.color) && after.log.slice(before.log.length).some(e => e.text.startsWith('Collected'))) {
        w.incomeColourChecks += new Set(legal.filter(a => a.kind === 'income' && a.color).map(a => a.color)).size;
      }
    }
  }
  const per = x => +(x / w.mincmistrGames).toFixed(1);
  out[`${count}p ${level}`] = {perMincmistr: {cardPlays: per(w.plays), bonusSteps: per(w.bonus), taxDecisions: per(w.taxes), minePlacements: per(w.minePlacements),
    rowsComparedPerPlacement: +(w.rowsCompared / w.minePlacements).toFixed(2), plots: per(w.plotDecisions), plotSpacesPerPlot: +(w.plotCandidates / w.plotDecisions).toFixed(1),
    plotRightPairsPerPlot: +(w.plotPairs / w.plotDecisions).toFixed(1), builds: per(w.buildDecisions), buildOptionsPerBuild: +(w.buildCandidates / w.buildDecisions).toFixed(1),
    arrowDecidedBuildShare: +(w.arrowDecided / w.arrowDecisions).toFixed(2), councilColoursChecked: per(w.incomeColourChecks)}};
}
console.log(JSON.stringify(out, null, 1));

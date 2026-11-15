import test from 'node:test';
import assert from 'node:assert/strict';
import {MINCMISTR_RULES_VERSION,VERSION} from '../src/data.mjs';
import {createGame,legalActions,transition} from '../src/engine.mjs';
import {readAutosave,readPosition,readSave,writeAutosave,writePlaytestReport,writeSave} from '../src/save.mjs';

test('autosave keeps five validated positions and imports as an ordinary save',()=>{
  let state=createGame({seed:'autosave-history'});
  const positions=[];
  for (let i=0; i<8; i++) {
    positions.push({state,rivalReport:[],review:null});
    state=transition(state,legalActions(state).find(action=>action.kind==='skip'));
  }
  const current=positions.at(-1);
  const raw=writeAutosave(current,positions.slice(0,-1));
  assert.deepEqual(readAutosave(raw),{current,undo:positions.slice(-6,-1)});
  assert.deepEqual(readSave(raw),current.state);
  assert.deepEqual(readAutosave(writeSave(current.state)),{current,undo:[]});

  const damaged=JSON.parse(raw);
  damaged.undo[2].state=null;
  const recovered=readAutosave(JSON.stringify(damaged));
  assert.deepEqual(recovered.current,current);
  assert.deepEqual(recovered.undo,positions.slice(-3,-1));
});

test('a bad earlier position does not erase the current position or report note',()=>{
  const before=createGame({seed:'report-replay'});
  const state=transition(before,legalActions(before).find(action=>action.kind==='skip'));
  const report=JSON.parse(writePlaytestReport({state,rivalReport:[],review:null},{state:before},'Report note'));
  assert.deepEqual(readPosition(JSON.stringify(report)).importedReport.before.state,before);
  for (const invalidBefore of [null,createGame({seed:'different-game'})]) {
    report.playtest.before.state=invalidBefore;
    const loaded=readPosition(JSON.stringify(report));
    assert.deepEqual(loaded.state,state);
    assert.equal(loaded.playtestNote,'Report note');
    assert.equal(loaded.importedReport.before,undefined);
  }
});

test('report exports keep the original app and rules versions across autosaves',()=>{
  const state=createGame({seed:'old-report',difficulty:'mincmistr'});
  const report=JSON.parse(writePlaytestReport({state,rivalReport:[],review:null}));
  const oldVersions={appVersion:'0.3.5',mincmistrRulesVersion:'1.2.2'};
  Object.assign(report.playtest,oldVersions);
  report.playtest.source={appVersion:7,mincmistrRulesVersion:'invalid version'.repeat(3)};
  const {current}=readAutosave(writeAutosave(readPosition(JSON.stringify(report)),[]));
  assert.deepEqual(current.importedReport,oldVersions);
  const {playtest}=JSON.parse(writePlaytestReport(current));
  assert.equal(playtest.appVersion,VERSION);
  assert.equal(playtest.mincmistrRulesVersion,MINCMISTR_RULES_VERSION);
  assert.deepEqual(playtest.source,oldVersions);
});

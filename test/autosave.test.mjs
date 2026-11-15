import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,legalActions,transition} from '../src/engine.mjs';
import {readAutosave,readSave,writeAutosave,writeSave} from '../src/save.mjs';

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

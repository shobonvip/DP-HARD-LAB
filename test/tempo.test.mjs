import test from 'node:test';import assert from 'node:assert/strict';
import {chartTempo} from '../src/tempo.mjs';
test('per-chart tempos override song BPM and repeated tempo markers are constant',()=>{
 assert.deepEqual(chartTempo({bpm:'194',tempos:[{bpm:194},{bpm:194},{bpm:97},{bpm:194}]}),{min:97,max:194,variable:true,bpm:'97～194'});
 assert.equal(chartTempo({tempos:[{bpm:194},{bpm:194}]}).variable,false);
 assert.equal(chartTempo({}),null);
});

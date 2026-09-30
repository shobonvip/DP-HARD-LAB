import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from '../src/storage.mjs';import {displayResult} from '../src/payload.mjs';
test('display result preserves simulations, finger examples and recommendation values',async()=>{
 const raw=JSON.parse(await readFile(new URL('../data/results/logic-A.json',import.meta.url),'utf8')),view=displayResult(raw);
 assert.equal(view.requiredCapacity,raw.requiredCapacity);assert.deepEqual(view.metrics,raw.metrics);assert.deepEqual(view.selected.timing,raw.selected.timing);
 assert.equal(view.selected.traces.length,Math.min(4,raw.selected.traces.length));assert.deepEqual(view.human.actions,raw.human.actions.slice(0,5));
 for(let i=0;i<view.free.strategies.length;i++){assert.equal(view.free.strategies[i].required,raw.free.strategies[i].required);assert.deepEqual(view.free.strategies[i].simulation.interval,raw.free.strategies[i].simulation.interval);}
 assert.ok(JSON.stringify(view).length<JSON.stringify(raw).length);assert.equal(raw.human.actions.length>=view.human.actions.length,true);
});

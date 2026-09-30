import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeChart,analyzeRandomStrategies} from '../src/engine.mjs';
test('reusing extracted RANDOM layouts produces exactly the same policy results',()=>{
 const chart={id:'cache-equivalence',warnings:[],duration:4,holds:[],events:Array.from({length:40},(_,i)=>({time:i*.1,hand:i%2,lane:i%8,kind:'tap'}))};
 const result=analyzeChart(chart);
 const reused=analyzeRandomStrategies(chart,result),recomputed=analyzeRandomStrategies(chart,JSON.parse(JSON.stringify(result)));
 assert.deepEqual(reused,recomputed);
});

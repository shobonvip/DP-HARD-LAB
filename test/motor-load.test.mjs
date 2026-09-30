import test from 'node:test';
import assert from 'node:assert/strict';
import {humanFeatures} from '../src/human.mjs';
const chart=groups=>({events:groups.flatMap((keys,i)=>keys.map(lane=>({time:1+i*.1,hand:1,lane,kind:'tap'}))),holds:[]});
test('overlap relief preserves jack work and cannot erase the physical load',()=>{
 const c=chart(Array.from({length:18},()=>[1,4]));
 const old=humanFeatures(c,{motorOverlapRelief:0,placementWeight:0});
 const next=humanFeatures(c,{motorOverlapRelief:.65,placementWeight:0});
 assert.equal(old.metrics.jackLoad,next.metrics.jackLoad);
 assert.equal(old.metrics.pressWork,next.metrics.pressWork);
 assert.ok(next.metrics.physical<old.metrics.physical);
 assert.ok(next.actions.every(a=>a.physical>0));
});
test('changing mixed chords requires more preparation than a familiar repeated chord',()=>{
 const repeated=humanFeatures(chart([[1,4,7],[1,4,7],[1,4,7],[1,4,7]]));
 const changing=humanFeatures(chart([[1,4,7],[2,3,6],[1,5,7],[2,4,6]]));
 assert.ok(changing.metrics.placementTransitionLoad>repeated.metrics.placementTransitionLoad);
});
test('calibration event deltas reproduce the full feature demand',()=>{
 const c=chart([[1,4],[2,3,6],[1,5],[2,4,7],[1,5],[2,4,7]]);
 const base=humanFeatures(c,{motorOverlapRelief:0,placementWeight:0});
 const next=humanFeatures(c,{motorOverlapRelief:.35,placementWeight:2});
 base.actions.forEach((a,i)=>assert.ok(Math.abs(next.actions[i].demand-(a.demand-.35*a.motorOverlapLoad+2*a.placementTransitionLoad))<1e-9));
});

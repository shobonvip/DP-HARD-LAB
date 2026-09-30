import test from 'node:test';import assert from 'node:assert/strict';
import {humanFeatures} from '../src/human.mjs';
const chart=(times,lane=0)=>({bpm:150,events:times.map(time=>({time,hand:1,lane,kind:'tap'})),holds:[]});
test('sustained scratch work accumulates and a pause lets it recover',()=>{
 const times=Array.from({length:240},(_,i)=>i*.1),c=chart([...times,40]);
 const f=humanFeatures(c,{scratchEnduranceWeight:1});
 assert.ok(f.actions[220].scratchEnduranceLoad>f.actions[30].scratchEnduranceLoad);
 assert.ok(f.actions.at(-1).scratchEnduranceLoad<f.actions[220].scratchEnduranceLoad);
 const intermittent=humanFeatures(chart(times.map((t,i)=>t+Math.floor(i/20)*5)));
 assert.ok(intermittent.metrics.scratchEnduranceLoad<f.metrics.scratchEnduranceLoad);
});
test('scratch protection never discounts keyboard-only patterns or changes jack work',()=>{
 const c=chart(Array.from({length:50},(_,i)=>i*.1),3);
 const a=humanFeatures(c,{scratchOverlapProtection:0,scratchEnduranceWeight:0}),b=humanFeatures(c,{scratchOverlapProtection:1,scratchEnduranceWeight:1});
 assert.equal(b.metrics.scratchOverlapLoad,0);assert.equal(b.metrics.scratchEnduranceLoad,0);
 assert.equal(a.metrics.physical,b.metrics.physical);assert.equal(a.metrics.jackLoad,b.metrics.jackLoad);
});
test('scratch protection and endurance deltas match full extraction',()=>{
 const c=chart(Array.from({length:100},(_,i)=>i*.08));
 const base=humanFeatures(c,{scratchOverlapProtection:0,scratchEnduranceWeight:0});
 const next=humanFeatures(c,{scratchOverlapProtection:.5,scratchEnduranceWeight:1});
 base.actions.forEach((a,i)=>assert.ok(Math.abs(next.actions[i].demand-a.demand-.65*.5*a.scratchOverlapLoad-a.scratchEnduranceLoad)<1e-9));
 assert.ok(next.metrics.physical>base.metrics.physical);
 assert.equal(next.metrics.scratchStroke,base.metrics.scratchStroke);
});

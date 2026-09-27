import test from 'node:test';import assert from 'node:assert/strict';
import {humanFeatures,keyPosition,movementTime} from '../src/human.mjs';
const chart=groups=>({events:groups.flatMap(([time,lanes])=>lanes.map(lane=>({time,lane,hand:1,kind:'tap'}))),holds:[]});
test('geometry includes front-back row offset and increased distance requires more movement time',()=>{assert.notEqual(keyPosition(2)[1],keyPosition(1)[1]);assert.ok(movementTime(5)>movementTime(1));});
test('same chord repeated is recognized in chunks',()=>{const a=humanFeatures(chart([[0,[1,2,4]],[.2,[1,2,4]],[.4,[1,2,4]]])),b=humanFeatures(chart([[0,[1,2,4]],[.2,[3,5,7]],[.4,[2,4,6]]]));assert.ok(a.metrics.recognition<b.metrics.recognition);assert.equal(a.actions[2].pattern,'同形反復');});
test('same finger movement is harder when less time is available',()=>{const fast=humanFeatures(chart([[0,[2]],[.03,[3]]]),{technique:'home'}),slow=humanFeatures(chart([[0,[2]],[.4,[3]]]),{technique:'home'});assert.ok(fast.actions[1].movement>slow.actions[1].movement);});
test('scratch landing accounts for actual distance',()=>{const near=humanFeatures(chart([[0,[0]],[.1,[7]]])),far=humanFeatures(chart([[0,[0]],[.1,[1]]]));assert.ok(far.actions[1].scratchDistance>near.actions[1].scratchDistance);assert.ok(far.actions[1].demand>near.actions[1].demand);});
test('all-key press remains coordinated rather than seven finger conflicts',()=>{const r=humanFeatures(chart([[0,[1,2,3,4,5,6,7]]]));assert.equal(r.actions[0].palm,true);assert.ok(r.actions[0].movement<1);});
test('hand geometry is configurable and invalid dimensions are rejected',()=>{const wide=humanFeatures(chart([[0,[1,7]]]),{human:{handSpan:6}}),small=humanFeatures(chart([[0,[1,7]]]),{human:{handSpan:3}});assert.ok(small.actions[0].reach>wide.actions[0].reach);assert.throws(()=>humanFeatures(chart([[0,[1]]]),{human:{handSpan:0}}));});

test('continuous scratches alternate push/pull without repeated keyboard travel',()=>{
 const r=humanFeatures(chart([[0,[0]],[.15,[0]],[.3,[0]],[.45,[0]]]));
 assert.deepEqual(r.actions.map(a=>a.scratchDirection),['押し','引き','押し','引き']);
 assert.ok(r.actions[0].scratchDistance>0);
 for(const a of r.actions.slice(1)){assert.equal(a.scratchDistance,0);assert.equal(a.scratchLanding,0);assert.equal(a.scratchMode,'連皿');}
});
test('faster reversals add turntable load even when travel is zero',()=>{
 const fast=humanFeatures(chart([[0,[0]],[.04,[0]]])).actions[1],slow=humanFeatures(chart([[0,[0]],[.15,[0]]])).actions[1];
 assert.equal(fast.scratchDistance,0);assert.ok(fast.scratchReversal>slow.scratchReversal);assert.ok(fast.scratchCost>slow.scratchCost);
});
test('scratch arrival responds to key distance and available movement time',()=>{
 const near=humanFeatures(chart([[0,[7]],[.08,[0]]])).actions[1],far=humanFeatures(chart([[0,[1]],[.08,[0]]])).actions[1],slow=humanFeatures(chart([[0,[1]],[.5,[0]]])).actions[1];
 assert.ok(far.scratchDistance>near.scratchDistance);assert.ok(far.scratchLanding>slow.scratchLanding);
});
test('simultaneous scratch reserves a separate finger and keeps other fingers on keys',()=>{
 const r=humanFeatures(chart([[0,[0,1]],[.1,[1]]]),{technique:'home'});
 assert.ok(!Object.values(r.actions[0].assignment).includes(r.actions[0].scratchFinger));
 assert.equal(r.actions[0].scratchConflict,0);assert.equal(r.actions[1].travel,0);assert.equal(r.actions[1].scratchDistance,0);
 const seven=humanFeatures(chart([[0,[0,7]]]));assert.equal(seven.actions[0].scratchFinger,3);assert.equal(seven.actions[0].scratchConflict,0);
});
test('split-hand reach is harder with distant keys and a smaller span',()=>{
 const near=humanFeatures(chart([[0,[0,7]]])).actions[0],far=humanFeatures(chart([[0,[0,1]]])).actions[0],small=humanFeatures(chart([[0,[0,1]]]),{human:{handSpan:3}}).actions[0];
 assert.ok(far.scratchSplit>near.scratchSplit);assert.ok(small.scratchSplit>far.scratchSplit);
});
test('keyboard reuse of scratch finger breaks contact; another finger can retain it',()=>{
 const kept=humanFeatures(chart([[0,[0]],[.1,[5]],[.2,[0]]]),{technique:'home'}),released=humanFeatures(chart([[0,[0]],[.1,[7]],[.2,[0]]]),{technique:'home'});
 assert.equal(kept.actions[2].scratchDistance,0);assert.equal(kept.actions[2].scratchDirection,'引き');
 assert.ok(released.actions[2].scratchDistance>0);assert.equal(released.actions[2].scratchDirection,'押し');
});
test('long scratch holds reserve contact and end with a reversal without invented strokes',()=>{
 const c=chart([[0,[0]],[1,[1]],[2,[0]]]);c.events[0].kind='head';c.events[2].kind='tail';c.holds=[{hand:1,lane:0,start:0,end:2}];
 const r=humanFeatures(c);assert.equal(r.actions.length,3);assert.equal(r.actions[1].scratchDirection,null);assert.equal(r.actions[1].scratchMode,'皿＋鍵盤');assert.equal(r.actions[2].scratchDirection,'引き');assert.equal(r.actions[2].scratchDistance,0);
});

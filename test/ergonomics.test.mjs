import test from 'node:test';import assert from 'node:assert/strict';
import {humanFeatures} from '../src/human.mjs';
import {parameters,keyPosition,keyTarget,ergonomicCost,FINGER_CHOICES} from '../src/ergonomics.mjs';
import {simulationProfile} from '../src/profile.mjs';
const chart=groups=>({events:groups.flatMap(([time,lanes])=>lanes.map(lane=>({time,lane,hand:1,kind:'tap'}))),holds:[]});
test('API settings retain zero proficiency and reject invalid dimensions and numbers',()=>{
 const {profile}=simulationProfile(new URLSearchParams('homeSkill=0&handSpan=170&scratchY=-40'));
 assert.equal(profile.human.homeSkill,0);assert.equal(profile.human.handSpan,170);
 for(const query of ['homeSkill=2','handSpan=6','scratchTorque=NaN','option=1.5','keyForce=','scratchAngle=Infinity'])assert.throws(()=>simulationProfile(new URLSearchParams(query)));
});
test('geometry uses mm and a button contact area rather than mandatory centre hits',()=>{
 const p=parameters();assert.equal(keyPosition(3,p)[0],41.4);assert.equal(keyPosition(2,p)[1],-55.7);
 const target=keyTarget(3,keyPosition(2,p),p);assert.ok(target[1]<0);assert.ok(target[0]<41.4);
 assert.throws(()=>parameters({homeSkill:1.1}));assert.doesNotThrow(()=>parameters({homeSkill:0}));
});
test('home familiarity reduces recognition without erasing physical work',()=>{
 const c=chart([[0,[1,2,4,6,7]],[.15,[1,3,4,5,7]]]);
 const familiar=humanFeatures(c,{human:{homeSkill:1}}),newcomer=humanFeatures(c,{human:{homeSkill:0}});
 assert.ok(familiar.metrics.recognition<newcomer.metrics.recognition);assert.equal(familiar.metrics.pressWork,newcomer.metrics.pressWork);
});
test('technical assignments depend on learning; 6-little is a candidate',()=>{
 const state={lastTime:-1},p=parameters();
 assert.equal(ergonomicCost([5,6],{5:3,6:3},state,0,p).extension,0);
 const novice=ergonomicCost([5,6],{5:0,6:4},state,0,p),expert=ergonomicCost([5,6],{5:0,6:4},state,0,parameters({extensionSkill:1}));
 assert.ok(novice.extension>expert.extension);assert.ok(FINGER_CHOICES[5].includes(4));
});
test('home familiarity does not discount scratch-only recognition',()=>{
 const c=chart([[0,[0]],[.1,[0]],[.2,[0]]]);
 assert.equal(humanFeatures(c,{human:{homeSkill:0}}).metrics.recognition,humanFeatures(c,{human:{homeSkill:1}}).metrics.recognition);
});
test('stairs are not automatically discounted and proficiency lowers their recognition cost',()=>{
 const c=chart([[0,[1]],[.1,[2]],[.2,[3]],[.3,[4]],[.4,[5]]]);
 const low=humanFeatures(c,{human:{stairSkill:0}}),high=humanFeatures(c,{human:{stairSkill:1}});
 assert.equal(low.actions[2].pattern,'階段');assert.ok(low.metrics.recognition>high.metrics.recognition);assert.equal(low.metrics.movementDistance,high.metrics.movementDistance);
});
test('keima familiarity affects cognition while reach and keyboard work persist',()=>{
 const c=chart([[0,[2,5]],[.12,[3,6]],[.24,[2,5]]]);
 const low=humanFeatures(c,{human:{keimaSkill:0}}),high=humanFeatures(c,{human:{keimaSkill:1}});
 assert.ok(low.metrics.keimaLoad>high.metrics.keimaLoad);assert.equal(low.metrics.pressWork,high.metrics.pressWork);assert.equal(low.metrics.reach,high.metrics.reach);
});
test('repeated single keys and trills are not classified as stairs',()=>{
 for(const lanes of [[2,2,2,2],[2,4,2,4]]){
  const c=chart(lanes.map((lane,i)=>[i*.1,[lane]]));
  const low=humanFeatures(c,{human:{stairSkill:0}}),high=humanFeatures(c,{human:{stairSkill:1}});
  assert.equal(low.metrics.stairLoad,0);assert.equal(low.metrics.recognition,high.metrics.recognition);
  assert.ok(low.actions.every(a=>a.pattern!=='階段'));
 }
});
test('scratch strokes have arc travel but no fictitious keyboard return, and respond to resistance',()=>{
 const c=chart([[0,[0]],[.08,[0]],[.16,[0]]]);
 const a=humanFeatures(c),b=humanFeatures(c,{human:{scratchTorque:.08}}),wide=humanFeatures(c,{human:{scratchAngle:15}});
 assert.equal(a.actions[1].scratchDistance,0);assert.ok(Math.abs(a.actions[1].scratchStroke-110*Math.PI/24)<1e-9);
 assert.ok(b.actions[1].scratchForce>a.actions[1].scratchForce);assert.ok(b.actions[1].scratchCost>a.actions[1].scratchCost);
 assert.ok(wide.metrics.scratchStroke>a.metrics.scratchStroke);
});
test('push and pull strength are independent, with explicit component sums',()=>{
 const c=chart([[0,[0]],[.08,[0]],[.16,[0]]]),a=humanFeatures(c),b=humanFeatures(c,{human:{scratchPullForce:1}});
 assert.equal(a.actions[0].scratchCost,b.actions[0].scratchCost);assert.ok(b.actions[1].scratchCost>a.actions[1].scratchCost);
 for(const action of b.actions)assert.ok(Math.abs(action.demand-action.physical-action.cognitive)<1e-10);
});

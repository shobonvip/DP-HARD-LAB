import test from 'node:test';import assert from 'node:assert/strict';
import {humanFeatures} from '../src/human.mjs';
import {extract,simulate} from '../src/engine.mjs';
import {judgeInputs,planAnmitsu,timingParameters} from '../src/timing.mjs';
const chart=(lanes,step=.1)=>({events:lanes.map((lane,i)=>({time:1+i*step,lane,hand:1,kind:'tap'})),holds:[],duration:1+lanes.length*step});
test('visible same-colour flows are easier to recognise than mixed-colour stairs',()=>{
 const white=humanFeatures(chart([1,3,5,7])),mixed=humanFeatures(chart([1,2,3,4]));
 assert.ok(white.metrics.colorFlow>mixed.metrics.colorFlow);assert.ok(white.metrics.recognition<mixed.metrics.recognition);
 assert.ok(white.metrics.pressWork>0);assert.ok(white.metrics.movementDistance>0);
});
test('lookahead is bounded by readAhead, and colour relief never applies to jacks',()=>{
 const c=chart([1,3,5,7],.2),short=humanFeatures(c,{human:{readAhead:.1}}),long=humanFeatures(c,{human:{readAhead:.65}});
 assert.equal(short.actions[0].colorFlow,0);assert.equal(long.actions[0].colorFlow,1);assert.equal(short.actions[0].visibleNotes,0);
 const jack=humanFeatures(chart([3,3,3,3,3,3])),rolling=humanFeatures(chart([1,3,5,7,5,3]));
 assert.equal(jack.metrics.colorFlow,0);assert.equal(jack.metrics.phraseReuse,0);assert.ok(jack.metrics.jackLoad>rolling.metrics.jackLoad);assert.ok(jack.metrics.physical>rolling.metrics.physical);
});
test('a regular repeated phrase is found without naming any song',()=>{
 const f=humanFeatures(chart([1,3,5,6,4,2,1,3,5,6,4,2],.08));assert.ok(f.metrics.phraseReuse>0);
 const irregular=chart([1,3,5,6,4,2,1,3,5,6,4,2],.08);irregular.events[8].time+=.025;
 assert.ok(humanFeatures(irregular).metrics.phraseReuse<f.metrics.phraseReuse);
});
test('holding a CN does not invent repeated presses on the holding finger',()=>{
 const c=chart([1,3,5,7,3,5,7],.1);c.events[0].kind='head';c.holds=[{hand:1,lane:1,start:1,end:2}];
 const f=humanFeatures(c);assert.equal(f.actions.at(-1).fingerRate,2);
});
test('timing windows tolerate early and late inputs and distinguish BAD from timeout',()=>{
 const notes=chart([1,2,3,4,5],1).events;
 const inputs=notes.slice(0,4).map((e,i)=>({...e,time:e.time+[-.09,.09,.15,-.15][i]}));
 assert.deepEqual(judgeInputs(notes,inputs).map(e=>e.judgement),['GOOD','GOOD','BAD','BAD','POOR']);
 assert.throws(()=>timingParameters({goodMs:150,badMs:140}));
});
test('one input consumes only one note; stealing future notes produces a BAD chain',()=>{
 const notes=chart(Array(9).fill(1),.18).events;
 const inputs=notes.map(e=>({...e,time:e.time-.13}));
 const bad=judgeInputs(notes,inputs);assert.equal(bad.filter(e=>e.judgement==='BAD').length,9);
 const extra=[{...notes[0],time:notes[0].time-.13},...notes.map(e=>({...e}))];
 const stolen=judgeInputs(notes,extra);
 assert.ok(stolen.filter(e=>e.judgement==='BAD').length>=3);
 assert.equal(stolen.filter(e=>e.noteIndex!=null).length,notes.length);
 assert.equal(new Set(stolen.filter(e=>e.noteIndex!=null).map(e=>e.noteIndex)).size,notes.length);
});
test('same-lane good timing takes priority over an older BAD candidate in the experimental policy',()=>{
 const notes=chart([1,1],.15).events;
 const judged=judgeInputs(notes,[{time:1.15,hand:1,lane:1}]);
 assert.equal(judged[0].noteIndex,1);assert.equal(judged[0].judgement,'PGREAT');assert.equal(judged[1].judgement,'POOR');
});
test('CN release and key press judge separate event types and missed heads suppress release',()=>{
 const notes=[{time:1,hand:1,lane:1,kind:'head'},{time:2,hand:1,lane:1,kind:'tail'},{time:2.1,hand:1,lane:1,kind:'tap'}];
 const judged=judgeInputs(notes,[{time:1,hand:1,lane:1,kind:'head'},{time:2,hand:1,lane:1,kind:'tap'},{time:2.05,hand:1,lane:1,kind:'tail'}]);
 assert.deepEqual(judged.map(e=>e.noteIndex),[0,2,1]);assert.equal(judged[2].judgement,'PGREAT');
 const missed=judgeInputs(notes,[{time:2,hand:1,lane:1,kind:'tail',source:1}]);assert.deepEqual(missed.map(e=>e.noteIndex),[0,2]);
});
test('BAD boundary is inclusive and the next instant expires as POOR',()=>{
 const notes=chart([1]).events;
 assert.equal(judgeInputs(notes,[{time:1.2,hand:1,lane:1}])[0].judgement,'BAD');
 assert.equal(judgeInputs(notes,[{time:1.2001,hand:1,lane:1}])[0].judgement,'POOR');
});
test('anmitsu preserves notes, coalesces feasible distinct keys and excludes scratches and jacks',()=>{
 const profile={timing:{anmitsuMs:100}},c=chart([1,3,5,7],.08),plan=planAnmitsu(c,profile);
 assert.equal(plan.groupedNotes,4);assert.equal(plan.chart.events.length,c.events.length);assert.equal(plan.chart.events[0].time,plan.chart.events[1].time);
 const judged=judgeInputs(c.events,plan.chart.events);assert.ok(judged.every(e=>e.judgement==='GOOD'||e.judgement==='GREAT'||e.judgement==='PGREAT'));
 for(const lanes of [[1,1],[0,1],[2,3]])assert.equal(planAnmitsu(chart(lanes,.08),profile).groupedNotes,0);
 const held=chart([1,3],.08);held.holds=[{hand:1,lane:7,start:.5,end:2}];assert.equal(planAnmitsu(held,profile).groupedNotes,0);
 const f=extract(c,undefined,profile);assert.equal(f.metrics.anmitsuGroupedNotes,4);assert.equal(f.events[0].time,1);assert.notEqual(f.events[0].plannedTime,1);
});
test('timing bias is retained over a jack stream and changes failure even at high motor ability',()=>{
 const f=extract(chart(Array(80).fill(1),.18));
 const good=simulate(f,{capacity:32,trials:8,profile:{timing:{jitterMs:0,biasMs:0}}});
 const bad=simulate(f,{capacity:32,trials:8,profile:{timing:{jitterMs:0,biasMs:-130}}});
 assert.equal(good.clearRate,1);assert.equal(bad.clearRate,0);assert.ok(bad.timing.maxBadChain>=3);assert.ok(bad.timing.badChainsPerTrial>0);
 assert.deepEqual(bad,simulate(f,{capacity:32,trials:8,profile:{timing:{jitterMs:0,biasMs:-130}}}));
});
test('capacity-search fast path changes no outcomes or random draws',()=>{
 const f=extract(chart(Array.from({length:80},(_,i)=>i%5===0?0:i%7+1),.06));
 for(const features of [f,{pool:[f,extract(chart(Array(50).fill(1),.15))]}])for(const capacity of [1,4,9])for(const seed of [1,52]){
  const options={capacity,seed,trials:16,profile:{timing:{biasMs:-25,anmitsuMs:0}}};
  assert.equal(simulate(features,options).clearRate,simulate(features,{...options,summary:false}).clearRate);
 }
});
test('fast continuous scratches do not inherit the keyboard release/repress cooldown',()=>{
 const f=extract(chart(Array(100).fill(0),.055));
 const s=simulate(f,{capacity:32,trials:8,profile:{timing:{jitterMs:0}}});
 assert.equal(s.clearRate,1);assert.equal(s.timing.judgements.BAD,0);assert.equal(s.timing.meanOffsetMs,0);
});
test('late scratch strategy separates key and scratch actions but retains the original deadline',()=>{
 const c={events:[{time:1,hand:1,lane:0,kind:'tap'},{time:1,hand:1,lane:7,kind:'tap'}],holds:[],duration:2};
 const standard=extract(c),delayed=extract(c,undefined,{timing:{scratchDelayMs:60}});
 assert.equal(standard.humanActions.length,1);assert.equal(delayed.humanActions.length,2);
 assert.equal(delayed.events.find(e=>e.lane===0).time,1);assert.equal(delayed.events.find(e=>e.lane===0).plannedTime,1.06);
 const inputs=delayed.events.map(e=>({...e,time:e.plannedTime}));assert.equal(judgeInputs(c.events,inputs).find(e=>e.lane===8).judgement,'GOOD');
 const tooLate=planAnmitsu(c,{timing:{scratchDelayMs:160}});assert.equal(judgeInputs(c.events,tooLate.chart.events).find(e=>e.lane===8).judgement,'BAD');
 assert.equal(planAnmitsu(chart([0,0],.1),{timing:{scratchDelayMs:60}}).chart.events[0].time,1);
});

test('left scratch reach uses thumb/index for 1/2/3, marks 4 marginal and rejects 5/6/7',()=>{
 for(const hand of [0,1])for(let leftLane=1;leftLane<=7;leftLane++){
  const lane=hand===0?leftLane:8-leftLane,c={events:[{time:1,hand,lane:0,kind:'tap'},{time:1,hand,lane,kind:'tap'}],holds:[],duration:2};
  const a=humanFeatures(c).actions[0];assert.equal(a.scratchUnreachable,leftLane>=5);assert.equal(a.scratchBorderline,leftLane===4);
  if(leftLane<=4)assert.ok([0,1].includes(a.assignment[8-leftLane]));
  const f=extract(c);assert.equal(f.metrics.shiftedScratches,leftLane>=5?1:0);
  if(leftLane>=5){const key=f.events.find(e=>e.lane>0),scratch=f.events.find(e=>e.lane===0);assert.ok(key.plannedTime<key.time);assert.ok(scratch.plannedTime>scratch.time);assert.equal(scratch.scratchUnreachable,false);assert.equal(f.humanActions.length,2);}
 }
});

test('far scratch shifting spends the original timing budget and cannot pass through a hold',()=>{
 const c={events:[{time:1,hand:0,lane:0,kind:'tap'},{time:1,hand:0,lane:7,kind:'tap'}],holds:[],duration:2};
 const auto=planAnmitsu(c),late=planAnmitsu(c,{timing:{scratchDelayMs:160}});
 assert.ok(judgeInputs(c.events,auto.chart.events).every(e=>e.judgement==='GOOD'));
 assert.equal(judgeInputs(c.events,late.chart.events).find(e=>e.lane===0).judgement,'BAD');
 c.holds=[{hand:0,lane:7,start:.5,end:2}];const blocked=extract(c);assert.equal(blocked.metrics.shiftedScratches,0);assert.equal(blocked.events.find(e=>e.lane===0).scratchUnreachable,true);
 const s=simulate(blocked,{capacity:32,trials:1,profile:{timing:{jitterMs:0}}});assert.ok(s.timing.judgements.POOR>=1);
});

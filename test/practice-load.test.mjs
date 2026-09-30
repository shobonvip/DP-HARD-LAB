import test from 'node:test';import assert from 'node:assert/strict';
import {keyboardLoad} from '../src/practice-load.mjs';
const actions=(times,physical=4,movement=1)=>times.map(time=>({time,hand:1,keys:[3],physical,cognitive:2,movement,recognition:1,placementExtra:.3,extension:.2}));
test('same note counts can produce different physical and technical recommendations',()=>{
 const times=Array.from({length:60},(_,i)=>i/3),chart={duration:20};
 const base=keyboardLoad(chart,actions(times)),physical=keyboardLoad(chart,actions(times,8)),technical=keyboardLoad(chart,actions(times,4,3));
 assert.ok(physical.staminaScore>base.staminaScore);assert.ok(technical.techniqueScore>base.techniqueScore);
 assert.equal(technical.staminaScore,base.staminaScore);
});
test('silence is represented and breaks sustained runs',()=>{
 const continuous=Array.from({length:60},(_,i)=>i/3),broken=continuous.map(t=>t>=10?t+8:t),chart={duration:28};
 const a=keyboardLoad(chart,actions(continuous)),b=keyboardLoad(chart,actions(broken));
 assert.ok(a.longestSeconds>b.longestSeconds);assert.ok(b.timeline.some(b=>b[1]===0&&b[2]===0));
 const empty=keyboardLoad(chart,[]);assert.equal(empty.staminaScore,0);assert.equal(empty.restSeconds,28);
});

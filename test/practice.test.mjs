import test from 'node:test';import assert from 'node:assert/strict';
import {practiceFeatures,independentWindows} from '../src/practice.mjs';
const a=(keys,time,hand=1)=>({keys,time,hand,measure:Math.floor(time)+1,scratch:false,assignment:{},demand:1});
const features=actions=>practiceFeatures({duration:30,holds:[]},actions);
test('adjacent stairs separate short, long and same-color runs',()=>{
 assert.equal(features([1,2,3,4,5,6,7].map((k,i)=>a([k],i*.2))).largeStair.count,1);
 assert.equal(features([1,2,3,4,5,6,7].map((k,i)=>a([k],i*.2))).smallStair.count,0);
 assert.equal(features([1,3,5,7].map((k,i)=>a([k],i*.2))).colorStair.count,1);
 assert.equal(features([1,3,5,7].map((k,i)=>a([k],i*.2))).smallStair.count,0);
});
test('prescribed finger candidates respect constraints and report physical left lanes',()=>{
 const f=features([a([2,3],0,0),a([1,2,3],1),a([3,5],2),a([5,6],3),a([4,5,6],4)]);
 assert.equal(f.thumb3.count,1);assert.deepEqual(f.thumb3.examples[0].keys,[5,6]);
 assert.equal(f.thumb5.count,1);assert.equal(f.middle56.count,1);
 const held=practiceFeatures({duration:10,holds:[{hand:1,lane:1,start:0,end:3}]},[a([2,3],1)]);
 assert.equal(held.thumb3.count,0);
});
test('rests and simultaneous chords break stair chains',()=>{
 assert.equal(features([a([1],0),a([2],.2),a([3],2)]).smallStair.count,0);
 assert.equal(features([a([1],0),a([2,4],.2),a([3],.4)]).smallStair.count,0);
});
test('independence detects parallel rhythms but rejects unison and simple alternation',()=>{
 const stream=(hand,step,offset=0)=>Array.from({length:Math.floor(4/step)},(_,i)=>({...a([1+i%7],i*step+offset,hand),measure:2+Math.floor(i*step/2)}));
 assert.equal(independentWindows([...stream(0,.5),...stream(1,.5)]).length,0);
 assert.equal(independentWindows([...stream(0,.5),...stream(1,.5,.25)]).length,0);
 assert.equal(independentWindows([...stream(0,.5),...stream(1,.25)]).length,1);
 assert.equal(independentWindows(stream(0,.25)).length,0);
 const alternatingTurns=[...stream(0,.25).filter(a=>a.time<2),...stream(1,.25).filter(a=>a.time>=2)];
 assert.equal(independentWindows(alternatingTurns).length,0);
});

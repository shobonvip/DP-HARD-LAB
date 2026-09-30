import test from 'node:test';
import assert from 'node:assert/strict';
import {extract,requiredCapacity,simulate} from '../src/engine.mjs';
test('bounded count stopping preserves the exhaustive threshold for fixed and RANDOM pools',()=>{
 const make=hand=>extract({id:'synthetic',events:Array.from({length:100},(_,i)=>({time:i*.08,hand,lane:i%7+1,kind:'tap'})),holds:[],duration:8});
 const a=make(0),b=make(1);
 for(const features of [a,{pool:[a,b]}])for(const target of [.05,.8]){
  const trials=24,seed=761,profile={timing:{biasMs:35}};let lo=.25,hi=32;
  for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(simulate(features,{capacity:mid,trials,seed,profile,summary:false}).clearRate>=target)hi=mid;else lo=mid;}
  const actual=requiredCapacity(features,{target,trials,seed,profile});assert.equal(actual.value,hi);
  assert.equal(actual.censored,simulate(features,{capacity:hi,trials,seed,profile,summary:false}).clearRate<target);
 }
});

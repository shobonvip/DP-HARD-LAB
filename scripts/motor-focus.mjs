import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {extract,fixedOptions,requiredCapacity,hash} from '../src/engine.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const ids=['logic-A','gobblecp-H','dxy-A','comaaaaa-X','titans-X','_syaku_2-A','_kakugos-A','_dadada-A'];
const rows=[];
for(const id of ids){
 const [chart,result,h5]=await Promise.all([read(`data/charts/${id}.json`),read(`data/results/${id}.json`),read(`data/staging/h5-v60/${id}.json`)]);
 const random=h5.recommendation.includes('RANDOM'),flip=h5.recommendation.includes('FLIP');
 const options=random?result.random.draws.map(d=>d.option).filter(o=>!!o.flip===flip):fixedOptions().filter(o=>o.name===h5.recommendation);
 const seed=hash(id)+(random?501:0),trials=random?256:128,profile={...result.profile,motorOverlapRelief:0,placementWeight:0};
 const raw=options.map(o=>extract(chart,o,profile)),values={};
 for(const [label,relief,placement] of [['baseline',0,0],['reliefOnly',.65,0],['placementOnly',0,2],['combined',.65,2]]){
  const fs=raw.map(f=>{const actions=new Map(f.humanActions.map(a=>[a.time.toFixed(6)+':'+a.hand,a]));return {...f,events:f.events.map(e=>{const a=actions.get(e.plannedTime.toFixed(6)+':'+e.hand),side=e.hand?profile.right:profile.left;return {...e,demand:e.demand+(-relief*a.motorOverlapLoad+placement*a.placementTransitionLoad)/side};})};});
  values[label]=requiredCapacity(random?{pool:fs}:fs[0],{target:.05,trials,seed,profile}).value;
 }
 if(values.combined!==h5.requiredCapacity)throw Error('Counterfactual does not reproduce final H5 '+id);
 const actions=raw.flatMap(f=>f.humanActions),avg=k=>actions.reduce((s,a)=>s+a[k],0)/actions.length;
 rows.push({id,recommendation:h5.recommendation,values,meanOverlap:avg('motorOverlapLoad'),meanTransition:avg('placementTransitionLoad'),interpretation:'New recommended strategy held fixed. Baseline includes CN fix. Not the old-version best strategy. RANDOM averages 8 finite layouts.'});
 console.log(id,JSON.stringify(values));
}
await writeFile('data/motor-focus.json',JSON.stringify(rows,null,2));

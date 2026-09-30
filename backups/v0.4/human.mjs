// Distances in mm; right-hand coordinates mirrored for the left hand.
import {scratchPlan} from './scratch.mjs';
import {HUMAN_DEFAULTS,HOME_KEYS,HOME_FINGERS,FINGER_CHOICES,parameters,keyPosition,keyTarget,distance,movementTime,ergonomicCost,recognitionCost} from './ergonomics.mjs';
export {HUMAN_DEFAULTS,keyPosition,movementTime};
const home=HOME_KEYS,choices=FINGER_CHOICES,cache=new Map();
function assignments(keys,technique){const key=keys.join(',')+technique;if(cache.has(key))return cache.get(key);const out=[];
 function walk(i,a,used,cost){if(i===keys.length){out.push({a,cost});return;}const lane=keys[i];for(const f of technique==='home'?[([0,0,1,1,2,3,3,4])[lane]]:choices[lane-1])walk(i+1,{...a,[lane]:f},[...used,f],cost+(used.includes(f)?3:0)+Math.abs(home[f]-lane)*.07);}
 walk(0,{},[],0);out.sort((a,b)=>a.cost-b.cost);const kept=out.slice(0,12);cache.set(key,kept);return kept;
}
const signature=keys=>keys.join(',');
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
export function humanFeatures(chart,profile={}){
 const p=parameters(profile.human);
 const states=[0,1].map(()=>({positions:home.map(l=>keyPosition(l,p)),times:Array(5).fill(-10),lastTime:-10,lastKeys:[],priorKeys:[],lastInterval:0,history:[],familiar:new Map(),fatigue:Array(5).fill(0),scratch:false,scratchContact:null,handMode:'keys'}));
 const groups=[];for(const e of chart.events){let g=groups.at(-1);if(!g||Math.abs(g.time-e.time)>1e-6){g={time:e.time,events:[]};groups.push(g);}g.events.push(e);}
 const actions=[],lookup=new Map();
 for(let index=0;index<groups.length;index++){
  const group=groups[index],sideKeys=[0,1].map(hand=>[...new Set(group.events.filter(e=>e.hand===hand&&e.lane>0&&e.kind!=='tail').map(e=>hand===0?8-e.lane:e.lane))].sort((a,b)=>a-b));
  for(let hand=0;hand<2;hand++){
   const es=group.events.filter(e=>e.hand===hand);if(!es.length)continue;
   const state=states[hand],keys=sideKeys[hand],scratch=es.some(e=>e.lane===0),dt=group.time-state.lastTime;
   const held=(chart.holds||[]).filter(h=>h.hand===hand&&h.start<group.time-1e-6&&h.end>group.time+1e-6),heldKeys=held.filter(h=>h.lane).map(h=>hand===0?8-h.lane:h.lane);
   const scratchHeld=held.some(h=>h.lane===0),scratchActive=scratch||scratchHeld;
   const occupied=[...new Set([...keys,...heldKeys])].sort((a,b)=>a-b),palm=keys.length===7&&!scratchActive&&!held.length;
   let best={a:{},cost:0,travel:0,strain:0,reach:0,required:0,lookahead:0},bestScore=Infinity;
   for(const c of palm?[{a:{},cost:.25}]:assignments(occupied,profile.technique)){
    let travel=0,strain=0,reach=0,required=0,locked=0;const targets={};
    for(const lane of heldKeys){const prior=state.assignment?.[lane];if(prior!==undefined&&prior!==c.a[lane])locked+=4;}
    for(const lane of keys){const f=c.a[lane];if(f===undefined)continue;
     const target=keyTarget(lane,state.positions[f],p),d=distance(state.positions[f],target),available=Math.max(.015,group.time-state.times[f]),need=Math.max(p.fingerRecovery,movementTime(d,p))*(f>=3?1.13:1);targets[lane]=target;
     // Returning the scratch finger with the whole hand is charged once by
     // scratchPlan's landing term, not again as an independent finger move.
     const sharedReturn=state.handMode==='scratch'&&!scratchActive&&state.scratchContact?.finger===f;
     if(!sharedReturn){travel+=d;strain+=Math.max(0,need/available-1);}
     required=Math.max(required,need);reach+=distance(keyPosition(home[f],p),target)/p.handSpan;
    }
    // Bounded one-action preview; no knowledge beyond the visible read-ahead.
    let lookahead=0,next;
    for(let j=index+1;j<Math.min(groups.length,index+8);j++){if(groups[j].time-group.time>p.readAhead)break;const ns=groups[j].events.filter(e=>e.hand===hand&&e.lane>0);if(ns.length){next=ns;break;}}
    if(next){for(const e of next){const lane=hand===0?8-e.lane:e.lane;lookahead+=Math.min(...(profile.technique==='home'?[HOME_FINGERS[lane]]:choices[lane-1]).map(f=>{const current=keys.find(k=>c.a[k]===f);return distance(current?targets[current]:state.positions[f],keyPosition(lane,p));}));}lookahead/=next.length*p.keyPitch;}
    const span=keys.length?distance(keyPosition(keys[0],p),keyPosition(keys.at(-1),p)):0;reach+=Math.max(0,span/p.handSpan-1)*2;
    const sp=scratchPlan({state,keys,occupied,assignment:c.a,time:group.time,stroke:scratch,held:scratchHeld,tail:es.some(e=>e.lane===0&&e.kind==='tail'),p,position:keyPosition,moveTime:movementTime});
    const bio=palm?{extension:0,crossing:0,coupling:0,ergonomic:.15,pressWork:keys.length*p.keyForce*p.keyStroke}:ergonomicCost(keys,c.a,state,group.time,p);
    const score=c.cost+locked+strain+reach*.3+lookahead*.12+sp.cost+bio.extension+bio.ergonomic;
    if(score<bestScore){bestScore=score;best={a:c.a,cost:c.cost+locked,travel,strain,reach,required,lookahead,sp,bio,targets};}
   }
   const recognitionInfo=recognitionCost(keys,state,group.time,p,palm),{sig,seen,recognition}=recognitionInfo;
   const both=sideKeys[0].length&&sideKeys[1].length,coordination=both?(signature(sideKeys[0])===signature(sideKeys[1])?.10:.35):.05;
   const sp=best.sp,scratchDistance=sp.distance,scratchCost=sp.cost;
   state.history.push({time:group.time,weight:palm?1.5:1+Math.max(0,keys.length-1)*.22+(scratch?.5:0)});
   while(state.history[0]?.time<group.time-1)state.history.shift();
   const motorRate=state.history.reduce((s,e)=>s+e.weight,0);
   for(let f=0;f<5;f++){state.fatigue[f]*=Math.exp(-Math.max(0,dt)/2.5);if(Object.values(best.a).includes(f)||scratch&&sp.finger===f)state.fatigue[f]+=.05;}
   const fatigue=avg(state.fatigue),movement=best.cost+best.strain,side=hand===0?(profile.left??.9):(profile.right??1);
   const physical=.65*motorRate+movement*1.3+best.reach*.7+best.bio.ergonomic+coordination+fatigue+scratchCost/(profile.scratch??1)+held.length*.35;
   const cognitive=recognition*1.6+best.bio.extension;
   const demand=(physical+cognitive)/side;
   const action={time:group.time,hand,measure:es[0].measure,keys,scratch,assignment:best.a,palm,pattern:recognitionInfo.pattern,recognition,movement,reach:best.reach,coordination,fatigue,physical:physical/side,cognitive:cognitive/side,extension:best.bio.extension,ergonomic:best.bio.ergonomic,coupling:best.bio.coupling,pressWork:best.bio.pressWork,stairLoad:recognitionInfo.sequence,keimaLoad:recognitionInfo.keima,travel:best.travel,scratchDistance,scratchMode:sp.mode,scratchDirection:sp.direction,scratchFinger:sp.finger,scratchCost,scratchLanding:sp.landing,scratchReversal:sp.reversal,scratchSplit:sp.split,scratchConflict:sp.conflict,scratchStroke:sp.strokeDistance,scratchForce:sp.force,scratchWork:sp.work,requiredMs:Math.max(best.required,sp.reversal>0?p.scratchReversal:0)*1000,intervalMs:Math.min(10,dt)*1000,demand};
   actions.push(action);lookup.set(group.time.toFixed(6)+':'+hand,action);
   for(const lane of keys){const f=best.a[lane];if(f!==undefined){state.positions[f]=best.targets[lane];state.times[f]=group.time;}}
   if(palm){state.positions=home.map(l=>keyPosition(l,p));state.times=Array(5).fill(group.time);}
   if(scratchActive){state.positions[sp.finger]=sp.endPosition;state.times[sp.finger]=group.time;state.scratchContact=sp.contact;}
   else state.scratchContact=palm?null:sp.contact;
   if(scratchActive||keys.length)state.handMode=scratchActive?(occupied.length?'split':'scratch'):state.scratchContact?'split':'keys';
   state.familiar.set(sig,{time:group.time,count:seen&&group.time-seen.time<p.memorySeconds?seen.count+1:1});
   state.priorKeys=state.lastKeys;state.lastKeys=keys;state.lastFingers=[...new Set(Object.values(best.a))];state.lastInterval=dt;state.lastTime=group.time;state.scratch=scratch;state.assignment=best.a;
  }
 }
 const events=chart.events.map(e=>({...e,...lookup.get(e.time.toFixed(6)+':'+e.hand)}));
 const metrics={recognition:avg(actions.map(a=>a.recognition)),movement:avg(actions.map(a=>a.movement)),reach:avg(actions.map(a=>a.reach)),coordination:avg(actions.map(a=>a.coordination)),fatigue:avg(actions.map(a=>a.fatigue)),movementDistance:actions.reduce((s,a)=>s+a.travel+a.scratchDistance,0),patternReuse:actions.filter(a=>['同形反復','トリル','階段'].includes(a.pattern)).length/Math.max(1,actions.length)};
 Object.assign(metrics,{scratch:avg(actions.map(a=>a.scratchCost)),scratchLanding:avg(actions.map(a=>a.scratchLanding)),scratchReversal:avg(actions.map(a=>a.scratchReversal)),scratchSplit:avg(actions.map(a=>a.scratchSplit)),scratchTravel:actions.reduce((s,a)=>s+a.scratchDistance,0)});
 for(const k of ['physical','cognitive','extension','ergonomic','coupling','stairLoad','keimaLoad','scratchForce'])metrics[k]=avg(actions.map(a=>a[k]));
 for(const k of ['pressWork','scratchStroke','scratchWork'])metrics[k]=actions.reduce((sum,a)=>sum+a[k],0);
 return {events,metrics,actions,parameters:p};
}

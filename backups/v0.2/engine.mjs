import {humanFeatures} from './human.mjs';
export const MODEL_VERSION='0.2.0-human-experimental';
export const GAUGE={initial:100,max:100,great:0.16,good:0,bad:5,poor:9,emptyPoor:5,threshold:30,lowMultiplier:0.5};
export const DEFAULT_PROFILE={left:0.9,right:1,scratch:1,technique:'flexible',capacity:9,missIntercept:-4.6,burst:0.8};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
export function quantile(a,p){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p;return s[Math.floor(i)]*(1-i%1)+s[Math.ceil(i)]*(i%1);}
export function rng(seed=1){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function gaugeStep(g,judgement,cfg=GAUGE){
 if(g<=0)return 0;
 if(judgement==='GREAT'||judgement==='PGREAT')return Math.min(cfg.max,g+cfg.great);
 if(judgement==='GOOD')return Math.min(cfg.max,g+cfg.good);
 const loss={BAD:cfg.bad,POOR:cfg.poor,EMPTY_POOR:cfg.emptyPoor}[judgement];
 if(loss===undefined)throw Error('Unknown judgement '+judgement);
 return Math.max(0,g-loss*(g<=cfg.threshold?cfg.lowMultiplier:1));
}
const normal=[0,1,2,3,4,5,6,7],mirror=[0,7,6,5,4,3,2,1];
export function fixedOptions(){const out=[];for(const flip of [false,true])for(const left of [false,true])for(const right of [false,true])out.push({name:[flip?'FLIP':'',left?'左MIRROR':'',right?'右MIRROR':''].filter(Boolean).join(' + ')||'正規',flip,maps:[left?mirror:normal,right?mirror:normal]});return out;}
export function randomOption(seed,flip=false){const random=rng(seed),shuffle=()=>{const a=normal.slice();for(let i=7;i>1;i--){const j=1+Math.floor(random()*i);[a[i],a[j]]=[a[j],a[i]];}return a;};return {name:flip?'FLIP + 両RANDOM':'両RANDOM',flip,maps:[shuffle(),shuffle()],seed};}
export function transform(chart,option){const remap=e=>{const hand=option.flip?1-e.hand:e.hand;return {...e,hand,lane:option.maps[hand][e.lane]};};return {...chart,events:chart.events.map(remap).sort((a,b)=>a.time-b.time||a.hand-b.hand||a.lane-b.lane),holds:chart.holds.map(remap)};}

// Candidate assignments use right-hand coordinates, mirrored for the left hand.
// This is an ergonomic cost model, not a claim about an optimal human fingering.
const home=[0,0,1,1,2,3,3,4],homeKeys=[1,2,4,6,7],candidateCache=new Map();
function candidates(keys,technique){
 const key=technique+':'+keys.join(',');if(candidateCache.has(key))return candidateCache.get(key);
 const available=technique==='home'?[[0],[1],[1],[2],[3],[3],[4]]:[[0],[1,0],[1,0,2],[2,1],[3,2,0],[3,2],[4]];
 const out=[];
 function visit(i,used,assignment,cost){
  if(i===keys.length){out.push({assignment,cost});return;}
  const lane=keys[i];for(const finger of available[lane-1]){const collision=used.includes(finger)?3.5:0;
   const displacement=Math.abs(lane-homeKeys[finger])*.13;
   visit(i+1,[...used,finger],{...assignment,[lane]:finger},cost+collision+displacement+(finger>=3?.05:0));
  }
 }
 visit(0,[],{},0);out.sort((a,b)=>a.cost-b.cost);const result=out.slice(0,12);candidateCache.set(key,result);return result;
}

export function extract(chart,option=fixedOptions()[0],profile=DEFAULT_PROFILE){
 profile={...DEFAULT_PROFILE,...profile};const transformed=transform(chart,option),events=transformed.events,groups=[];
 for(const e of events){let g=groups.at(-1);if(!g||Math.abs(g.time-e.time)>1e-6){g={time:e.time,events:[]};groups.push(g);}g.events.push(e);}
 const last=[{time:-10,assignment:{},lanes:[]},{time:-10,assignment:{},lanes:[]}],hist=[[],[]],motorHist=[[],[]],heads=[0,0],rates=[],prepared=[],segments=[];
 let placementTotal=0,scratchTotal=0,repeatTotal=0,holdTotal=0,chordTotal=0;
 const allTimes=events.map(e=>e.time);let front=0;
 for(const group of groups){
  while(allTimes[front]<group.time-1)front++;
  // Group demand uses a causal one-second hand density and within-chord cost.
  for(let hand=0;hand<2;hand++){
   const es=group.events.filter(e=>e.hand===hand);if(!es.length)continue;
   const keys=[...new Set(es.filter(e=>e.lane>0).map(e=>hand===0?8-e.lane:e.lane))].sort((a,b)=>a-b),scratch=es.some(e=>e.lane===0),prev=last[hand],dt=group.time-prev.time;
   for(const e of es)hist[hand].push(e.time);
   while(hist[hand][heads[hand]]<group.time-1)heads[hand]++;
   const nps=hist[hand].length-heads[hand];
   const active=transformed.holds.filter(h=>h.hand===hand&&h.start<group.time-1e-6&&h.end>group.time+1e-6);
   const heldKeys=active.filter(h=>h.lane>0).map(h=>hand===0?8-h.lane:h.lane),occupied=[...new Set([...keys,...heldKeys])].sort((a,b)=>a-b);
   let best={assignment:{},cost:0},bestCost=Infinity;
   for(const c of candidates(occupied,profile.technique)){
    let cost=c.cost;
    for(const lane of keys){const f=c.assignment[lane];for(const [oldLane,oldFinger]of Object.entries(prev.assignment))if(oldFinger===f){cost+=Math.max(0,.19-dt)*Math.abs(lane-Number(oldLane))*2.5;}}
    // Penalize reassignment of a finger holding a key.
    for(const lane of heldKeys)if(prev.assignment[lane]!==undefined&&prev.assignment[lane]!==c.assignment[lane])cost+=2;
    if(cost<bestCost){bestCost=cost;best=c;}
   }
   if(!Number.isFinite(bestCost))bestCost=0;
   // A full seven-key chord can be one palm action. Keep raw NPS for display,
   // but do not model it as seven independently placed fingers/movements.
   const palm=keys.length===7&&!scratch&&active.length===0;
   const homeChord=keys.join(',')==='1,2,4,6,7'&&!scratch&&active.length===0;
   if(palm){bestCost=.3;best={assignment:{},cost:.3};}
   motorHist[hand].push({time:group.time,weight:palm?1.5:homeChord?2.2:es.length});
   while(motorHist[hand][0]?.time<group.time-1)motorHist[hand].shift();
   const motorNps=motorHist[hand].reduce((s,x)=>s+x.weight,0);
   const repetition=keys.some(k=>prev.lanes.includes(k))?Math.max(0,.19-dt)*8:0;
   const reaches=keys.map(k=>7-k),muri=scratch&&keys.length?Math.max(...reaches)/6:0;
   const landing=(scratch!==prev.scratch&&dt<.3)?(.3-dt)/.3:0;
   const scratchCost=(scratch?1+muri*3:0)+landing*1.5+(active.some(h=>h.lane===0)?1:0);
   const chord=palm?.25:Math.max(0,keys.length-1)*.3,hold=active.length*.45;
   const side=hand===0?profile.left:profile.right;
   const demand=(motorNps*.62+bestCost*1.5+repetition+scratchCost/profile.scratch+chord+hold)/side;
   for(const e of es)prepared.push({...e,demand,placement:bestCost,scratchCost,hold,repetition,nps,assignment:best.assignment});
   rates.push(demand);placementTotal+=bestCost*es.length;scratchTotal+=scratchCost*es.length;repeatTotal+=repetition*es.length;holdTotal+=hold*es.length;chordTotal+=chord*es.length;
   last[hand]={time:group.time,assignment:best.assignment,lanes:keys,scratch};
  }
 }
 const human=humanFeatures(transformed,profile);
 const humanMap=new Map(human.actions.map(a=>[a.time.toFixed(6)+':'+a.hand,a]));
 for(const e of prepared){const a=humanMap.get(e.time.toFixed(6)+':'+e.hand);e.demand=a.demand;e.recognition=a.recognition;e.movement=a.movement;}
 rates.length=0;rates.push(...human.actions.map(a=>a.demand));
 prepared.sort((a,b)=>a.time-b.time||a.hand-b.hand||a.lane-b.lane);
 const origin=prepared[0]?.time??0,playingDuration=Math.max(1,chart.duration-origin),count=events.length;
 for(let t=origin;t<=chart.duration;t+=2){const es=prepared.filter(e=>e.time>=t&&e.time<t+2);segments.push({time:t,measure:es[0]?.measure??null,notes:es.length,peak:Math.max(0,...es.map(e=>e.demand)),average:mean(es.map(e=>e.demand))});}
 const peak1=Math.max(...prepared.map(e=>e.nps)),avg=count/playingDuration;
 const metrics={density:avg,peakHandNps:peak1,placement:placementTotal/count,scratch:scratchTotal/count,repetition:repeatTotal/count,hold:holdTotal/count,chord:chordTotal/count,peakDemand:quantile(rates,.99),meanDemand:mean(rates),leftNotes:events.filter(e=>e.hand===0).length,rightNotes:events.filter(e=>e.hand===1).length,scratchNotes:events.filter(e=>e.lane===0).length,burst:quantile(rates,.99)/Math.max(.1,mean(rates)),duration:playingDuration};
 const proxy=metrics.peakDemand*.62+metrics.meanDemand*.38;
 Object.assign(metrics,human.metrics);
 return {events:prepared,metrics,segments,proxy,option,humanActions:human.actions,humanParameters:human.parameters};
}

export function wilson(k,n){if(!n)return [0,1];const z=1.96,p=k/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,d=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [Math.max(0,c-d),Math.min(1,c+d)];}
export function simulate(features,{capacity=9,trials=96,seed=42,profile=DEFAULT_PROFILE,gauge=GAUGE,trace=false}={}){
 profile={...DEFAULT_PROFILE,...profile};if(!Number.isFinite(capacity)||capacity<=0||!Number.isInteger(trials)||trials<1||trials>10000)throw Error('Invalid simulation parameters');
 let clears=0,totalMiss=0;const failures=[],endGauges=[],minGauges=[],traces=[];
 for(let trial=0;trial<trials;trial++){
  const random=rng(seed+trial*7919);let life=gauge.initial,min=life,shock=0,prevTime=-10,misses=0,alive=true,nextTrace=0;const points=[{time:0,gauge:100}],broken=new Set();
  const trialEvents=features.pool?features.pool[trial%features.pool.length].events:features.events;
  for(const e of trialEvents){
   if(e.time!==prevTime){const rho=Math.exp(-(e.time-prevTime)/.7);shock=rho*shock+Math.sqrt(1-rho*rho)*(random()+random()+random()-1.5)*1.4;prevTime=e.time;}
   const draw=random(),kindDraw=random(),emptyDraw=random();
   if(e.kind==='tail'&&broken.has(`${e.hand}:${e.lane}`)){broken.delete(`${e.hand}:${e.lane}`);continue;}
   const p=clamp(1/(1+Math.exp(-(profile.missIntercept+(e.demand-capacity)/1.35+shock*profile.burst))),.00002,.92);
   let judgement=draw<p?(kindDraw<.72?'POOR':'BAD'):(draw<p+(1-p)*.07?'GOOD':'GREAT');
   if(e.kind==='head'){if(judgement==='POOR'||judgement==='BAD')broken.add(`${e.hand}:${e.lane}`);else broken.delete(`${e.hand}:${e.lane}`);}
   if(e.kind==='tail'&&judgement==='GOOD')judgement='GREAT';
   life=gaugeStep(life,judgement,gauge);if(judgement==='BAD'||judgement==='POOR'){misses++;if(emptyDraw<.08)life=gaugeStep(life,'EMPTY_POOR',gauge);}
   min=Math.min(min,life);
   if(trace&&e.time>=nextTrace){points.push({time:e.time,gauge:life});nextTrace=e.time+.5;}
   if(life<=0){alive=false;failures.push(e.time);points.push({time:e.time,gauge:0});break;}
  }
  if(alive)clears++;totalMiss+=misses;endGauges.push(life);minGauges.push(min);if(trace&&trial<12)traces.push(points);
 }
 return {clearRate:clears/trials,interval:wilson(clears,trials),trials,clears,capacity,meanMissUntilEndOrFail:totalMiss/trials,endMedian:quantile(endGauges,.5),minMedian:quantile(minGauges,.5),failureMedian:failures.length?quantile(failures,.5):null,traces};
}
export function requiredCapacity(features,{target=.8,trials=32,seed=42,profile=DEFAULT_PROFILE}={}){
 let lo=.25,hi=32;for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(simulate(features,{capacity:mid,trials,seed,profile}).clearRate>=target)hi=mid;else lo=mid;}
 return {value:hi,censored:simulate(features,{capacity:hi,trials,seed,profile}).clearRate<target,target,trials,resolution:(32-.25)/256};
}

export function analyzeChart(chart,{profile=DEFAULT_PROFILE,randomSamples=16,trials=48}={}){
 const seed=hash(chart.id),fixed=fixedOptions().map(o=>extract(chart,o,profile)),ranked=[...fixed].sort((a,b)=>a.proxy-b.proxy);
 // Full survival thresholds for every fixed option; same draws for fair comparisons.
 const options=fixed.map(f=>({name:f.option.name,option:f.option,proxy:f.proxy,required:requiredCapacity(f,{trials:24,seed,profile}).value}));
 options.sort((a,b)=>a.required-b.required||a.proxy-b.proxy);
 const best=fixed.find(f=>f.option.name===options[0].name),standard=fixed[0],capacity=options[0].required;
 const selected=simulate(best,{capacity,trials,seed:seed+1,profile,trace:true});
 const draws=[];
 for(let i=0;i<randomSamples;i++){
  const option=randomOption(seed+i*101,i%2===1),f=extract(chart,option,profile),sim=simulate(f,{capacity,trials:24,seed:seed+1,profile});
  draws.push({option,proxy:f.proxy,clearRate:sim.clearRate});
 }
 const average=mean(draws.map(x=>x.clearRate));
 return {id:chart.id,model:MODEL_VERSION,profile,metrics:standard.metrics,bestMetrics:best.metrics,requiredCapacity:capacity,options,selected,standard:simulate(standard,{capacity,trials,seed:seed+1,profile}),random:{samples:draws.length,meanClearRate:average,permutationP10:quantile(draws.map(x=>x.clearRate),.1),permutationP90:quantile(draws.map(x=>x.clearRate),.9),atLeastOneIn10:1-(1-average)**10,draws},danger:best.segments.filter(s=>s.notes).sort((a,b)=>b.peak-a.peak).slice(0,5),segments:best.segments,human:{parameters:best.humanParameters,actions:[...best.humanActions].sort((a,b)=>b.demand-a.demand).slice(0,10)},warnings:[...chart.warnings,'身体配置・認識モデルは相対座標による未校正の仮説。実機寸法・脳活動の再現ではありません。'],confidence:'未校正・実験値'};
}

export function analyzeRandomStrategies(chart,result){
 const profile=result.profile,seed=hash(chart.id)+501,strategies=[];
 for(const flip of [false,true]){
  const draws=result.random.draws.filter(d=>d.option.flip===flip),pool=draws.map(d=>extract(chart,d.option,profile));
  const requirement=requiredCapacity({pool},{trials:64,seed,profile});
  const check=simulate({pool},{capacity:requirement.value,trials:128,seed:seed+20000,profile,trace:true});
  strategies.push({name:flip?'FLIP + 両RANDOM':'両RANDOM',required:requirement.value,censored:requirement.censored,permutations:pool.length,simulation:check,atFixedThreshold:simulate({pool},{capacity:result.requiredCapacity,trials:128,seed:seed+20000,profile}).clearRate});
 }
 strategies.sort((a,b)=>a.required-b.required);
 const best=strategies[0].required<result.requiredCapacity?strategies[0]:null;
 return {version:'random-policy-1',strategies,requiredCapacity:best?.required??result.requiredCapacity,recommendation:best?.name??result.options[0].name,isRandom:!!best,target:.8,definition:'単発80%完走。固定8種＋両RANDOM/FLIP両RANDOM（各8配置の有限標本）。'};
}

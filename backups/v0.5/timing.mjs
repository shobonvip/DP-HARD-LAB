// Experimental timing windows; these are configurable assumptions, not a
// reverse-engineered LIGHTNING MODEL judgement implementation.
import {parameters,keyPosition,movementTime} from './ergonomics.mjs';
import {scratchReach} from './scratch.mjs';
export const TIMING_DEFAULTS={biasMs:0,jitterMs:18,repeatCorrection:.2,tempoDrift:0,anmitsuMs:0,scratchDelayMs:0,greatMs:33.33,goodMs:100,badMs:200};
export const TIMING_LIMITS={biasMs:[-250,250],jitterMs:[0,100],repeatCorrection:[0,1],tempoDrift:[-.2,.2],anmitsuMs:[0,150],scratchDelayMs:[0,180],greatMs:[16.67,60],goodMs:[60,150],badMs:[160,300]};
export function timingParameters(input={}){
 const p={...TIMING_DEFAULTS,...input};for(const [k,[lo,hi]] of Object.entries(TIMING_LIMITS))if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid timing parameter: '+k);
 if(p.greatMs>=p.goodMs||p.goodMs>=p.badMs)throw Error('Timing windows must be ordered');return p;
}

// Optional conservative two-action anmitsu. Original note timestamps and count
// are retained for judging. Same-lane repeats, scratches and holds are excluded.
export function planAnmitsu(chart,profile={}){
 const p=timingParameters(profile.timing),human=parameters(profile.human),events=chart.events.map((e,i)=>({...e,_index:i,originalTime:e.time}));let groupedNotes=0,shiftedScratches=0;
 if(p.anmitsuMs>0)for(const hand of [0,1]){
  const groups=[];for(const e of events.filter(e=>e.hand===hand)){let g=groups.at(-1);if(!g||Math.abs(g.time-e.time)>1e-6){g={time:e.time,events:[]};groups.push(g);}g.events.push(e);}
  for(let i=0;i+1<groups.length;i++){
   const a=groups[i],b=groups[i+1],dt=b.time-a.time,union=[...a.events,...b.events];
   if(dt<=0||dt>Math.min(p.anmitsuMs/1000,profile.human?.readAhead??.65,2*(p.goodMs-20)/1000)||union.some(e=>e.lane===0||e.kind!=='tap'))continue;
   if(chart.holds.some(h=>h.hand===hand&&h.start<=b.time&&h.end>=a.time))continue;
   if(new Set(union.map(e=>e.lane)).size!==union.length)continue;
   const fingers=union.map(e=>[null,0,1,1,2,3,3,4][hand?e.lane:8-e.lane]);
   if(new Set(fingers).size!==fingers.length)continue;
   for(const e of union)e.time=(a.time+b.time)/2;groupedNotes+=union.length;i++;
  }
 }
 // Deliberate key-first, scratch-later play of simultaneous tap notes only.
 // Keep the original judgement deadlines; do not shift CN/BSS or held actions.
 const keyboardTimes=new Map();
 for(const e of events)if(e.lane>0){const key=e.originalTime.toFixed(6)+':'+e.hand;if(!keyboardTimes.has(key))keyboardTimes.set(key,[]);keyboardTimes.get(key).push(e);}
 for(const e of events)if(e.lane===0&&e.kind==='tap'){
  const keys=keyboardTimes.get(e.originalTime.toFixed(6)+':'+e.hand);if(!keys?.length||keys.some(k=>k.kind!=='tap'))continue;
  const reach=scratchReach(keys.map(k=>e.hand?k.lane:8-k.lane),human,keyPosition);
  if(reach.possible&&p.scratchDelayMs===0)continue;
  const travel=reach.possible?0:movementTime(reach.span,human);
  const delay=p.scratchDelayMs>0?p.scratchDelayMs/1000:Math.max(travel/2,travel-human.readAhead);
  const keyTime=e.originalTime+Math.min(0,delay-travel),scratchTime=e.originalTime+delay;
  if(chart.holds.some(h=>h.hand===e.hand&&h.start<=scratchTime&&h.end>=keyTime))continue;
  for(const k of keys)k.time=keyTime;e.time=scratchTime;shiftedScratches++;
 }
 events.sort((a,b)=>a.time-b.time||a.hand-b.hand||a.lane-b.lane);
 return {chart:{...chart,events},groupedNotes,shiftedScratches};
}

const compiledCache=new WeakMap();
export function compileTiming(features){
 if(compiledCache.has(features))return compiledCache.get(features);
 const notes=features.events,lanes=Array.from({length:16},()=>[]),tailFor=new Int32Array(notes.length).fill(-1),headFor=new Int32Array(notes.length).fill(-1),heads=Array(16).fill(-1),intervals=new Float64Array(notes.length),previous=Array(16).fill(-Infinity);
 for(let i=0;i<notes.length;i++){const n=notes[i],lane=n.hand*8+n.lane;lanes[lane].push(i);intervals[i]=n.time-previous[lane];previous[lane]=n.time;if(n.kind==='head')heads[lane]=i;if(n.kind==='tail'&&heads[lane]>=0){headFor[i]=heads[lane];tailFor[heads[lane]]=i;heads[lane]=-1;}}
 const rho=new Float64Array(notes.length),volatility=new Float64Array(notes.length);let priorTime=-10;
 for(let i=0;i<notes.length;i++)if(notes[i].time!==priorTime){rho[i]=Math.exp(-(notes[i].time-priorTime)/.7);volatility[i]=Math.sqrt(1-rho[i]*rho[i]);priorTime=notes[i].time;}
 const compiled={notes,lanes,tailFor,headFor,intervals,rho,volatility,randomTapes:new Map()};compiledCache.set(features,compiled);return compiled;
}

class LaneJudge{
 constructor(compiled,p,emit){Object.assign(this,compiled);this.p=p;this.emit=emit;this.state=new Uint8Array(this.notes.length);this.cursor=new Int32Array(16);this.expire=0;this.lastHit=Array(16).fill(-Infinity);}
 finish(i,judgement,time,input=null){
  if(this.state[i])return;this.state[i]=1;const note=this.notes[i];
  if((judgement==='BAD'||judgement==='POOR')&&this.tailFor[i]>=0)this.state[this.tailFor[i]]=2;
  if(note.kind==='tail'&&['PGREAT','GREAT','GOOD'].includes(judgement))judgement='PGREAT';
  this.emit({judgement,time,noteIndex:i,inputIndex:input?.source??null,offsetMs:input?(input.time-note.time)*1000:null,lane:note.hand*8+note.lane});
 }
 expireBefore(time){while(this.expire<this.notes.length&&this.notes[this.expire].time+this.p.badMs/1000<time-1e-9){const i=this.expire++;this.finish(i,'POOR',this.notes[i].time+this.p.badMs/1000);}}
 hit(input){
  if(input.source!=null&&this.state[input.source]===2)return;
  const lane=input.hand*8+input.lane,queue=this.lanes[lane],t=input.time,bad=this.p.badMs/1000,good=this.p.goodMs/1000;
  while(this.cursor[lane]<queue.length&&this.state[queue[this.cursor[lane]]])this.cursor[lane]++;
  let candidate=-1,nearest=Infinity,fallback=-1;
  for(let j=this.cursor[lane];j<queue.length;j++){
   const i=queue[j],delta=t-this.notes[i].time;if(delta < -bad-1e-9)break;if(this.state[i]||delta>bad+1e-9||(input.kind==='tail')!==(this.notes[i].kind==='tail'))continue;
   if(fallback<0)fallback=i;
   if(Math.abs(delta)<=good+1e-9&&Math.abs(delta)<nearest){candidate=i;nearest=Math.abs(delta);}
  }
  if(candidate<0)candidate=fallback;
  if(candidate<0){
   const next=queue[this.cursor[lane]],near=next!=null&&this.notes[next].time-t<bad+.1;
   if(near||t-this.lastHit[lane]<bad)this.emit({judgement:'EMPTY_POOR',time:t,noteIndex:null,inputIndex:input.source??null,offsetMs:null,lane});
   return;
  }
  const d=Math.abs(t-this.notes[candidate].time)*1000;
  this.lastHit[lane]=t;this.finish(candidate,d<=16.67+1e-6?'PGREAT':d<=this.p.greatMs+1e-6?'GREAT':d<=this.p.goodMs+1e-6?'GOOD':'BAD',t,input);
 }
}

// Public deterministic adjudicator for explicit input traces and boundary tests.
export function judgeInputs(notes,inputs,settings={}){
 const out=[],p=timingParameters(settings),judge=new LaneJudge(compileTiming({events:notes}),p,e=>out.push(e));
 for(const input of [...inputs].sort((a,b)=>a.time-b.time)){judge.expireBefore(input.time);judge.hit(input);}judge.expireBefore(Infinity);return out;
}

class Heap{
 constructor(){this.items=[];}
 push(x){const a=this.items;let i=a.length;a.push(x);while(i){const p=(i-1)>>1;if(a[p].time<=x.time)break;a[i]=a[p];i=p;}a[i]=x;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].time<a[c].time)c++;if(a[c].time>=last.time)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}

export function timedTrial(features,{capacity,profile,random,gauge,gaugeStep,trace=false,collectInputs=false,summary=true,randomSeed}){
 const p=timingParameters(profile.timing),compiled=compileTiming(features),notes=compiled.notes,heap=new Heap();
 const phase=new Float64Array(16),lastFinger=Array(10).fill(-Infinity),lastFingerTarget=Array(10).fill(-Infinity),badRun=new Int32Array(16),lastBadTime=Array(16).fill(-Infinity);
 const counts={PGREAT:0,GREAT:0,GOOD:0,BAD:0,POOR:0,EMPTY_POOR:0},points=[{time:0,gauge:gauge.initial}],inputs=[],examples=[];
 let life=gauge.initial,min=life,misses=0,alive=true,failure=null,nextTrace=0,shock=0,lastTime=-10,maxBadChain=0,badChains=0,reassigned=0,early=0,late=0,offsetSum=0,timedHits=0;
 const judge=new LaneJudge(compiled,p,e=>{
  if(!alive)return;
  if(!summary){life=gaugeStep(life,e.judgement,gauge);if(life<=0){alive=false;failure=e.time;}return;}
  counts[e.judgement]++;const bad=e.judgement==='BAD'||e.judgement==='POOR'||e.judgement==='EMPTY_POOR';
  life=gaugeStep(life,e.judgement,gauge);min=Math.min(min,life);if(bad)misses++;
  if(trace&&examples.length<10&&(bad||examples.length<2))examples.push({...e,noteTime:e.noteIndex==null?null:notes[e.noteIndex].time});
  if(e.judgement==='BAD'){badRun[e.lane]=e.time-lastBadTime[e.lane]<.6?badRun[e.lane]+1:1;lastBadTime[e.lane]=e.time;maxBadChain=Math.max(maxBadChain,badRun[e.lane]);if(badRun[e.lane]===3)badChains++;}
  else if(!bad)badRun[e.lane]=0;
  if(e.offsetMs!=null){timedHits++;offsetSum+=e.offsetMs;if(e.offsetMs<0)early++;else if(e.offsetMs>0)late++;if(e.inputIndex!=null&&e.inputIndex!==e.noteIndex)reassigned++;}
  if(trace&&e.time>=nextTrace){points.push({time:Math.max(0,e.time),gauge:life});nextTrace=e.time+.5;}
  if(life<=0){alive=false;failure=e.time;if(trace)points.push({time:Math.max(0,e.time),gauge:0});}
 });
 function flush(until){while(alive&&heap.items.length&&heap.items[0].time<=until){const input=heap.pop();judge.expireBefore(input.time);if(alive)judge.hit(input);}if(alive)judge.expireBefore(until);}
 const uniform=()=>random()+random()+random()-1.5;
 // Every note consumes the same random draws before any capacity-dependent
 // branch. Reuse that identical tape during repeated threshold searches.
 let tape;
 if(!summary&&randomSeed!==undefined){
  tape=compiled.randomTapes.get(randomSeed);
  if(!tape){tape={shock:new Float64Array(notes.length),draw:new Float64Array(notes.length),kind:new Float64Array(notes.length),noise:new Float64Array(notes.length)};let last=-10;
   for(let i=0;i<notes.length;i++){if(notes[i].time!==last){tape.shock[i]=uniform();last=notes[i].time;}tape.draw[i]=random();tape.kind[i]=random();tape.noise[i]=uniform()*2;}
   compiled.randomTapes.set(randomSeed,tape);
  }
 }
 for(let i=0;i<notes.length&&alive;i++){
  const e=notes[i],target=e.plannedTime??e.time;flush(e.time-.55);if(!alive)break;
  if(e.time!==lastTime){shock=compiled.rho[i]*shock+compiled.volatility[i]*(tape?tape.shock[i]:uniform())*1.4;lastTime=e.time;}
  const draw=tape?tape.draw[i]:random(),kind=tape?tape.kind[i]:random(),noise=tape?tape.noise[i]:uniform()*2,lane=e.hand*8+e.lane,dt=compiled.intervals[i],repeat=dt>0&&dt<.35;
  // A held chord can prevent the timing planner from separating a far scratch.
  // Higher ability cannot make that simultaneous reach physically available.
  if(e.lane===0&&e.scratchUnreachable||e.lane>0&&e.scratchBlockedKey&&e.kind!=='tail')continue;
  const probability=Math.max(.00002,Math.min(.92,1/(1+Math.exp(-((profile.missIntercept??-4.6)+(e.demand-capacity)/1.35+shock*(profile.burst??.8))))));
  const overload=Math.max(0,e.demand-capacity),spread=(p.jitterMs+Math.min(45,overload*3))/1000;
  phase[lane]=repeat?phase[lane]*(1-p.repeatCorrection)+dt*p.tempoDrift:0;
  if(draw<probability){if(kind<.65)continue;phase[lane]+=(kind<.825?-1:1)*(p.goodMs/1000+.03);}
  let offset=p.biasMs/1000+phase[lane]+noise*spread;
  offset=Math.max(-.4,Math.min(.4,offset));let time=target+offset;
  const finger=e.lane===0?e.scratchFinger:e.assignment?.[e.hand?e.lane:8-e.lane],fingerId=finger==null?null:e.hand*5+finger;
  if(e.lane>0&&fingerId!=null&&e.kind!=='tail'){
   const recovery=(profile.human?.fingerRecovery??.075)*(finger>=3?1.13:1);
   if(Math.abs(lastFingerTarget[fingerId]-target)>1e-6)time=Math.max(time,lastFinger[fingerId]+recovery);
   if(time>target+.4)continue;lastFinger[fingerId]=time;lastFingerTarget[fingerId]=target;
  }
  // Anmitsu shifts at most 75ms, so the .55s flush look-behind is conservative.
  const input={time,hand:e.hand,lane:e.lane,kind:e.kind,source:i};heap.push(input);if(collectInputs)inputs.push(input);
 }
 if(alive)flush(Infinity);
 return {alive,life,min,misses,failure,points,counts,maxBadChain,badChains,reassigned,early,late,offsetSum,timedHits,inputs,examples};
}

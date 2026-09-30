import {distance} from './ergonomics.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// Estimate how varied and unpredictable the nearby scratch inter-onset rhythm
// is. Long gaps mark phrase boundaries; tempo-change crossings are ignored.
// This is a chart feature, not a claim that timing alone determines difficulty.
export function scratchRhythmComplexities(chart){
 const tempos=[...(chart.tempos??[])].sort((a,b)=>a.seconds-b.seconds);
 const fallback=Number(String(chart.bpm??'').match(/[\d.]+/)?.[0])||120;
 const bpmAt=time=>{
  let bpm=fallback;
  for(const tempo of tempos){if(tempo.seconds>time)break;bpm=Number(tempo.bpm)||bpm;}
  return bpm;
 };
 const output=new Map();
 for(let hand=0;hand<2;hand++){
  const times=[...new Set(chart.events.filter(e=>e.hand===hand&&e.lane===0&&e.kind!=='tail').map(e=>e.time))].sort((a,b)=>a-b);
  if(!times.length)continue;
  const intervals=[];
  for(let i=0;i<times.length-1;i++){
   const start=times[i],end=times[i+1],mid=(start+end)/2,bpm=bpmAt(mid),beats=(end-start)*bpm/60;
   const crossesTempo=tempos.some(t=>t.seconds>start+1e-6&&t.seconds<end-1e-6);
   intervals.push(!crossesTempo&&beats>0&&beats<=1.25?Math.max(1,Math.round(beats*24)):null);
  }
  for(let i=0;i<times.length;i++){
   const local=intervals.slice(Math.max(0,i-4),Math.min(intervals.length,i+4)).filter(Number.isFinite);
   let complexity=0;
   if(local.length>=3){
    const counts=new Map();for(const unit of local)counts.set(unit,(counts.get(unit)??0)+1);
    const entropy=-[...counts.values()].reduce((sum,count)=>{const p=count/local.length;return sum+p*Math.log(p);},0);
    const entropyNorm=clamp(entropy/Math.log(4),0,1);
    let changes=0;for(let j=1;j<local.length;j++)if(local[j]!==local[j-1])changes++;
    const changeRate=changes/Math.max(1,local.length-1);
    let periodicity=0;
    for(let period=1;period<=Math.min(3,Math.floor(local.length/2));period++){
     let matches=0;for(let j=period;j<local.length;j++)if(local[j]===local[j-period])matches++;
     periodicity=Math.max(periodicity,matches/(local.length-period));
    }
    complexity=clamp((.55*entropyNorm+.45*changeRate)*(1-.55*periodicity),0,1);
   }
   output.set(`${hand}:${times[i].toFixed(6)}`,complexity);
  }
 }
 return output;
}

// Normalised right-hand lanes: 7/6/5 correspond to left-hand 1/2/3.
// A player-informed reach boundary, not a measured joint model.
export function scratchReach(keys,p,position){
 const span=keys.length?Math.max(...keys.map(k=>distance(position(0,p),position(k,p)))):0;
 return {possible:keys.every(k=>k>=4)&&span<=p.handSpan,borderline:keys.includes(4),span};
}
// Idealised alternating strokes; inertia and torque are adjustable assumptions.
export function scratchPlan({state,keys,occupied,assignment,time,stroke,held,tail,p,position,moveTime,rhythmComplexity=0,rhythmWeight=1}){
 const target=position(0,p),active=stroke||held,contact=state.scratchContact;
 const elapsed=contact?time-contact.lastStroke:Infinity;
 const canRetain=!!contact&&(elapsed<=p.scratchRetention||held||tail);
 const dt=Math.max(.02,time-state.lastTime);
 const reach=scratchReach(occupied,p,position);
 const retainedWhileKeying=!active&&canRetain&&reach.possible&&Object.values(assignment).every(f=>f<=1)&&!Object.values(assignment).includes(contact.finger);
 const departure=!active&&!retainedWhileKeying&&occupied.length&&state.handMode==='scratch';
 const departureDistance=departure?Math.max(...occupied.map(k=>distance(contact?.position??target,position(k,p)))):0;
 const departureCost=departureDistance?Math.max(0,moveTime(departureDistance,p)/dt-.5):0;
 if(!active){
  const split=retainedWhileKeying&&occupied.length?Math.max(...occupied.map(k=>distance(contact.position,position(k,p))))/p.handSpan*.4:0;
  return {finger:retainedWhileKeying?contact.finger:null,direction:null,mode:retainedWhileKeying&&occupied.length?'皿接触＋鍵盤':departure?'皿→鍵盤':'なし',distance:departureDistance,landing:departureCost,reversal:0,split,conflict:0,cost:departureCost+split,contact:retainedWhileKeying?contact:null,stroke:false,strokeDistance:0,force:0,work:0};
 }
 const angle=p.scratchAngle*Math.PI/180,r=p.scratchRadius;
 const endpoint=sign=>[target[0]+r*(1-Math.cos(angle/2)),target[1]+sign*r*Math.sin(angle/2),target[2]];
 let best;
 for(const finger of held&&contact?[contact.finger]:[4,3]){
  const conflict=Object.values(assignment).includes(finger)?6:0;
  const retained=canRetain&&contact.finger===finger;
  const continuing=stroke&&retained&&(elapsed<=p.scratchRetention||tail);
  const direction=stroke?(continuing?-contact.direction:1):(contact?.direction??1);
  const startPosition=retained?contact.position:endpoint(-direction);
  const endPosition=stroke?endpoint(direction):startPosition;
  const arrivalDistance=retained?0:distance(state.positions[finger],startPosition);
  const landing=arrivalDistance?Math.max(0,moveTime(arrivalDistance,p)/dt-.5):0;
  const strokeDistance=stroke?r*angle:0;
  // Triangular rest-to-rest angular motion: alpha=4*theta/t^2.
  const duration=Math.max(.02,Math.min(.3,continuing?elapsed:dt));
  const alpha=stroke?4*angle/duration**2:0;
  const torque=stroke?p.scratchTorque+p.scratchInertia*alpha:0;
  const force=torque/(r/1000),strength=direction===1?p.scratchPushForce:p.scratchPullForce;
  const effort=stroke ? .15*force/strength : 0;
  const reversal=continuing ? (Math.max(0,p.scratchReversal/Math.max(.015,elapsed)-1)+Math.max(0,force/strength-1))*rhythmWeight : 0;
  const rhythm=stroke ? .35*rhythmComplexity : 0;
  const span=occupied.length?Math.max(...occupied.flatMap(k=>[distance(position(k,p),startPosition),distance(position(k,p),endPosition)]))/p.handSpan:0;
  const split=occupied.length?span*.4+Math.max(0,span-1)*1.5+(reach.borderline?1:0)+(!reach.possible?4:0):0;
  const switching=canRetain&&contact.finger!==finger ? .2 : 0;
  const strokeCost=stroke ? .6*rhythmWeight : .2;
  const cost=strokeCost+landing+reversal+rhythm+split+conflict+switching+effort*rhythmWeight;
  const next={finger,lastStroke:stroke?time:(contact?.lastStroke??time),direction,interval:continuing?elapsed:0,run:continuing?contact.run+1:stroke?1:(contact?.run??0),position:endPosition};
  const plan={unreachable:!reach.possible,borderline:reach.borderline,finger,direction:stroke?(direction===1?'押し':'引き'):null,mode:!reach.possible?'無理皿（要ずらし）':occupied.length?(reach.borderline?'皿＋4鍵（限界付近）':'皿＋鍵盤'):held&&!stroke?'皿保持':continuing?'連皿':'鍵盤→皿',distance:arrivalDistance,landing,reversal,split,conflict,cost,contact:next,stroke,strokeDistance,force,work:torque*angle*1000,endPosition};
  if(!best||cost<best.cost)best=plan;
 }
 return best;
}

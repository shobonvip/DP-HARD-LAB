import {distance} from './ergonomics.mjs';
// Normalised right-hand lanes: 7/6/5 correspond to left-hand 1/2/3.
// A player-informed reach boundary, not a measured joint model.
export function scratchReach(keys,p,position){
 const span=keys.length?Math.max(...keys.map(k=>distance(position(0,p),position(k,p)))):0;
 return {possible:keys.every(k=>k>=4)&&span<=p.handSpan,borderline:keys.includes(4),span};
}
// Idealised alternating strokes; inertia and torque are adjustable assumptions.
export function scratchPlan({state,keys,occupied,assignment,time,stroke,held,tail,p,position,moveTime}){
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
  const effort=stroke?.15*force/strength:0;
  const reversal=continuing?Math.max(0,p.scratchReversal/Math.max(.015,elapsed)-1)+Math.max(0,force/strength-1):0;
  const rhythm=continuing&&contact.interval>0?Math.min(2,Math.abs(Math.log2(Math.max(.015,elapsed)/contact.interval)))*.15:0;
  const span=occupied.length?Math.max(...occupied.flatMap(k=>[distance(position(k,p),startPosition),distance(position(k,p),endPosition)]))/p.handSpan:0;
  const split=occupied.length?span*.4+Math.max(0,span-1)*1.5+(reach.borderline?1:0)+(!reach.possible?4:0):0;
  const switching=canRetain&&contact.finger!==finger?.2:0;
  const cost=(stroke?.6:.2)+landing+reversal+rhythm+split+conflict+switching+effort;
  const next={finger,lastStroke:stroke?time:(contact?.lastStroke??time),direction,interval:continuing?elapsed:0,run:continuing?contact.run+1:stroke?1:(contact?.run??0),position:endPosition};
  const plan={unreachable:!reach.possible,borderline:reach.borderline,finger,direction:stroke?(direction===1?'押し':'引き'):null,mode:!reach.possible?'無理皿（要ずらし）':occupied.length?(reach.borderline?'皿＋4鍵（限界付近）':'皿＋鍵盤'):held&&!stroke?'皿保持':continuing?'連皿':'鍵盤→皿',distance:arrivalDistance,landing,reversal,split,conflict,cost,contact:next,stroke,strokeDistance,force,work:torque*angle*1000,endPosition};
  if(!best||cost<best.cost)best=plan;
 }
 return best;
}

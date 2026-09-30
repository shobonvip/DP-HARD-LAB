import {distance} from './ergonomics.mjs';
// Idealised alternating strokes; inertia and torque are adjustable assumptions.
export function scratchPlan({state,keys,occupied,assignment,time,stroke,held,tail,p,position,moveTime}){
 const target=position(0,p),active=stroke||held,contact=state.scratchContact;
 const elapsed=contact?time-contact.lastStroke:Infinity;
 const canRetain=!!contact&&(elapsed<=p.scratchRetention||held||tail);
 const dt=Math.max(.02,time-state.lastTime);
 const retainedWhileKeying=!active&&canRetain&&!Object.values(assignment).includes(contact.finger)&&occupied.every(k=>distance(contact.position,position(k,p))<=p.handSpan);
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
  const split=occupied.length?span*.4+Math.max(0,span-1)*1.5:0;
  const switching=canRetain&&contact.finger!==finger?.2:0;
  const cost=(stroke?.6:.2)+landing+reversal+rhythm+split+conflict+switching+effort;
  const next={finger,lastStroke:stroke?time:(contact?.lastStroke??time),direction,interval:continuing?elapsed:0,run:continuing?contact.run+1:stroke?1:(contact?.run??0),position:endPosition};
  const plan={finger,direction:stroke?(direction===1?'押し':'引き'):null,mode:occupied.length?'皿＋鍵盤':held&&!stroke?'皿保持':continuing?'連皿':'鍵盤→皿',distance:arrivalDistance,landing,reversal,split,conflict,cost,contact:next,stroke,strokeDistance,force,work:torque*angle*1000,endPosition};
  if(!best||cost<best.cost)best=plan;
 }
 return best;
}

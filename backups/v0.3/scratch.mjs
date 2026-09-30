// Hypothetical contact/alternation model, not measured turntable mechanics.
// Coordinates and finger identities are normalized to the right hand.
export function scratchPlan({state,keys,occupied,assignment,time,stroke,held,tail,p,position,moveTime}){
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),target=position(0,p);
 const active=stroke||held,contact=state.scratchContact;
 const elapsed=contact?time-contact.lastStroke:Infinity;
 const canRetain=!!contact&&(elapsed<=p.scratchRetention||held||tail);
 const dt=Math.max(.02,time-state.lastTime);
 const retainedWhileKeying=!active&&canRetain&&!Object.values(assignment).includes(contact.finger)&&occupied.every(k=>dist(target,position(k,p))<=p.handSpan*p.keyPitch);
 const departure=!active&&!retainedWhileKeying&&occupied.length&&state.handMode==='scratch';
 const departureDistance=departure?Math.max(...occupied.map(k=>dist(target,position(k,p)))):0;
 const departureCost=departureDistance?Math.max(0,moveTime(departureDistance,p)/dt-.5):0;
 if(!active){
  const split=retainedWhileKeying&&occupied.length?Math.max(...occupied.map(k=>dist(target,position(k,p))))/(p.handSpan*p.keyPitch)*.4:0;
  return {finger:retainedWhileKeying?contact.finger:null,direction:null,mode:retainedWhileKeying&&occupied.length?'皿接触＋鍵盤':departure?'皿→鍵盤':'なし',distance:departureDistance,landing:departureCost,reversal:0,split,conflict:0,cost:departureCost+split,contact:retainedWhileKeying?contact:null,stroke:false};
 }
 let best;
 // Reserve a scratch finger while assigning the remaining fingers to keys.
 // Infeasible chords are penalized instead of silently sharing one finger.
 for(const finger of held&&contact?[contact.finger]:[4,3]){
  const conflict=Object.values(assignment).includes(finger)?6:0;
  const retained=canRetain&&contact.finger===finger;
  let arrivalDistance=retained?0:dist(state.positions[finger],target);
  if(!retained&&state.lastKeys.length)arrivalDistance=Math.max(arrivalDistance,dist(position(state.lastKeys.at(-1),p),target));
  const landing=arrivalDistance?Math.max(0,moveTime(arrivalDistance,p)/dt-.5):0;
  const continuing=stroke&&retained&&(elapsed<=p.scratchRetention||tail);
  const direction=stroke?(continuing?-contact.direction:1):(contact?.direction??1);
  // Every second regular stroke reverses direction, with no keyboard travel.
  const reversal=continuing?Math.max(0,p.scratchReversal/Math.max(.015,elapsed)-1):0;
  const rhythm=continuing&&contact.interval>0?Math.min(2,Math.abs(Math.log2(Math.max(.015,elapsed)/contact.interval)))*.15:0;
  const span=occupied.length?Math.max(...occupied.map(k=>dist(position(k,p),target)))/(p.handSpan*p.keyPitch):0;
  const split=occupied.length?span*.4+Math.max(0,span-1)*1.5:0;
  const switching=canRetain&&contact.finger!==finger?.2:0;
  const cost=(stroke?.6:.2)+landing+reversal+rhythm+split+conflict+switching;
  const next={finger,lastStroke:stroke?time:(contact?.lastStroke??time),direction,interval:continuing?elapsed:0,run:continuing?contact.run+1:stroke?1:(contact?.run??0)};
  const plan={finger,direction:stroke?(direction===1?'押し':'引き'):null,mode:occupied.length?'皿＋鍵盤':held&&!stroke?'皿保持':continuing?'連皿':'鍵盤→皿',distance:arrivalDistance,landing,reversal,split,conflict,cost,contact:next,stroke};
  if(!best||cost<best.cost)best=plan;
 }
 return best;
}

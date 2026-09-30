// Shared scheduling work is not a second independent finger movement.
// Keep lane-jack work, recovery time and actual movement outside this relief.
export function motorOverlap({motorRate,fingerRate,unilateralBurst,rapidRunLoad}){
 return Math.min(.35*motorRate,.3*fingerRate)+.5*Math.min(unilateralBurst,rapidRunLoad);
}
// Changing a chord/fingering under time pressure requires preparation even
// when every key separately belongs to the familiar home position.
export function placementTransition(keys,assignment,state,dt,context,p){
 if(!keys.length||!state.lastKeys.length||dt<=0||dt>=.5)return 0;
 const same=keys.join(',')===state.lastKeys.join(',');
 const alternating=keys.join(',')===state.priorKeys.join(',');
 const changed=keys.filter(k=>!state.lastKeys.includes(k)).length;
 const reassign=keys.filter(k=>state.assignment?.[k]!==undefined&&state.assignment[k]!==assignment[k]).length;
 let conflict=0;
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  if(assignment[keys[i]]===assignment[keys[j]])conflict++;
 }
 const mixed=keys.some(k=>k%2===0)&&keys.some(k=>k%2===1);
 const pressure=Math.min(2,.18/Math.max(.06,dt));
 const novelty=(same?.2:alternating?.45:1)*(1-.6*(context.ease??0));
 return pressure*(novelty*(changed*.18+Math.max(0,keys.length-1)*(mixed?.22:.1))+reassign*.5*(1-p.extensionSkill)+conflict*.35);
}

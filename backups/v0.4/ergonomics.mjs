// Millimetres, seconds and newtons. This is a configurable hypothesis, not a
// measured biomechanical model of a particular player or LIGHTNING cabinet.
export const HOME_FINGERS=[null,0,1,1,2,3,3,4];
export const HOME_KEYS=[1,2,4,6,7];
export const FINGER_CHOICES=[[0],[1,0],[1,0,2],[2,1],[3,2,0],[3,2,4],[4]];
export const HUMAN_DEFAULTS={
 keyPitch:20.7,rowOffset:55.7,targetWidth:25,keyDepth:40,
 scratchGap:75,scratchY:-25,scratchHeight:20,scratchRadius:110,
 scratchAngle:7.5,scratchInertia:.001,scratchTorque:.025,
 scratchPushForce:2.5,scratchPullForce:2.5,
 handSpan:180,readAhead:.65,memorySeconds:2,fingerRecovery:.075,
 scratchReversal:.085,scratchRetention:.6,keyForce:.98,keyStroke:2,
 homeSkill:.95,extensionSkill:.3,stairSkill:.25,keimaSkill:.35,independence:.55
};
export const SKILL_KEYS=['homeSkill','extensionSkill','stairSkill','keimaSkill','independence'];
const resolvedParameters=new WeakSet();
export function parameters(input={}){
 const p={...HUMAN_DEFAULTS,...input};
 for(const k of Object.keys(HUMAN_DEFAULTS)){
  if(!Number.isFinite(p[k]))throw Error('Invalid human parameter: '+k);
  if(SKILL_KEYS.includes(k)){if(p[k]<0||p[k]>1)throw Error('Skill must be between 0 and 1: '+k);}
  else if(k==='scratchY'){if(Math.abs(p[k])>300)throw Error('Invalid scratch offset');}
  else if(p[k]<=0)throw Error('Human parameter must be positive: '+k);
 }
 if(p.scratchAngle>60||p.scratchRadius<30||p.scratchRadius>200)throw Error('Invalid turntable geometry');
 resolvedParameters.add(p);return p;
}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],(a[2]??0)-(b[2]??0));
export function keyPosition(lane,input={}){
 const p=resolvedParameters.has(input)?input:{...HUMAN_DEFAULTS,...input};
 return lane===0?[6*p.keyPitch+p.scratchGap,p.scratchY,p.scratchHeight]:[(lane-1)*p.keyPitch,lane%2===0?-p.rowOffset:0,0];
}
// A button is an area, not an infinitesimal centre. Aim inside its central 80%.
export function keyTarget(lane,from,p){
 const c=keyPosition(lane,p),clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
 return [clamp(from[0],c[0]-.4*p.targetWidth,c[0]+.4*p.targetWidth),clamp(from[1],c[1]-.4*p.keyDepth,c[1]+.4*p.keyDepth),0];
}
export function movementTime(d,input={}){
 return .035+.045*Math.log2(1+d/(input.targetWidth??HUMAN_DEFAULTS.targetWidth));
}
export function ergonomicCost(keys,assignment,state,time,p){
 let extension=0,crossing=0,coupling=0;
 for(const k of keys)if(assignment[k]!==HOME_FINGERS[k])extension+=.35+.8*(1-p.extensionSkill);
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const a=keys[i],b=keys[j],fa=assignment[a],fb=assignment[b];
  if(fa>fb)crossing+=.45*(1+(b-a)/6);
  if(Math.abs(fa-fb)===1&&a%2!==b%2)coupling+=(Math.min(fa,fb)===2?.4:.16)*(1-.5*p.independence);
 }
 const dt=time-state.lastTime;
 if(dt>0&&dt<.2)for(const k of keys){
  const f=assignment[k];
  if(state.lastFingers?.some(old=>Math.abs(f-old)===1&&Math.min(f,old)>=2))coupling+=.25*(1-dt/.2)*(1-.5*p.independence);
 }
 const pressWork=keys.length*p.keyForce*p.keyStroke; // N*mm = mJ
 return {extension,crossing,coupling,pressWork,ergonomic:crossing+coupling+keys.length*.04*p.keyForce/.98};
}
export function recognitionCost(keys,state,time,p,palm=false){
 const sig=keys.join(','),same=sig===state.lastKeys.join(','),dt=time-state.lastTime;
 const trill=keys.length===1&&sig===state.priorKeys.join(',')&&!same&&dt<.5;
 const stair=keys.length===1&&state.lastKeys.length===1&&state.priorKeys.length===1&&dt<.5&&state.lastInterval<.5&&keys[0]!==state.lastKeys[0]&&Math.abs(keys[0]-state.lastKeys[0])<=2&&(keys[0]-state.lastKeys[0])===(state.lastKeys[0]-state.priorKeys[0]);
 const near=dt<.16?[...new Set([...keys,...state.lastKeys])]:keys;
 let keimaPairs=0;for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++)if(Math.abs(near[i]-near[j])===3)keimaPairs++;
 const homeShape=keys.length>0&&new Set(keys.map(k=>HOME_FINGERS[k])).size===keys.length;
 const seen=state.familiar.get(sig),familiar=seen&&time-seen.time<p.memorySeconds?Math.min(3,seen.count):0;
 const rhythm=state.lastInterval>.03&&dt<1?Math.min(2,Math.abs(Math.log2(Math.max(.02,dt)/state.lastInterval))):0;
 const changes=keys.filter(k=>!state.lastKeys.includes(k)).length+state.lastKeys.filter(k=>!keys.includes(k)).length;
 const base=(.25+changes*.12+rhythm*.25)*(homeShape?1-.65*p.homeSkill:1);
 const repeated=same||trill;
 const sequence=stair?(.25+Math.min(2,.2/Math.max(.035,dt))*.45)*(1-p.stairSkill):0;
 const keima=Math.min(3,keimaPairs)*.3*(1-p.keimaSkill);
 const recognition=(base*(repeated?.55:1)+sequence+keima)/(1+familiar*.15);
 return {sig,seen,same,trill,stair,keimaPairs,homeShape,recognition,sequence,keima,
  pattern:palm?'全押し':stair?'階段':same?'同形反復':trill?'トリル':keimaPairs?'桂馬を含む':homeShape?'ホーム配置':'配置変化'};
}

import {HUMAN_DEFAULTS,SKILL_KEYS} from './ergonomics.mjs';
import {TIMING_DEFAULTS,TIMING_LIMITS,timingParameters} from './timing.mjs';
// Explicit limits for the public simulation API. Values are model settings,
// not validated measurements of an individual or a specific cabinet.
export const HUMAN_LIMITS={
 handSpan:[100,260],readAhead:[.1,2],keyPitch:[15,30],rowOffset:[30,80],
 targetWidth:[10,30],keyDepth:[20,50],scratchGap:[30,130],scratchY:[-150,100],
 scratchHeight:[1,50],scratchRadius:[50,150],scratchAngle:[1,30],
 scratchInertia:[.0001,.02],scratchTorque:[.001,.2],
 scratchPushForce:[.5,10],scratchPullForce:[.5,10],keyForce:[.1,3],keyStroke:[.5,5],
 ...Object.fromEntries(SKILL_KEYS.map(k=>[k,[0,1]]))
};
export function simulationProfile(params){
 function number(name,value,min,max){const raw=params.get(name),v=raw===null?value:Number(raw);if(raw===''||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid parameter: '+name);return v;}
 const profile={capacity:number('capacity',9,.25,32),left:number('left',.9,.5,1.5),scratch:number('scratch',1,.5,1.5),technique:params.get('technique')??'flexible',human:{}};
 if(!['home','flexible'].includes(profile.technique))throw Error('Invalid technique');
 for(const [name,[min,max]] of Object.entries(HUMAN_LIMITS))profile.human[name]=number(name,HUMAN_DEFAULTS[name],min,max);
 profile.timing={};for(const [name,[min,max]] of Object.entries(TIMING_LIMITS))profile.timing[name]=number(name,TIMING_DEFAULTS[name],min,max);timingParameters(profile.timing);
 const optionIndex=number('option',0,0,7);if(!Number.isInteger(optionIndex))throw Error('Invalid option');
 return {profile,optionIndex};
}

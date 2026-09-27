// Relative geometry, not measured cabinet dimensions. One horizontal step is
// one adjacent-lane pitch. All hands are normalized to right-hand coordinates.
export const HUMAN_DEFAULTS={keyPitch:1,rowOffset:.8,targetWidth:.8,scratchX:9.5,handSpan:6,readAhead:.65,memorySeconds:2,fingerRecovery:.075};
const home=[1,2,4,6,7],choices=[[0],[1,0],[1,0,2],[2,1],[3,2,0],[3,2],[4]],cache=new Map();
export function keyPosition(lane,p={}){p={...HUMAN_DEFAULTS,...p};return lane===0?[p.scratchX*p.keyPitch,.2*p.keyPitch]:[(lane-1)*p.keyPitch,lane%2===0?-p.rowOffset*p.keyPitch:0];}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function movementTime(d,p={}){p={...HUMAN_DEFAULTS,...p};return .035+.045*Math.log2(1+d/(p.targetWidth*p.keyPitch));}
function assignments(keys,technique){const key=keys.join(',')+technique;if(cache.has(key))return cache.get(key);const out=[];
 function walk(i,a,used,cost){if(i===keys.length){out.push({a,cost});return;}const lane=keys[i];for(const f of technique==='home'?[([0,0,1,1,2,3,3,4])[lane]]:choices[lane-1])walk(i+1,{...a,[lane]:f},[...used,f],cost+(used.includes(f)?3:0)+Math.abs(home[f]-lane)*.07);}
 walk(0,{},[],0);out.sort((a,b)=>a.cost-b.cost);const kept=out.slice(0,12);cache.set(key,kept);return kept;
}
const signature=keys=>keys.join(',');
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
export function humanFeatures(chart,profile={}){
 const p={...HUMAN_DEFAULTS,...profile.human};
 for(const key of Object.keys(HUMAN_DEFAULTS))if(!Number.isFinite(p[key])||p[key]<=0)throw Error('Invalid human parameter: '+key);
 const states=[0,1].map(()=>({positions:home.map(l=>keyPosition(l,p)),times:Array(5).fill(-10),lastTime:-10,lastKeys:[],priorKeys:[],lastInterval:0,history:[],familiar:new Map(),fatigue:Array(5).fill(0),scratch:false}));
 const groups=[];for(const e of chart.events){let g=groups.at(-1);if(!g||Math.abs(g.time-e.time)>1e-6){g={time:e.time,events:[]};groups.push(g);}g.events.push(e);}
 const actions=[],lookup=new Map();
 for(let index=0;index<groups.length;index++){
  const group=groups[index],sideKeys=[0,1].map(hand=>[...new Set(group.events.filter(e=>e.hand===hand&&e.lane>0&&e.kind!=='tail').map(e=>hand===0?8-e.lane:e.lane))].sort((a,b)=>a-b));
  for(let hand=0;hand<2;hand++){
   const es=group.events.filter(e=>e.hand===hand);if(!es.length)continue;
   const state=states[hand],keys=sideKeys[hand],scratch=es.some(e=>e.lane===0),dt=group.time-state.lastTime;
   const held=(chart.holds||[]).filter(h=>h.hand===hand&&h.start<group.time-1e-6&&h.end>group.time+1e-6),heldKeys=held.filter(h=>h.lane).map(h=>hand===0?8-h.lane:h.lane);
   const occupied=[...new Set([...keys,...heldKeys])].sort((a,b)=>a-b),palm=keys.length===7&&!scratch&&!held.length;
   let best={a:{},cost:0,travel:0,strain:0,reach:0,required:0,lookahead:0},bestScore=Infinity;
   for(const c of palm?[{a:{},cost:.25}]:assignments(occupied,profile.technique)){
    let travel=0,strain=0,reach=0,required=0,locked=0;
    for(const lane of heldKeys){const prior=state.assignment?.[lane];if(prior!==undefined&&prior!==c.a[lane])locked+=4;}
    for(const lane of keys){const f=c.a[lane];if(f===undefined)continue;
     const target=keyPosition(lane,p),d=distance(state.positions[f],target),available=Math.max(.015,group.time-state.times[f]),need=Math.max(p.fingerRecovery,movementTime(d,p))*(f>=3?1.13:1);
     travel+=d;required=Math.max(required,need);strain+=Math.max(0,need/available-1);reach+=distance(keyPosition(home[f],p),target)/p.handSpan;
    }
    // Bounded one-action preview; no knowledge beyond the visible read-ahead.
    let lookahead=0,next;
    for(let j=index+1;j<Math.min(groups.length,index+8);j++){if(groups[j].time-group.time>p.readAhead)break;const ns=groups[j].events.filter(e=>e.hand===hand&&e.lane>0);if(ns.length){next=ns;break;}}
    if(next){for(const e of next){const lane=hand===0?8-e.lane:e.lane;lookahead+=Math.min(...choices[lane-1].map(f=>{const current=keys.find(k=>c.a[k]===f);return distance(current?keyPosition(current,p):state.positions[f],keyPosition(lane,p));}));}lookahead/=next.length;}
    const span=keys.length?distance(keyPosition(keys[0],p),keyPosition(keys.at(-1),p)):0;reach+=Math.max(0,span/p.handSpan-1)*2;
    const score=c.cost+locked+strain+reach*.3+lookahead*.12;
    if(score<bestScore){bestScore=score;best={a:c.a,cost:c.cost+locked,travel,strain,reach,required,lookahead};}
   }
   const sig=signature(keys),same=sig===signature(state.lastKeys),trill=keys.length===1&&sig===signature(state.priorKeys)&&!same;
   const stair=keys.length===1&&state.lastKeys.length===1&&state.priorKeys.length===1&&Math.abs(keys[0]-state.lastKeys[0])<=2&&(keys[0]-state.lastKeys[0])===(state.lastKeys[0]-state.priorKeys[0]);
   const seen=state.familiar.get(sig),familiar=seen&&group.time-seen.time<p.memorySeconds?Math.min(3,seen.count):0;
   const rhythm=state.lastInterval>.03&&dt<1?Math.min(2,Math.abs(Math.log2(Math.max(.02,dt)/state.lastInterval))):0;
   const changes=keys.filter(k=>!state.lastKeys.includes(k)).length+state.lastKeys.filter(k=>!keys.includes(k)).length;
   const chunk=same||trill||stair;
   const recognition=(.25+changes*.12+rhythm*.25)*(chunk?.45:1)/(1+familiar*.15);
   const both=sideKeys[0].length&&sideKeys[1].length,coordination=both?(signature(sideKeys[0])===signature(sideKeys[1])?.10:.35):.05;
   const scratchDistance=scratch?distance(keyPosition(0,p),keyPosition(state.lastKeys.at(-1)||7,p)):state.scratch&&keys.length?distance(keyPosition(0,p),keyPosition(keys[0],p)):0;
   const landing=scratchDistance?Math.max(0,movementTime(scratchDistance,p)/Math.max(.02,dt)-.5):0;
   const simultaneousReach=scratch&&keys.length?Math.max(...keys.map(k=>distance(keyPosition(k,p),keyPosition(0,p))))/p.handSpan:0;
   const scratchCost=(scratch?.6:0)+landing+simultaneousReach*1.5;
   state.history.push({time:group.time,weight:palm?1.5:1+Math.max(0,keys.length-1)*.22+(scratch?.5:0)});
   while(state.history[0]?.time<group.time-1)state.history.shift();
   const motorRate=state.history.reduce((s,e)=>s+e.weight,0);
   for(let f=0;f<5;f++){state.fatigue[f]*=Math.exp(-Math.max(0,dt)/2.5);if(Object.values(best.a).includes(f))state.fatigue[f]+=.05;}
   const fatigue=avg(state.fatigue),movement=best.cost+best.strain,side=hand===0?(profile.left??.9):(profile.right??1);
   const demand=(.65*motorRate+movement*1.3+best.reach*.7+recognition*1.6+coordination+fatigue+scratchCost/(profile.scratch??1)+held.length*.35)/side;
   const action={time:group.time,hand,measure:es[0].measure,keys,scratch,assignment:best.a,palm,pattern:palm?'全押し':same?'同形反復':trill?'トリル':stair?'階段':'変化',recognition,movement,reach:best.reach,coordination,fatigue,travel:best.travel,scratchDistance,requiredMs:best.required*1000,intervalMs:Math.min(10,dt)*1000,demand};
   actions.push(action);lookup.set(group.time.toFixed(6)+':'+hand,action);
   for(const lane of keys){const f=best.a[lane];if(f!==undefined){state.positions[f]=keyPosition(lane,p);state.times[f]=group.time;}}
   if(palm||scratch){state.positions=home.map(l=>scratch?keyPosition(0,p):keyPosition(l,p));state.times=Array(5).fill(group.time);}
   state.familiar.set(sig,{time:group.time,count:seen&&group.time-seen.time<p.memorySeconds?seen.count+1:1});
   state.priorKeys=state.lastKeys;state.lastKeys=keys;state.lastInterval=dt;state.lastTime=group.time;state.scratch=scratch;state.assignment=best.a;
  }
 }
 const events=chart.events.map(e=>({...e,...lookup.get(e.time.toFixed(6)+':'+e.hand)}));
 const metrics={recognition:avg(actions.map(a=>a.recognition)),movement:avg(actions.map(a=>a.movement)),reach:avg(actions.map(a=>a.reach)),coordination:avg(actions.map(a=>a.coordination)),fatigue:avg(actions.map(a=>a.fatigue)),movementDistance:actions.reduce((s,a)=>s+a.travel+a.scratchDistance,0),patternReuse:actions.filter(a=>['同形反復','トリル','階段'].includes(a.pattern)).length/Math.max(1,actions.length)};
 return {events,metrics,actions,parameters:p};
}

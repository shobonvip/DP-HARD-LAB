const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)]??0;
const round=n=>+n.toFixed(3);
// Keyboard-only counterfactual actions: no scratch effort or scratch return.
// Two-second bins include silence. Values are model units, not measured fatigue.
export function keyboardLoad(chart,actions){
 const duration=Math.max(1,chart.duration),bins=Array.from({length:Math.ceil(duration/2)},()=>[[],[]]);
 for(const a of actions)if(a.keys.length)bins[Math.min(bins.length-1,Math.floor(a.time/2))][a.hand].push(a);
 const timeline=bins.map((sides,i)=>{
  const width=Math.min(2,duration-i*2);
  const load=sides.map(as=>{
   const activity=Math.min(1,as.length/(width*3));
   return {physical:mean(as.map(a=>a.physical))*activity,technical:mean(as.map(a=>a.cognitive+a.movement*1.3/(a.hand===0?.9:1)))*activity};
  });
  return [i*2,...load.map(x=>round(x.physical)),...load.map(x=>round(x.technical))];
 });
 const physical=timeline.map(b=>Math.max(b[1],b[2])),technical=timeline.map(b=>Math.max(b[3],b[4]));
 const threshold=percentile(physical,.75)*.65;let run=0,longest=0,rest=0,active=0;
 for(let i=0;i<timeline.length;i++){const width=Math.min(2,duration-i*2);if(threshold>0&&physical[i]>=threshold){run+=width;active+=width;longest=Math.max(longest,run);}else run=0;if(physical[i]<threshold*.3||physical[i]===0)rest+=width;}
 const typical=mean(physical),peak=percentile(physical,.95),spike=peak/Math.max(.1,typical);
 const staminaScore=typical*(active/duration)*Math.sqrt(longest/duration)/Math.sqrt(Math.max(1,spike));
 const techMean=mean(technical),techPeak=percentile(technical,.95),techCoverage=technical.filter(x=>x>=techPeak*.5&&x>0).length/timeline.length;
 const techniqueScore=techMean*techCoverage/Math.sqrt(Math.max(1,techPeak/Math.max(.1,techMean)));
 const keyActions=actions.filter(a=>a.keys.length);
 const components={recognition:mean(keyActions.map(a=>a.recognition*1.6)),movement:mean(keyActions.map(a=>a.movement*1.3)),switching:mean(keyActions.map(a=>a.placementExtra)),extension:mean(keyActions.map(a=>a.extension))};
 return {timeline,physicalMean:round(typical),physicalPeak:round(peak),technicalMean:round(techMean),technicalPeak:round(techPeak),threshold:round(threshold),sustainedSeconds:round(active),longestSeconds:round(longest),restSeconds:round(rest),components:Object.fromEntries(Object.entries(components).map(([k,v])=>[k,round(v)])),staminaScore:round(staminaScore),techniqueScore:round(techniqueScore)};
}

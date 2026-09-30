// Display calibration only: simulation results and ordering remain unchanged.
export function buildStarScale(rows) {
 const anchors=[];
 for(let level=5;level<=12;level++){
  const values=rows.filter(r=>r.level===level&&Number.isFinite(r.analysis?.requiredCapacity)).map(r=>r.analysis.requiredCapacity).sort((a,b)=>a-b);
  if(values.length<10)continue;
  const i=Math.floor(values.length/2),capacity=values.length%2?values[i]:(values[i-1]+values[i])/2;
  if(anchors.length&&capacity<=anchors.at(-1).capacity)throw Error('Star scale anchors must increase');
  anchors.push({level,capacity,count:values.length});
 }
 if(anchors.length<2)throw Error('Not enough reference charts for star scale');
 return {version:2,anchors,definition:'公式難度ごとの必要能力中央値を同じ☆に対応させ、間を線形補間。10譜面未満の難度は基準に使わない。基準範囲外は外挿。☆12の基準点は対象☆12譜面のモデル中央値で、実プレイでは未校正。'};
}
export function hardStar(capacity,scale){
 const a=scale.anchors;
 let i=a.findIndex(x=>capacity<=x.capacity);i=i<0?a.length-1:Math.max(1,i);
 const lo=a[i-1],hi=a[i];
 return {value:Math.round((lo.level+(capacity-lo.capacity)/(hi.capacity-lo.capacity)*(hi.level-lo.level))*10)/10,extrapolated:capacity<a[0].capacity||capacity>a.at(-1).capacity};
}

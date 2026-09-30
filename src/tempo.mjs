export function chartTempo(chart){
 const values=[...new Set((chart.tempos??[]).map(t=>Number(t.bpm)).filter(v=>Number.isFinite(v)&&v>0))];
 if(!values.length)return null;
 const min=Math.min(...values),max=Math.max(...values);
 return {min,max,variable:max-min>1e-6,bpm:max-min>1e-6?`${min}～${max}`:String(min)};
}

// A view of research results containing every field consumed by public/app.js.
// Full raw results remain available in lossless gzip files for analysis.
export function displayResult(raw){
 const r=structuredClone(raw);
 delete r.random.draws;delete r.standard;delete r.bestMetrics;
 r.selected.traces=r.selected.traces.slice(0,4).map(points=>points.map(p=>({time:Math.round(p.time*100)/100,gauge:Math.round(p.gauge*100)/100})));
 r.segments=r.segments.length?[{time:Math.round(r.segments.at(-1).time*100)/100}]:[];
 if(r.human)r.human.actions=r.human.actions.slice(0,5);
 if(r.free)r.free={strategies:r.free.strategies.map(s=>({name:s.name,required:s.required,censored:s.censored,simulation:{clearRate:s.simulation.clearRate,interval:s.simulation.interval}}))};
 return r;
}

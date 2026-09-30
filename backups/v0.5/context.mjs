// A bounded visible phrase, with recent history. No song-specific adjustments.
export function phraseContexts(groups,p){
 const result=new Map();
 for(const hand of [0,1]){
  const rows=groups.flatMap(g=>{const es=g.events.filter(e=>e.hand===hand&&e.kind!=='tail');return es.length?[{time:g.time,keys:[...new Set(es.filter(e=>e.lane).map(e=>hand?e.lane:8-e.lane))].sort((a,b)=>a-b),scratch:es.some(e=>e.lane===0)}]:[];});
  for(let i=0;i<rows.length;i++){
   const current=rows[i];let lo=i,hi=i;
   while(lo>0&&i-lo<7&&current.time-rows[lo-1].time<=p.memorySeconds)lo--;
   while(hi+1<rows.length&&hi-i<7&&rows[hi+1].time-current.time<=p.readAhead)hi++;
   let colorFlow=0,phraseReuse=0,visibleNotes=hi-i;
   // Require different keys and a steady rhythm; a jack does not get this relief.
   for(let start=Math.max(lo,i-2);start<=i&&start+2<=hi;start++){
    const a=rows.slice(start,start+3),d1=a[1].time-a[0].time,d2=a[2].time-a[1].time;
    if(a.some(x=>x.scratch||x.keys.length!==1)||d1<=0||d2<=0||Math.max(d1,d2)>.35||Math.abs(d1-d2)>.15*Math.max(d1,d2))continue;
    const k=a.map(x=>x.keys[0]);
    if(new Set(k).size===3&&k.every(x=>x%2===k[0]%2))colorFlow=1;
   }
   // A recurring 3–6 action phrase must be visible or already encountered twice.
   for(let length=3;length<=6;length++)for(let start=Math.max(lo,i-2*length+1);start<=i&&start+2*length-1<=hi;start++){
    const a=rows.slice(start,start+length),b=rows.slice(start+length,start+2*length);
    if(a.some(x=>x.scratch||x.keys.length!==1)||b.some(x=>x.scratch||x.keys.length!==1)||new Set(a.map(x=>x.keys[0])).size<3)continue;
    if(a.some((x,j)=>x.keys[0]!==b[j].keys[0]))continue;
    const intervals=rows.slice(start+1,start+2*length).map((x,j)=>x.time-rows[start+j].time),mean=intervals.reduce((s,x)=>s+x,0)/intervals.length;
    if(mean>0&&mean<=.35&&intervals.every(x=>Math.abs(x-mean)<=mean*.15))phraseReuse=1;
   }
   result.set(current.time.toFixed(6)+':'+hand,{colorFlow,phraseReuse,visibleNotes,ease:Math.max(colorFlow*p.colorSkill,phraseReuse*p.phraseSkill)});
  }
 }
 return result;
}

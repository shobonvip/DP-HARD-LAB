export const PRACTICE_VERSION='practice-5';
export const categories=[
 ['stamina','鍵盤地力・体力','シミュレーションの身体負荷が持続し、極端な一瞬の難所に偏らない候補。左右の負荷推移と休憩を確認。'],
 ['technique','鍵盤地力・テクニック','シミュレーションの認識・拡張運指・配置切り替え・指移動の負荷が続く候補。押し方の安定を優先。'],
 ['scratch','皿地力','連皿を含む皿動作。規則性と着地の違いは譜面リンクでも確認。'],
 ['thumb3','親3（右3／左5）','2と3の同時押し・短い移行で、1鍵や皿が親指を拘束しない候補。3を親指、2を人差し指で試す。'],
 ['thumb5','親5（右5／左3）','3と5の同時押し・短い移行で、1鍵や皿が親指を拘束しない候補。5を親指、3を人差し指で試す。'],
 ['middle56','中5・中6（右5・6／左3・2）','5と6の同時押し・短い移行で、4鍵や皿の拘束がない候補。5を中指／6を薬指、または単鍵6を中指で試す。'],
 ['chords','片手3個以上の同時押し','片手で同時に3鍵以上を新たに押す配置。保持中のCNは鍵数に含めない。'],
 ['smallStair','小階段（3～5鍵）','隣接鍵が一定方向に3～5個続く階段。折り返しは別の階段として数える。'],
 ['largeStair','大階段（6～7鍵）','隣接鍵が一定方向に6～7個続く階段。正規で形を覚えてから左右を入れ替える。'],
 ['colorStair','同色階段','1・3・5・7や2・4・6の連続。隣接階段とは分けて練習。'],
 ['landing','皿→鍵盤の着地','皿の後0.6秒以内に鍵盤へ戻る配置。視線と手の戻し方を練習。'],
 ['repeat','縦連・トリル','同一鍵の反復または単鍵A-B-A。リズムを崩さず、BADハマりを避ける。'],
 ['hold','CN保持中の鍵盤','鍵盤CNを保持しながら別の鍵を打つ配置。保持と動作を分ける練習。'],
 ['independence','左右独立・混フレ','左右で異なるリズムを並行して刻む区間。片側のリズムを保ちながら、もう片側のフレーズを追う練習。']
].map(([id,label,description])=>({id,label,description}));

// Two-measure windows; distinguish independent rhythms from identical streams
// and simple phase-shifted alternation. This detects rhythm, not musical voices.
export function independentWindows(actions){
 const blocks=new Map();
 for(const a of actions)if(a.keys.length&&!a.scratch){const id=Math.floor(a.measure/2);if(!blocks.has(id))blocks.set(id,[[],[]]);blocks.get(id)[a.hand].push(a);}
 const found=[];
 for(const sides of blocks.values()){
  const [l,r]=sides.map(s=>s.sort((a,b)=>a.time-b.time));if(l.length<4||r.length<4)continue;
  const start=Math.min(l[0].time,r[0].time),end=Math.max(l.at(-1).time,r.at(-1).time),span=end-start;
  if(span<=0||sides.some(s=>s.at(-1).time-s[0].time<span*.65))continue;
  const overlap=Math.min(l.at(-1).time,r.at(-1).time)-Math.max(l[0].time,r[0].time);if(overlap<span*.6)continue;
  let matched=0,j=0;for(const a of l){while(j<r.length&&r[j].time<a.time-.015)j++;if(j<r.length&&Math.abs(a.time-r[j].time)<=.015)matched++;}
  const mismatch=1-2*matched/(l.length+r.length);if(mismatch<.2)continue;
  const intervals=s=>s.slice(1).map((a,i)=>a.time-s[i].time).sort((a,b)=>a-b);
  const [li,ri]=[intervals(l),intervals(r)];
  const rhythmDifference=Array.from({length:5},(_,i)=>{const a=li[Math.floor((li.length-1)*i/4)],b=ri[Math.floor((ri.length-1)*i/4)];return Math.abs(a-b)/Math.max(.01,a,b);}).reduce((a,b)=>a+b,0)/5;
  if(rhythmDifference<.15)continue;
  found.push({actions:[...l,...r].sort((a,b)=>a.time-b.time||a.hand-b.hand),start,end,mismatch,rhythmDifference});
 }
 return found;
}

export function practiceFeatures(chart,actions){
 const out=Object.fromEntries(categories.map(c=>[c.id,{count:0,hands:[0,0],measures:new Set(),examples:[]}]));
 const add=(id,a,weight=1)=>{const v=out[id];v.count+=weight;v.hands[a.hand]+=weight;v.measures.add(a.measure);if(v.examples.length<6)v.examples.push({time:+a.time.toFixed(2),measure:a.measure,hand:a.hand,keys:a.keys.map(k=>a.hand===0?8-k:k).sort((a,b)=>a-b)});};
 const duration=Math.max(1,chart.duration),bins=new Map();
 for(const a of actions){
  if(a.keys.length){const k=`${a.hand}:${Math.floor(a.time/8)}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(a);}
  if(!a.scratch&&(a.placementTransitionLoad>.08||a.extension>.2))add('technique',a);
  if(a.scratch)add('scratch',a);
  if(a.keys.length>=3)add('chords',a);
  if(a.keys.length&&(chart.holds??[]).some(h=>h.hand===a.hand&&h.lane>0&&h.start<a.time-1e-6&&h.end>a.time+1e-6))add('hold',a);
 }
 for(const block of bins.values())if(block.length>=16&&block.at(-1).time-block[0].time>=5)for(const action of block)add('stamina',action);
 const independence=independentWindows(actions);
 for(const window of independence)for(const action of window.actions)add('independence',action);
 out.independence.windows=independence.map(w=>({start:+w.start.toFixed(2),end:+w.end.toFixed(2),left:w.actions.filter(a=>a.hand===0).length,right:w.actions.filter(a=>a.hand===1).length,mismatch:+w.mismatch.toFixed(3)}));
 for(const hand of [0,1]){
  const side=actions.filter(a=>a.hand===hand);let prev,prev2;
  for(const a of side){
   const dt=prev?a.time-prev.time:Infinity;
   const held=(chart.holds??[]).filter(h=>h.hand===hand&&h.start<a.time-1e-6&&h.end>a.time+1e-6).map(h=>h.lane===0?0:hand===0?8-h.lane:h.lane);
   const occupied=[...a.keys,...held],ready=!a.scratch&&!a.palm&&!held.includes(0)&&a.keys.length<=4;
   const nearby=k=>a.keys.includes(k)||(dt>=.08&&dt<=.45&&prev?.keys.length===1&&prev.keys[0]===k&&!prev.scratch);
   if(ready&&!occupied.includes(1)&&a.keys.includes(3)&&nearby(2))add('thumb3',a);
   if(ready&&!occupied.includes(1)&&a.keys.includes(5)&&nearby(3))add('thumb5',a);
   if(ready&&!occupied.includes(4)&&((a.keys.includes(5)&&nearby(6))||(a.keys.includes(6)&&!a.keys.includes(5)&&nearby(5))))add('middle56',a);
   if(prev?.scratch&&a.keys.length&&!a.scratch&&dt<=.6)add('landing',a);
   if(a.keys.length===1&&prev?.keys.length===1&&dt>=.04&&dt<=.3&&(a.keys[0]===prev.keys[0]||(prev2?.keys.length===1&&prev2.keys[0]===a.keys[0]&&prev.time-prev2.time<=.3)))add('repeat',a);
   prev2=prev;prev=a;
  }
  for(const step of [1,2]){
   let run=[],direction=0;
   const finish=()=>{if(run.length>=3)add(step===2?'colorStair':run.length<=5?'smallStair':'largeStair',run[0]);};
   for(const a of side){
    if(a.keys.length!==1||a.scratch){finish();run=[];direction=0;continue;}
    const last=run.at(-1),delta=last?a.keys[0]-last.keys[0]:0,dt=last?a.time-last.time:0;
    if(last&&Math.abs(delta)===step&&dt>=.04&&dt<=.65&&(!direction||Math.sign(delta)===direction)){run.push(a);direction=Math.sign(delta);}
    else {finish();run=last&&Math.abs(delta)===step&&dt>=.04&&dt<=.65?[last,a]:[a];direction=run.length===2?Math.sign(delta):0;}
   }
   finish();
  }
 }
 const scratchRate=actions.filter(a=>a.scratch).length/Math.max(1,actions.length);
 const demands=actions.map(a=>a.demand).sort((a,b)=>a-b),median=demands[Math.floor(demands.length*.5)]||1,peak=demands[Math.floor(demands.length*.95)]||median;
 for(const [id,v] of Object.entries(out)){
  v.sections=v.measures.size;delete v.measures;
  // Frequency and distribution are useful practice proxies, not skill-gain estimates.
  const distraction=['scratch','landing'].includes(id)?1:Math.max(.35,1-scratchRate*2);
  v.score=+(v.count*60/duration*Math.sqrt(v.sections/(v.sections+5))*distraction/Math.sqrt(Math.max(1,peak/median))).toFixed(3);
 }
 return out;
}

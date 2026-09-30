import {chartData,table} from './source-reader.mjs';
const b64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function catalog(titles,levels,counts,{practice=false}={}) {
  const t=table(titles,'titletbl'), a=table(levels,'actbl'), d=table(counts,'datatbl'),out=[];
  for(const [tag,v]of Object.entries(a)){
    if(v[0]===5||!(v[0]&1)||!t[tag])continue;
    for(const [index,difficulty,letter] of [[7,'NORMAL','N'],[8,'HYPER','H'],[9,'ANOTHER','A'],[10,'LEGGENDARIA','X']]){
      const level=v[index*2+1], flags=v[index*2+2];
      if(!(flags&4)||!((level>=10&&level<=12)||(difficulty==='ANOTHER'&&level>=5&&level<=9)||(practice&&level>=7&&level<=9&&['NORMAL','HYPER'].includes(difficulty))))continue;
      const version=t[tag][0]===35?'s':t[tag][0];
      out.push({id:`${tag}-${letter}`,tag,title:[t[tag][5],t[tag][6]].filter(Boolean).join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&'),difficulty,level,version,notes:d[tag]?.[index]??null,bpm:d[tag]?.[11]??null,sourceUrl:`https://textage.cc/score/${version}/${tag}.html?D${letter}${level.toString(16).toUpperCase()}00`,available:!!(flags&1),chargeFlag:!!(flags&8)});
    }
  }
  return out;
}

export function decodeMeasure(s='',length=384) {
  const notes=[];
  const add=(tick,lane)=>{if(!Number.isFinite(tick)||lane<0||lane>7||tick<0||tick>=length)throw Error('Invalid note');notes.push({tick,lane:+lane});};
  if(!s)return notes;
  if(s[0]!=='#'){
    let i=0,div=0,len=s.length;
    if(s[0]==='x'){len=parseInt(s.slice(1,4),16);i=4;}
    for(;i<s.length;i+=2,div+=2){while(s[i]==='@'){div+=parseInt(s.slice(i+1,i+3),16)*2;i+=3;}if(i>=s.length)break;const mask=parseInt(s.slice(i,i+2),16);if(!Number.isFinite(mask))throw Error('Bad hex notes');for(let lane=0;lane<8;lane++)if(mask&(1<<lane))add(length*div/len,lane);}
    return notes;
  }
  const steps={C:[0,192,0],c:[96,192,0],R:[0,96,0],r:[48,96,0],P:[0,48,0],p:[24,48,0],B:[0,192,1],b:[96,192,1],Q:[0,96,1],q:[48,96,1],O:[0,48,1],o:[24,48,1],X:[0,24,1],x:[12,24,1],Z:[0,12,1],S:[0,64,1],s:[32,64,1],T:[0,32,1],t:[16,32,1],U:[0,16,1]};
  let i=1,scratch=false;
  const pos=(x)=>{if(x.length!==2||[...x].some(c=>!b64.includes(c)))throw Error('Bad packed position');return b64.indexOf(x[0])*64+b64.indexOf(x[1]);};
  while(i<s.length){const c=s[i++];
    if(c==='-'){scratch=true;continue;}
    if(c==='_'){let rest=s.slice(i)||'AA';for(let j=0;j<rest.length;j+=2)add(pos(rest.slice(j,j+2)),0);break;}
    if(steps[c]){
      const [offset,step,packed]=steps[c];let lanes;
      if(!packed){const lane=scratch?0:Number(s[i++]);for(let t=offset;t<length;t+=step)if(scratch||lane)add(t,lane);}
      else {const count=Math.ceil((scratch?1:3)*length/6/step),data=s.slice(i,i+count);i+=count;lanes=[];for(const char of data){const v=b64.indexOf(char);if(v<0)throw Error('Bad base64');if(scratch)for(let bit=5;bit>=0;bit--)lanes.push((v>>bit)&1);else lanes.push(v>>3,v&7);}for(let t=offset,j=0;t<length;t+=step,j++)if(lanes[j])add(t,scratch?0:lanes[j]);}
    }else if(/[1-7]/.test(c)){const tick=pos(s.slice(i,i+2));i+=2;add(tick,scratch?0:Number(c));}
    else if(c==='8'||c==='9'){const mask=b64.indexOf(s[i++]),tick=pos(s.slice(i,i+2));i+=2;if(c==='9')add(tick,1);for(let j=0;j<6;j++)if(mask&(1<<j))add(tick,j+2);}
    else throw Error('Unknown packed opcode '+c);
  }
  return notes;
}

export function parseChart(html,meta){
  const d=chartData(html,meta.difficulty),events=[],tempos=[],offsets=[];
  let total=0;
  for(let m=0;m<=d.measure;m++){offsets[m]=total;total+=d.ln[m]||d.LNDEF;}
  let initial=Number(d.bpm);
  for(let m=0;m<=d.measure;m++)for(const tc of d.tc[m]||[]){const bpm=Number(tc.slice(0,3)),position=tc.slice(3);if(!/^[\d.]+$/.test(position))throw Error('Tempo position expression unsupported');tempos.push({tick:offsets[m]+Number(position)*3,bpm});}
  tempos.sort((a,b)=>a.tick-b.tick);
  if(!Number.isFinite(initial))initial=tempos[0]?.bpm;
  if(!(initial>0))throw Error('Initial BPM missing');
  if(!tempos.length||tempos[0].tick>0)tempos.unshift({tick:0,bpm:initial});
  let secs=0;tempos.forEach((t,i)=>{if(i)secs+=(t.tick-tempos[i-1].tick)/96*60/tempos[i-1].bpm;t.seconds=secs;});
  const seconds=tick=>{let t=tempos[0];for(const next of tempos){if(next.tick>tick)break;t=next;}return t.seconds+(tick-t.tick)/96*60/t.bpm;};
  const holds=[];
  for(let hand=0;hand<2;hand++){
    const arr=hand?d.dp:d.sp,cn=hand?d.c2:d.c1;
    for(let m=0;m<=d.measure;m++){
      let decoded;try{decoded=decodeMeasure(arr[m],d.ln[m]||d.LNDEF);}catch(e){throw Error(`${e.message} (hand ${hand}, measure ${m}, data ${arr[m]})`);}
      for(const note of decoded)events.push({time:seconds(offsets[m]+note.tick),hand,lane:note.lane,measure:m+d.gap,kind:'tap'});
      for(const c of cn[m]||[]){const flags=c[3]??3, lanes=c[0]<10?[c[0]]:[c[0]%10,Math.floor(c[0]/10)],start=offsets[m]+c[1]*3,end=start+(c[2]??30)*3;
        for(const lane of lanes){holds.push({start:seconds(start),end:seconds(end),hand,lane,flags});if(flags&1)events.push({time:seconds(start),hand,lane,measure:m+d.gap,kind:'head'});if(flags&2)events.push({time:seconds(end),hand,lane,measure:m+d.gap,kind:'tail'});}
      }
    }
  }
  events.sort((a,b)=>a.time-b.time||a.hand-b.hand||a.lane-b.lane);
  if(!events.length)throw Error('No notes');
  if(events.length!==d.notes)throw Error(`Note count mismatch: parsed ${events.length}, page ${d.notes}`);
  if(meta.notes&&events.length!==meta.notes)throw Error(`Catalog note mismatch: ${events.length} vs ${meta.notes}`);
  return {...meta,events,holds,tempos,duration:events.at(-1).time,hcn:!!d.hcn,sourceNotes:d.notes,parserVersion:'0.1.0',warnings:[...(holds.length?['CN/BSS拘束と端点を近似。HCNの継続増減・押し直しは未再現。']:[]),...(tempos.length>1?['ソフランの認識・HS操作コストは未校正。']:[])]};
}


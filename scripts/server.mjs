import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {extract,simulate,fixedOptions,DEFAULT_PROFILE} from '../src/engine.mjs';
const base=resolve('.'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(path==='/saved.html'){const body=await readFile('DP-HARD-LAB.html');res.writeHead(200,{'Content-Type':mime['.html']});res.end(body);return;}
  if(path==='/api/simulate'){
   const id=url.searchParams.get('id');if(!/^[a-zA-Z0-9_-]+$/.test(id||''))throw Error('Invalid chart');
   const capacity=Number(url.searchParams.get('capacity')||9),left=Number(url.searchParams.get('left')||.9),scratch=Number(url.searchParams.get('scratch')||1),technique=url.searchParams.get('technique')||'flexible',optionIndex=Number(url.searchParams.get('option')||0);
   if(![capacity,left,scratch].every(Number.isFinite)||capacity<.25||capacity>32||left<.5||left>1.5||scratch<.5||scratch>1.5||!['home','flexible'].includes(technique)||!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>7)throw Error('Invalid profile');
   const handSpan=Number(url.searchParams.get('handSpan')||6),readAhead=Number(url.searchParams.get('readAhead')||.65);
   if(![handSpan,readAhead].every(Number.isFinite)||handSpan<3||handSpan>9||readAhead<.1||readAhead>2)throw Error('Invalid geometry');
   const profile={...DEFAULT_PROFILE,capacity,left,scratch,technique,human:{handSpan,readAhead}},chart=JSON.parse(await readFile(`data/charts/${id}.json`,'utf8')),options=fixedOptions(),f=extract(chart,options[optionIndex],profile),simulation=simulate(f,{capacity,trials:256,profile,trace:true});
   res.writeHead(200,{'Content-Type':mime['.json']});res.end(JSON.stringify({simulation,metrics:f.metrics,segments:f.segments,option:options[optionIndex].name}));return;
  }
  const relative=path==='/'?'public/index.html':path.startsWith('/data/')?path.slice(1):path.startsWith('/docs/')?path.slice(1):'public'+path;
  if(!/^data\/(table\.json|difficulty\.csv|coverage\.json|results\/[a-zA-Z0-9_-]+\.json)$/.test(relative)&&!relative.startsWith('public/')&&!relative.startsWith('docs/')){res.writeHead(404);res.end();return;}
  const file=resolve(base,relative);if(!file.startsWith(base+sep))throw Error('Invalid path');
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.code==='ENOENT'?'データを準備中です。':e.message);}
}).listen(port,'127.0.0.1',()=>console.log(`DP HARD LAB: http://127.0.0.1:${port}`));

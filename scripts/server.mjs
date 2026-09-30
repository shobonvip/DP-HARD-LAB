import {createServer} from 'node:http';
import {readFile} from '../src/storage.mjs';
import {readFile as rawReadFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {displayResult} from '../src/payload.mjs';
import {resolve,extname,sep} from 'node:path';
import {extract,simulate,fixedOptions,DEFAULT_PROFILE,MODEL_VERSION} from '../src/engine.mjs';
import {simulationProfile} from '../src/profile.mjs';
const base=resolve('.'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(['/saved.html','/saved-practice.html','/DP-HARD-LAB.html','/DP-PRACTICE.html'].includes(path)){const body=await readFile(['/saved.html','/DP-HARD-LAB.html'].includes(path)?'DP-HARD-LAB.html':'DP-PRACTICE.html');res.writeHead(200,{'Content-Type':mime['.html']});res.end(body);return;}
  if(path==='/api/simulate'){
   const id=url.searchParams.get('id');if(!/^[a-zA-Z0-9_-]+$/.test(id||''))throw Error('Invalid chart');
   const parsed=simulationProfile(url.searchParams),profile={...DEFAULT_PROFILE,...parsed.profile},options=fixedOptions();
   const chart=JSON.parse(await readFile(`data/charts/${id}.json`,'utf8')),f=extract(chart,options[parsed.optionIndex],profile),simulation=simulate(f,{capacity:profile.capacity,trials:256,profile,trace:true});
   const human={parameters:f.humanParameters,actions:[...f.humanActions].sort((a,b)=>b.demand-a.demand).slice(0,10)};
   res.writeHead(200,{'Content-Type':mime['.json']});res.end(JSON.stringify({model:MODEL_VERSION,simulation,metrics:f.metrics,segments:f.segments,option:options[parsed.optionIndex].name,human,profile}));return;
  }
  const relative=path==='/'?'public/index.html':path.startsWith('/data/')?path.slice(1):path.startsWith('/docs/')?path.slice(1):'public'+path;
  if(!/^data\/(table\.json|difficulty\.csv|coverage\.json|results\/[a-zA-Z0-9_-]+\.json)$/.test(relative)&&!relative.startsWith('public/')&&!relative.startsWith('docs/')){res.writeHead(404);res.end();return;}
  const file=resolve(base,relative);if(!file.startsWith(base+sep))throw Error('Invalid path');
  const headers={'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
  const acceptsGzip=/\bgzip\b/.test(req.headers['accept-encoding']??'');let body;
  if(relative.startsWith('data/results/')){
   body=Buffer.from(JSON.stringify(displayResult(JSON.parse(await readFile(file,'utf8')))));
   if(acceptsGzip){body=gzipSync(body);headers['Content-Encoding']='gzip';}
  }else if(acceptsGzip){
   // Fresh uncompressed generation takes precedence over a previous gzip copy.
   try{body=await rawReadFile(file);}catch(e){if(e.code!=='ENOENT')throw e;body=await rawReadFile(file+'.gz');headers['Content-Encoding']='gzip';}
  }else body=await readFile(file);
  res.writeHead(200,headers);res.end(body);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end(e.code==='ENOENT'?'データを準備中です。':e.message);}
}).listen(port,'127.0.0.1',()=>console.log(`DP HARD LAB: http://127.0.0.1:${port}`));

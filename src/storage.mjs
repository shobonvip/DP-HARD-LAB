import {readFile as rawReadFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
// Prefer fresh generated JSON; transparently read lossless stored gzip otherwise.
export async function readFile(path,options){
 try{return await rawReadFile(path,options);}catch(e){
  if(e.code!=='ENOENT')throw e;
  const name=path instanceof URL?fileURLToPath(path):String(path);
  if(!/\.(json|html|csv)$/.test(name))throw e;
  const decoded=gunzipSync(await rawReadFile(name+'.gz'));
  const encoding=typeof options==='string'?options:options?.encoding;
  return encoding?decoded.toString(encoding):decoded;
 }
}

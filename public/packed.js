// gzip-encoded offline JSON. DecompressionStream works without network requests.
async function unpackJson(base64){
 if(typeof DecompressionStream==='undefined')throw Error('この保存版は最新のChrome・Edge・Firefoxで開いてください。');
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

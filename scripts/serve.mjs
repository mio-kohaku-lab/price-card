import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root)throw Error();const target=file===root?path.join(root,'index.html'):file;const data=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'})[path.extname(target)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(5173,'127.0.0.1',()=>console.log('http://localhost:5173'));

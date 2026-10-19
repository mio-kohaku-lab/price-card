import {mkdir,writeFile,access} from 'node:fs/promises';
const files = {
 'tesseract.min.js':'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js',
 'worker.min.js':'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
 'zxing.min.js':'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
 'jsbarcode.min.js':'https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js',
 'jpn.traineddata.gz':'https://tessdata.projectnaptha.com/4.0.0_fast/jpn.traineddata.gz',
 'eng.traineddata.gz':'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz',
 'LICENSE-tesseract.txt':'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/LICENSE.md',
 'LICENSE-zxing.txt':'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/LICENSE',
 'LICENSE-jsbarcode.txt':'https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/MIT-LICENSE.txt'
};
for(const name of ['tesseract-core','tesseract-core-simd','tesseract-core-lstm','tesseract-core-simd-lstm']) for(const ext of ['wasm.js','wasm']) files[`${name}.${ext}`]=`https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/${name}.${ext}`;
await mkdir('vendor',{recursive:true});
for(const [name,url] of Object.entries(files)) {try{await access(`vendor/${name}`);continue;}catch{}const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);await writeFile(`vendor/${name}`,Buffer.from(await r.arrayBuffer()));console.log(name);}

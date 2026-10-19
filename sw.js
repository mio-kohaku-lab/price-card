const CACHE='card-note-v0.2.9-1';
const SHELL=['./','./index.html','./install.js','./refresh.html','./style.css','./app.js','./gestures.js','./scan-policy.js','./core.js','./db.js','./recognition.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./vendor/tesseract.min.js','./vendor/worker.min.js','./vendor/zxing.min.js','./vendor/jsbarcode.min.js','./vendor/jpn.traineddata.gz','./vendor/eng.traineddata.gz',...['tesseract-core','tesseract-core-simd','tesseract-core-lstm','tesseract-core-simd-lstm'].flatMap(n=>[`./vendor/${n}.wasm.js`,`./vendor/${n}.wasm`])];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('card-note-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});


self.addEventListener('message',e=>{if(e.data==='VERSION')e.ports[0]?.postMessage('0.2.9');});

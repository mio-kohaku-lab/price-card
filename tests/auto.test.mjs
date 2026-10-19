import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {CaptureGate} from '../scan-policy.js';
test('自動撮影はバーコード解析を待たず180ms間隔で静止判定し、1回だけ撮影する',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function autoCapture('),source.indexOf('\nfunction cropEditor'));
 const tasks=[];let captures=0;const status={textContent:''},auto={checked:true},guide={classList:{toggle(){},remove(){}}};
 const ctx=vm.createContext({epoch:3,stream:{},busy:false,timer:null,$:s=>s==='#auto'?auto:s==='.guide'?guide:status,
  cameraFrame:size=>{assert.equal(size,96);return {};},sampleFrame:()=>({pixels:[220,20,230],cardLike:true}),
  decode:()=>{assert.fail('撮影前にバーコード解析を呼ばない');},captureCard:()=>captures++,setTimeout:(fn,ms)=>{assert.equal(ms,180);tasks.push(fn);return tasks.length;}});
 vm.runInContext(code,ctx);ctx.autoCapture(3,new CaptureGate());assert.equal(captures,0);
 assert.match(status.textContent,/1\/2/);
 tasks.shift()();assert.equal(captures,1);assert.equal(tasks.length,0);
 ctx.autoCapture(2,new CaptureGate());assert.equal(tasks.length,0);
 auto.checked=false;ctx.autoCapture(3,new CaptureGate());assert.match(status.textContent,/OFF/);assert.equal(captures,1);
});

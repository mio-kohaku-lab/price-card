import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recognize,releaseOCR,enhanceNamePixels} from '../recognition.js';
test('OCRはJANデコード成功時1回、失敗時2回。価格などのOCRを実行しない',async()=>{
 const globals={window:globalThis.window,document:globalThis.document,Tesseract:globalThis.Tesseract,BarcodeDetector:globalThis.BarcodeDetector};
 let decoded=[],calls=0,terminated=0,created=0;const languages=[];
 globalThis.window={Tesseract:true,BarcodeDetector:true};
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},fillRect(){},putImageData(){},getImageData(){return {data:new Uint8ClampedArray([20,20,20,255,200,200,200,255])};}})})};
 globalThis.BarcodeDetector=class{static async getSupportedFormats(){return ['ean_13'];}async detect(){return decoded;}};
 globalThis.Tesseract={createWorker:async()=>{created++;return {reinitialize:async lang=>languages.push(lang),setParameters:async()=>{},recognize:async()=>({data:{text:++calls===1?'商品テスト':'-011 4977330003109 -001',confidence:95}}),terminate:async()=>{terminated++;}};}};
 try{let r=await recognize({width:1000,height:1000},()=>{});assert.equal(calls,2);assert.equal(r.product.jan,'4977330003109');assert.equal(r.product.allowance,'');assert.deepEqual(Object.keys(r.regions),['name','bottom']);calls=0;decoded=[{rawValue:'4977330003109',format:'ean_13'}];r=await recognize({width:1000,height:1000},()=>{});assert.equal(calls,1);assert.equal(r.product.jan,'4977330003109');assert.deepEqual(Object.keys(r.regions),['name']);assert.equal(created,1);assert.equal(terminated,0);assert.deepEqual(languages,['eng','jpn+eng']);await releaseOCR();assert.equal(terminated,1);}finally{await releaseOCR();for(const [k,v]of Object.entries(globals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

test('商品名用の濃淡補正は階調を保持し、白紙のノイズは増幅しない',()=>{
 const data=new Uint8ClampedArray([60,60,60,255,130,130,130,255,200,200,200,255]);enhanceNamePixels(data);
 assert.equal(data[0],0);assert.ok(data[4]>0&&data[4]<255);assert.equal(data[8],255);
 const blank=new Uint8ClampedArray([200,200,200,255,201,201,201,255]);enhanceNamePixels(blank);assert.equal(blank[0],200);assert.equal(blank[4],201);
});

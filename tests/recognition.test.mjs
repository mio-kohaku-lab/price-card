import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recognize} from '../recognition.js';
test('OCRはJANデコード成功時1回、失敗時2回。価格などのOCRを実行しない',async()=>{
 const globals={window:globalThis.window,document:globalThis.document,Tesseract:globalThis.Tesseract,BarcodeDetector:globalThis.BarcodeDetector};
 let decoded=[],calls=0,terminated=0;
 globalThis.window={Tesseract:true,BarcodeDetector:true};
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
 globalThis.BarcodeDetector=class{static async getSupportedFormats(){return ['ean_13'];}async detect(){return decoded;}};
 globalThis.Tesseract={createWorker:async()=>({reinitialize:async()=>{},setParameters:async()=>{},recognize:async()=>({data:{text:++calls===1?'商品テスト':'-011 4977330003109 -001',confidence:95}}),terminate:async()=>{terminated++;}})};
 try{let r=await recognize({width:1000,height:1000},()=>{});assert.equal(calls,2);assert.equal(r.product.jan,'4977330003109');assert.equal(r.product.allowance,'');assert.deepEqual(Object.keys(r.regions),['name','bottom']);calls=0;decoded=[{rawValue:'4977330003109',format:'ean_13'}];r=await recognize({width:1000,height:1000},()=>{});assert.equal(calls,1);assert.equal(r.product.jan,'4977330003109');assert.deepEqual(Object.keys(r.regions),['name']);assert.equal(terminated,2);}finally{for(const [k,v]of Object.entries(globals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

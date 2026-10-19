import {parseRegions,decodedJan} from './core.js';
export function crop(source,x,y,w,h,scale=1){const c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d').drawImage(source,x,y,w,h,0,0,c.width,c.height);return c;}
export function straighten(source,points){
 const src=source.getContext('2d').getImageData(0,0,source.width,source.height);const out=document.createElement('canvas');out.width=1000;out.height=1000;const ctx=out.getContext('2d'),data=ctx.createImageData(1000,1000);const [a,b,c,d]=points;
 for(let y=0;y<1000;y++)for(let x=0;x<1000;x++){const u=x/999,v=y/999;const sx=(1-v)*((1-u)*a.x+u*b.x)+v*((1-u)*d.x+u*c.x),sy=(1-v)*((1-u)*a.y+u*b.y)+v*((1-u)*d.y+u*c.y);const ix=Math.max(0,Math.min(source.width-2,Math.floor(sx))),iy=Math.max(0,Math.min(source.height-2,Math.floor(sy))),fx=sx-ix,fy=sy-iy;for(let k=0;k<3;k++){const at=(xx,yy)=>src.data[(yy*source.width+xx)*4+k];data.data[(y*1000+x)*4+k]=(1-fy)*((1-fx)*at(ix,iy)+fx*at(ix+1,iy))+fy*((1-fx)*at(ix,iy+1)+fx*at(ix+1,iy+1));}data.data[(y*1000+x)*4+3]=255;}
 ctx.putImageData(data,0,0);return out;
}
export async function decode(canvas){
 const found=[];
 if('BarcodeDetector'in window)try{const formats=await BarcodeDetector.getSupportedFormats();const r=await new BarcodeDetector({formats}).detect(canvas);found.push(...r.map(b=>({rawValue:b.rawValue,format:b.format.toUpperCase()})));}catch{}
 if(!found.length&&window.ZXing)try{const hints=new Map([[ZXing.DecodeHintType.TRY_HARDER,true]]);const reader=new ZXing.MultiFormatReader();reader.setHints(hints);const source=new ZXing.HTMLCanvasElementLuminanceSource(canvas);const r=reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source)));found.push({rawValue:r.getText(),format:ZXing.BarcodeFormat[r.getBarcodeFormat()]});}catch{}
 return found;
}
let worker;
export async function recognize(canvas,onProgress){
 const barcodes=await decode(canvas);const regions={},confidence={};let warning='';
 try{
 if(!window.Tesseract)throw Error('OCRライブラリを読み込めません');
 onProgress('OCRを準備しています。初回は時間がかかります…');
 const vendor=new URL('./vendor/',import.meta.url).href;
 worker=await Tesseract.createWorker('jpn+eng',1,{workerPath:vendor+'worker.min.js',corePath:vendor,langPath:vendor,logger:m=>{if(m.status==='recognizing text')onProgress(`文字を読み取り中… ${Math.round(m.progress*100)}%`);}});
 // Relative regions follow the supplied card layout. The crop must contain exactly one card.
 const boxes={name:[.03,.02,.94,.40]};
 // Decode JAN first; only OCR the printed code when decoding did not supply it.
 if(!decodedJan(barcodes))boxes.bottom=[.015,.735,.97,.115];
 for(const [key,[x,y,w,h]]of Object.entries(boxes)){
 if(key==='bottom')await worker.reinitialize('eng');
 await worker.setParameters({tessedit_pageseg_mode:key==='name'?'6':'7',tessedit_char_whitelist:key==='name'?'':key==='bottom'?'0123456789- ':'0123456789'});
 const part=crop(canvas,x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height,Math.max(1,1600/canvas.width));
 const r=await worker.recognize(part);regions[key]=r.data.text;confidence[key]=r.data.confidence;
 }
 }catch(e){warning=`OCRに失敗しました。空欄は手入力してください。${e?.message||String(e)}`;}finally{if(worker){await worker.terminate();worker=null;}}
 const trusted=Object.fromEntries(Object.entries(regions).map(([key,value])=>[key,confidence[key]>=60?value:'']));
 return {product:parseRegions(trusted,barcodes),barcodes,regions,confidence,warning};
}

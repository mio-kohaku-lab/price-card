import {validJan} from './core.js';
const encoder=new TextEncoder();
const bytes=s=>encoder.encode(s);
const concat=chunks=>{const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;};
export const PDF_LIMIT=100;
export function barcodeBits(jan,barcode=globalThis.JsBarcode){
 if(!validJan(jan))throw Error('正しいJANが必要です');
 const target={};barcode(target,jan,{format:jan.length===13?'EAN13':'EAN8',displayValue:false,margin:0});
 const bits=target.encodings.map(e=>e.data).join('');
 if(!/^[01]+$/.test(bits)||bits.length!==(jan.length===13?95:67))throw Error('バーコードを生成できませんでした');
 return bits;
}
export function wrapName(text,measure,width){
 const lines=[];let line='';for(const char of String(text).replace(/\s+/g,' ').trim()){
  if(line&&measure(line+char)>width){lines.push(line);line=char;}else line+=char;
 }if(line)lines.push(line);return lines;
}
export function nameImage(name){
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=200;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,200);ctx.fillStyle='#000';ctx.textBaseline='top';
 let font=48,lines;
 do{ctx.font=`${font}px system-ui, sans-serif`;lines=wrapName(name,t=>ctx.measureText(t).width,980);if(lines.length*font*1.2<=190)break;font-=2;}while(font>=14);
 if(lines.length*font*1.2>190)throw Error('商品名が長すぎます。短くしてから出力してください');
 lines.forEach((line,i)=>ctx.fillText(line,10,5+i*font*1.2));
 const base64=canvas.toDataURL('image/jpeg',.95).split(',')[1];return {jpeg:Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),width:1000,height:200};
}
// Small PDF writer: vector bars and digits, embedded Japanese name images; no server/font fetch.
export function buildJanPdf(entries){
 if(!entries.length||entries.length>PDF_LIMIT)throw Error(`1〜${PDF_LIMIT}商品を選択してください`);
 const objects=[null,null,null],add=body=>{objects.push(typeof body==='string'?bytes(body):body);return objects.length-1;};
 const stream=(data,extra='')=>concat([bytes(`<< /Length ${data.length} ${extra} >>\nstream\n`),data,bytes('\nendstream')]);
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'),pages=[];
 const W=595.28,H=841.89,margin=34,gap=12,cw=(W-2*margin-gap)/2,ch=142;
 for(let offset=0;offset<entries.length;offset+=10){
  let content='';const resources=[];
  entries.slice(offset,offset+10).forEach((entry,index)=>{
   if(!validJan(entry.jan)||!/^[01]+$/.test(entry.bits)||entry.bits.length!==(entry.jan.length===13?95:67))throw Error('出力データが不正です');
   const {jpeg,width,height}=entry.image;
   const image=add(stream(jpeg,`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`));resources.push(`/N${index} ${image} 0 R`);
   const x=margin+(index%2)*(cw+gap),top=H-margin-Math.floor(index/2)*(ch+gap);
   content+=`0.8 G 0.4 w ${x} ${top-ch} ${cw} ${ch} re S\n`;
   content+=`q ${cw-16} 0 0 46 ${x+8} ${top-54} cm /N${index} Do Q\n0 g\n`;
   const module=1.6,start=x+(cw-entry.bits.length*module)/2,bottom=top-116;
   for(let i=0;i<entry.bits.length;){if(entry.bits[i]==='0'){i++;continue;}let end=i+1;while(entry.bits[end]==='1')end++;content+=`${(start+i*module).toFixed(3)} ${bottom} ${((end-i)*module).toFixed(3)} 54 re f\n`;i=end;}
   const tx=x+(cw-entry.jan.length*7.2)/2;content+=`BT /F1 12 Tf ${tx} ${top-133} Td (${entry.jan}) Tj ET\n`;
  });
  content+=`0 g BT /F1 8 Tf 34 18 Td (JAN / EAN - A4 - ${pages.length+1}/${Math.ceil(entries.length/10)}) Tj ET\n`;
  const drawing=add(stream(bytes(content)));
  pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font} 0 R >> /XObject << ${resources.join(' ')} >> >> /Contents ${drawing} 0 R >>`));
 }
 objects[1]=bytes('<< /Type /Catalog /Pages 2 0 R >>');objects[2]=bytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(id=>`${id} 0 R`).join(' ')}] >>`);
 const chunks=[bytes('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;
 for(let id=1;id<objects.length;id++){offsets.push(length);const part=concat([bytes(`${id} 0 obj\n`),objects[id],bytes('\nendobj\n')]);chunks.push(part);length+=part.length;}
 chunks.push(bytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
 return new Blob(chunks,{type:'application/pdf'});
}
export async function createJanPdf(products,onProgress=()=>{},isCurrent=()=>true){
 if(!products.length||products.length>PDF_LIMIT)throw Error(`1〜${PDF_LIMIT}商品を選択してください`);
 await document.fonts?.ready;const entries=[];
 for(const p of products){
  if(!isCurrent())throw Error('PDF作成を中止しました');
  entries.push({jan:p.jan,bits:barcodeBits(p.jan),image:nameImage(p.name)});onProgress(entries.length,products.length);
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!isCurrent())throw Error('PDF作成を中止しました');return buildJanPdf(entries);
}

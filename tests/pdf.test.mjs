import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJanPdf, barcodeBits, wrapName, PDF_LIMIT} from '../jan-pdf.js';

const entry={jan:'4977330003109',bits:'1'.repeat(95),image:{jpeg:new Uint8Array([255,216,255,217]),width:1,height:1}};
test('PDF rejects empty, excessive, and invalid JAN selections',()=>{
 assert.throws(()=>buildJanPdf([]));
 assert.throws(()=>buildJanPdf(Array(PDF_LIMIT+1).fill(entry)));
 assert.throws(()=>buildJanPdf([{...entry,jan:'4977330003100'}]));
 assert.throws(()=>barcodeBits('123'));
});
test('PDF paginates eleven labels on two A4 pages with valid byte offsets',async()=>{
 const blob=buildJanPdf(Array(11).fill(entry));
 assert.equal(blob.type,'application/pdf');
 const data=new Uint8Array(await blob.arrayBuffer());
 const text=new TextDecoder('latin1').decode(data);
 assert.match(text,/\/Count 2/);
 assert.equal((text.match(/\/MediaBox \[0 0 595.28 841.89\]/g)||[]).length,2);
 const offset=Number(text.match(/startxref\n(\d+)/)[1]);
 assert.equal(new TextDecoder().decode(data.slice(offset,offset+4)),'xref');
 const records=text.slice(offset).split('\n');
 const count=Number(records[1].split(' ')[1]);
 for(let id=1;id<count;id++){
  const at=Number(records[id+2].slice(0,10));
  assert.ok(new TextDecoder().decode(data.slice(at,at+20)).startsWith(`${id} 0 obj`));
 }
});
test('Japanese names wrap without dropping characters',()=>{
 const name='ちょこっとプッチンプリン カスタード120g';
 const lines=wrapName(name,s=>[...s].length,10);
 assert.equal(lines.join(''),name);
 assert.ok(lines.every(s=>[...s].length<=10));
});

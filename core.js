export const fields={name:'商品名',priceInclusive:'税込価格',priceExclusive:'税抜価格',dept:'DEPT番号',jan:'JAN',allowance:'販売許容数値'};
export function validJan(s){if(!/^(\d{8}|\d{13})$/.test(s))return false;const a=[...s].map(Number),last=a.pop();return (10-a.reverse().reduce((n,x,i)=>n+x*(i%2?1:3),0)%10)%10===last;}
export function emptyProduct(){return Object.fromEntries(Object.keys(fields).map(k=>[k,'']));}
export function parseRegions(regions,decoded=[]){
 const p=emptyProduct();const norm=s=>(s||'').normalize('NFKC').replace(/[−–—ー]/g,'-');
 p.name=(regions.name||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const price=s=>{const m=norm(s).match(/(?:[¥￥]\s*)?(\d[\d,]*)(?:\s*円)?/g)||[];return m.length===1?m[0].replace(/[^\d]/g,''):'';};
 p.priceExclusive=price(regions.exclusive);p.priceInclusive=price(regions.inclusive);
 p.dept=norm(regions.dept).match(/^\s*(\d{1,4})\s*(?:\(?税込)?\s*$/)?.[1]||'';
 const bottom=norm(regions.bottom);
 const match=bottom.match(/(?<!\d)(\d{13})(?!\d)/);
 const barJans=decoded.filter(b=>['EAN_13','EAN_8','ean_13','ean_8'].includes(b.format)&&validJan(b.rawValue));
 p.jan=barJans.length===1?barJans[0].rawValue:match?.[1]||'';
 // Only a minus-number following the printed JAN is eligible. Never take the left code.
 if(match)p.allowance=bottom.slice(match.index+match[0].length).match(/^\s*(-\d{3})(?!\d)/)?.[1]||'';
 return p;
}
export function validateProduct(p){for(const k of Object.keys(fields))if(typeof p[k]!=='string'||p[k].length>300)throw Error('商品項目の形式が不正です');for(const k of ['priceInclusive','priceExclusive'])if(p[k]&&!/^\d{1,8}$/.test(p[k]))throw Error('価格は8桁以内の数字で入力してください');if(p.dept&&!/^\d+$/.test(p.dept))throw Error('DEPTは数字で入力してください');if(p.allowance&&!/^-\d+$/.test(p.allowance))throw Error('販売許容数値は -001 のように入力してください');if(p.jan&&!validJan(p.jan))throw Error('JANの桁数・チェックデジットが正しくありません');if(!p.name.trim())throw Error('商品名を入力してください');return p;}
export function parseImport(text){const d=JSON.parse(text);if(d.schemaVersion!==1||!Array.isArray(d.products)||d.products.length>10000)throw Error('対応していないバックアップ形式です');const seen=new Set();return d.products.map(p=>{validateProduct(p);if(p.jan&&seen.has(p.jan))throw Error('ファイル内に重複JANがあります');if(p.jan)seen.add(p.jan);return {...Object.fromEntries(Object.keys(fields).map(k=>[k,p[k]])),barcodeJan:typeof p.barcodeJan==='string'?p.barcodeJan:'',barcodes:Array.isArray(p.barcodes)?p.barcodes.filter(b=>typeof b.rawValue==='string'&&b.rawValue.length<1000&&typeof b.format==='string').map(b=>({rawValue:b.rawValue,format:b.format})):[]};});}


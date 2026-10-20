export const fields={name:'商品名',priceInclusive:'税込価格',priceExclusive:'税抜価格',dept:'DEPT番号',jan:'JAN',allowance:'販売許容数値'};
export function validJan(s){if(!/^(\d{8}|\d{13})$/.test(s))return false;const a=[...s].map(Number),last=a.pop();return (10-a.reverse().reduce((n,x,i)=>n+x*(i%2?1:3),0)%10)%10===last;}
export function emptyProduct(){return Object.fromEntries(Object.keys(fields).map(k=>[k,'']));}
export const legacyFields=['priceInclusive','priceExclusive','dept','allowance'];
export function decodedJan(decoded=[]){const values=[...new Set(decoded.filter(b=>['EAN_13','EAN_8','ean_13','ean_8'].includes(b.format)&&validJan(b.rawValue)).map(b=>b.rawValue))];return values.length===1?values[0]:'';}
export function mergeScan(existing,incoming){return {...existing,...incoming,...Object.fromEntries(legacyFields.map(k=>[k,existing[k]||''])),...management(existing),category:incoming.category??categoryOf(existing),id:existing.id,createdAt:existing.createdAt};}
export function parseRegions(regions,decoded=[]){
 const p=emptyProduct();const norm=s=>(s||'').normalize('NFKC').replace(/[−–—ー]/g,'-');
 p.name=(regions.name||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const bottom=norm(regions.bottom);
 const candidates=[...new Set((bottom.match(/(?<!\d)(?:\d{13}|\d{8})(?!\d)/g)||[]).filter(validJan))];
 p.jan=decodedJan(decoded)||(candidates.length===1?candidates[0]:'');
 return p;
}
export function validateProduct(p){management(p);categoryOf(p);for(const k of Object.keys(fields))if(typeof p[k]!=='string'||p[k].length>300)throw Error('商品項目の形式が不正です');for(const k of ['priceInclusive','priceExclusive'])if(p[k]&&!/^\d{1,8}$/.test(p[k]))throw Error('価格は8桁以内の数字で入力してください');if(p.dept&&!/^\d+$/.test(p.dept))throw Error('DEPTは数字で入力してください');if(p.allowance&&!/^-\d+$/.test(p.allowance))throw Error('販売許容数値は -001 のように入力してください');if(p.jan&&!validJan(p.jan))throw Error('JANの桁数・チェックデジットが正しくありません');if(!p.name.trim())throw Error('商品名を入力してください');return p;}
export function parseImport(text){const d=JSON.parse(text);if(d.schemaVersion!==1||!Array.isArray(d.products)||d.products.length>10000)throw Error('対応していないバックアップ形式です');const seen=new Set();return d.products.map(p=>{validateProduct(p);if(p.jan&&seen.has(p.jan))throw Error('ファイル内に重複JANがあります');if(p.jan)seen.add(p.jan);return {category:categoryOf(p),...management(p),...Object.fromEntries(Object.keys(fields).map(k=>[k,p[k]])),...Object.fromEntries(['capturedAt','readAt','createdAt','updatedAt'].filter(k=>typeof p[k]==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(p[k])&&Number.isFinite(Date.parse(p[k]))).map(k=>[k,p[k]])),barcodeJan:typeof p.barcodeJan==='string'?p.barcodeJan:'',barcodes:Array.isArray(p.barcodes)?p.barcodes.filter(b=>typeof b.rawValue==='string'&&b.rawValue.length<1000&&typeof b.format==='string').map(b=>({rawValue:b.rawValue,format:b.format})):[]};});}


export function productDate(p){
 const key=['capturedAt','readAt','createdAt'].find(k=>typeof p[k]==='string'&&Number.isFinite(Date.parse(p[k])));
 if(!key)return '日付不明';
 const d=new Date(p[key]);const value=`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
 return `${{capturedAt:'撮影',readAt:'読込',createdAt:'登録'}[key]} ${value}`;
}

export function management(p){
 if(p.enabled!==undefined&&typeof p.enabled!=='boolean')throw Error('〇✕の形式が不正です');
 const count=p.materialCount??'';
 if(typeof count!=='string'||(count!==''&&!/^\d{1,8}$/.test(count)))throw Error('基在は空欄、または0以上の8桁以内の整数で入力してください');
 return {enabled:p.enabled!==false,materialCount:count===''?'':String(Number(count))};
}
export function isGray(p){const m=management(p);return !m.enabled||m.materialCount==='0';}
export function compareRegistered(a,b){
 const stamp=p=>Number.isFinite(Date.parse(p.createdAt))?Date.parse(p.createdAt):0;
 return stamp(b)-stamp(a)||String(a.id||'').localeCompare(String(b.id||''));
}
export function compareInventory(a,b){return Number(isGray(a))-Number(isGray(b))||compareRegistered(a,b);}

export const categories=['','日配','飲料','ドライ','その他'];
export function categoryOf(p){const value=p.category??'';if(!categories.includes(value))throw Error('カテゴリが不正です');return value;}
export function matchesCategory(p,filter){return filter==='全て'||categoryOf(p)===filter;}

export function restoreProductOrder(products,saved){
 const ids=new Set(products.map(p=>p.id)),seen=new Set();
 const kept=Array.isArray(saved)?saved.filter(id=>typeof id==='string'&&ids.has(id)&&!seen.has(id)&&(seen.add(id),true)):[];
 const added=products.filter(p=>!seen.has(p.id)).sort(compareRegistered).map(p=>p.id);
 return [...added,...kept];
}

// Stored product category values remain stable when their display names change.
export function validateCategoryNames(value){
 if(!Array.isArray(value)||value.length!==4||value.some(n=>typeof n!=='string'))throw Error('カテゴリ名を4つ入力してください');
 const names=value.map(n=>n.trim());
 if(names.some(n=>!n||[...n].length>12))throw Error('カテゴリ名は1〜12文字で入力してください');
 if(new Set(names).size!==4||names.some(n=>['全て','未選択'].includes(n)))throw Error('カテゴリ名は重複させず、「全て」「未選択」以外にしてください');
 return names;
}
export function categoryLabel(value,names){return value===''?'未選択':value==='全て'?'全て':names[categories.indexOf(value)-1]||value;}

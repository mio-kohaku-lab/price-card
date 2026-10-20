import {test} from 'node:test';import assert from 'node:assert/strict';
import {validJan,parseRegions,validateProduct,parseImport,mergeScan,productDate,management,isGray,compareInventory,categoryOf,matchesCategory} from '../core.js';
test('JANチェックデジット、桁数、先頭ゼロ',()=>{for(const j of ['4977330003109','4971666489040','4903110775003','0000000000000'])assert.equal(validJan(j),true);for(const j of ['4977330003108','497733000310','abc'])assert.equal(validJan(j),false);});
test('読み取りは商品名・JANのみ。旧項目は抽出しない',()=>{const p=parseRegions({name:'かわいや 黒焼\nポテト 1本',exclusive:'¥584',inclusive:'¥631)',dept:'13',bottom:'-011 4977330003109 -001'});for(const k of ['allowance','priceExclusive','priceInclusive','dept'])assert.equal(p[k],'');assert.equal(p.jan,'4977330003109');assert.equal(p.name,'かわいや 黒焼 ポテト 1本');});
test('左の数値で補完しない、未知のバーコード全文からJANを推測しない',()=>{const p=parseRegions({bottom:'-120 4971666489040'},[{format:'CODE_128',rawValue:'0114977330003109001'}]);assert.equal(p.allowance,'');assert.equal(p.jan,'4971666489040');assert.equal(p.priceInclusive,'');});
test('デコードされたEANをOCRより優先',()=>assert.equal(parseRegions({bottom:'4903110775003 -001'},[{format:'EAN_13',rawValue:'4977330003109'}]).jan,'4977330003109'));
test('バックアップの不正データと重複を拒否',()=>{const p={name:'商品',jan:'4977330003109',priceInclusive:'631',priceExclusive:'584',dept:'013',allowance:'-001'};assert.equal(validateProduct(p).dept,'013');assert.throws(()=>validateProduct({...p,jan:4977330003109}));assert.throws(()=>parseImport(JSON.stringify({schemaVersion:1,products:[p,p]})));assert.equal(parseImport(JSON.stringify({schemaVersion:1,products:[p]}))[0].allowance,'-001');});
test('バックアップで形式・全文・対応JANを保持',()=>{const p={name:'商品',jan:'4977330003109',priceInclusive:'631',priceExclusive:'584',dept:'013',allowance:'-001',barcodeJan:'4977330003109',barcodes:[{format:'CODE_128',rawValue:'0114977330003109001'}]};const result=parseImport(JSON.stringify({schemaVersion:1,products:[p]}))[0];assert.deepEqual(result.barcodes,p.barcodes);assert.equal(result.barcodeJan,p.barcodeJan);});
test('同JANの再読取で旧価格・DEPT・負号とIDを保持',()=>{const old={id:'saved',createdAt:'2026-10-19',name:'旧名',jan:'4977330003109',priceInclusive:'631',priceExclusive:'584',dept:'013',allowance:'-001'};const updated=mergeScan(old,parseRegions({name:'新名',bottom:'4977330003109'}));assert.equal(updated.name,'新名');for(const k of ['id','createdAt','priceInclusive','priceExclusive','dept','allowance'])assert.equal(updated[k],old[k]);});
test('JAN OCRはチェックデジット不正と複数候補を採用しない',()=>{assert.equal(parseRegions({bottom:'4977330003108'}).jan,'');assert.equal(parseRegions({bottom:'4977330003109 4903110775003'}).jan,'');});

test('日付は撮影・画像読込・旧商品の登録を区別し、編集日を使わない',()=>{
 const capturedAt=new Date(2026,9,19,12).toISOString(),readAt=new Date(2026,9,20,12).toISOString();
 assert.equal(productDate({capturedAt,readAt,updatedAt:readAt}),'撮影 2026/10/19');
 assert.equal(productDate({readAt}),'読込 2026/10/20');
 assert.equal(productDate({createdAt:capturedAt,updatedAt:readAt}),'登録 2026/10/19');
 assert.equal(productDate({capturedAt:'invalid'}),'日付不明');
});
test('バックアップから撮影日・読込日・登録日を復元し、再撮影時だけ撮影日を更新',()=>{
 const old={...parseRegions({name:'商品'}),capturedAt:'2026-10-19T00:00:00.000Z',readAt:'2026-10-19T00:01:00.000Z',createdAt:'2026-10-19T00:02:00.000Z',updatedAt:'2026-10-20T00:00:00.000Z'};
 const restored=parseImport(JSON.stringify({schemaVersion:1,products:[old]}))[0];
 for(const key of ['capturedAt','readAt','createdAt','updatedAt'])assert.equal(restored[key],old[key]);
 assert.equal(mergeScan(old,parseRegions({name:'手入力'})).capturedAt,old.capturedAt);
 assert.equal(mergeScan(old,{...parseRegions({name:'再撮影'}),capturedAt:'2026-10-21T00:00:00.000Z'}).capturedAt,'2026-10-21T00:00:00.000Z');
});

test('グレー背景は✕または明示的な基在0。空欄は0にしない',()=>{
 for(const [p,expected] of [[{},false],[{materialCount:''},false],[{enabled:false},true],[{enabled:true,materialCount:'0'},true],[{enabled:false,materialCount:'3'},true],[{enabled:true,materialCount:'3'},false],[{materialCount:'00'},true]])assert.equal(isGray(p),expected);
 assert.equal(management({materialCount:'003'}).materialCount,'3');
 for(const materialCount of ['-1','1.5','abc','123456789',0])assert.throws(()=>management({materialCount}));
});
test('並べ替えは白→グレー、各グループ内は更新日ではなく登録日の新しい順',()=>{
 const rows=[{id:'gray-new',enabled:false,createdAt:'2026-10-22T00:00:00Z'},{id:'white-old',createdAt:'2026-10-19T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z'},{id:'gray-zero',materialCount:'0',createdAt:'2026-10-20T00:00:00Z'},{id:'white-new',createdAt:'2026-10-21T00:00:00Z'},{id:'unknown'}];
 assert.deepEqual(rows.sort(compareInventory).map(p=>p.id),['white-new','white-old','unknown','gray-new','gray-zero']);
});
test('管理状態を再スキャンでも維持し、JSONに空欄と0を区別して保存',()=>{
 const p={...parseRegions({name:'商品'}),enabled:false,materialCount:'0'};
 assert.deepEqual(management(mergeScan(p,parseRegions({name:'再撮影'}))),{enabled:false,materialCount:'0'});
 for(const materialCount of ['','0','12']){
  const restored=parseImport(JSON.stringify({schemaVersion:1,products:[{...p,materialCount}]}))[0];assert.equal(restored.enabled,false);assert.equal(restored.materialCount,materialCount);
 }
 assert.throws(()=>parseImport(JSON.stringify({schemaVersion:1,products:[{...p,enabled:'false'}]})));
});

test('カテゴリは未選択が初期値、指定4種を保存・復元し再撮影でも維持',()=>{
 const base=parseRegions({name:'商品'});assert.equal(categoryOf(base),'');
 for(const category of ['','日配','飲料','ドライ','その他']){
  const p={...base,category};const restored=parseImport(JSON.stringify({schemaVersion:1,products:[p]}))[0];assert.equal(restored.category,category);assert.equal(mergeScan(p,base).category,category);
  assert.equal(matchesCategory(p,'全て'),true);assert.equal(matchesCategory(p,'日配'),category==='日配');
 }
 assert.throws(()=>validateProduct({...base,category:'未知'}));assert.equal(mergeScan({...base,category:'日配'},{...base,category:''}).category,'');
});

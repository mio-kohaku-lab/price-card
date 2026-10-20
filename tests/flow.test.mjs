import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import * as core from '../core.js';import {CaptureGate,frameSample} from '../scan-policy.js';
// Exercise the real screen/event code with deterministic camera, OCR and storage adapters.
// This does not replace layout or Android camera testing.
test('起動時一覧→カメラ要求→OCRフォーム→1回の保存で次のカメラ。重複は通知して更新',async()=>{
 let cameraRequests=0,dialogs=0,failWrite=false;const elements=new Map();
 const make=()=>({style:{},textContent:'',value:'',disabled:false,hidden:false,showModal(){dialogs++;},close(){},getTracks(){return[];}});
 const app=make();let html='';Object.defineProperty(app,'innerHTML',{get:()=>html,set:s=>{html=s;for(const key of [...elements.keys()])if(!['#app','#home-link','#toast'].includes(key))elements.delete(key);for(const m of s.matchAll(/id="([^"]+)"/g))elements.set('#'+m[1],make());for(const m of s.matchAll(/<input name="([^"]+)"[^>]*value="([^"]*)"/g)){const el=make();el.value=m[2];elements.set('[name='+m[1]+']',el);}}});
 elements.set('#app',app);elements.set('#home-link',make());elements.set('#toast',make());
 let rows=[{...core.emptyProduct(),id:'old',name:'保存済み',jan:'4977330003109',category:'飲料',priceInclusive:'631',dept:'013',createdAt:'2026-10-19T00:00:00Z',updatedAt:'old-date'}];
 const savedPreferences=new Map();let failPreference=false;
 const context=vm.createContext({localStorage:{getItem:key=>savedPreferences.get(key)??null,setItem:(key,value)=>{if(failPreference)throw Error('Quota');savedPreferences.set(key,value);}},...core,CaptureGate,frameSample,document:{querySelector:s=>elements.get(s)||null,addEventListener(){},querySelectorAll:()=>[]},window:{scrollTo(){},addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>{cameraRequests++;throw Error('Denied');}}},db:{all:async()=>structuredClone(rows),write:async items=>{if(failWrite)throw Error('保存領域がいっぱいです');for(const item of items)rows=rows.filter(x=>x.id!==item.id).concat(structuredClone(item));}},recognize:async()=>({product:{...core.emptyProduct(),name:'新しい商品名',jan:'4977330003109'},barcodes:[],regions:{}}),releaseOCR:async()=>{},crypto:{randomUUID:()=> 'new-id'},setTimeout:()=>0,clearTimeout(){},FormData:class{*[Symbol.iterator](){yield ['name',elements.get('[name=name]').value];yield ['jan',elements.get('[name=jan]').value];}},console});
 const code=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');vm.runInContext(code,context);await new Promise(setImmediate);assert.equal(cameraRequests,0);assert.match(html,/商品一覧/);assert.match(html,/JANを出力/);context.scanner();await new Promise(setImmediate);assert.equal(cameraRequests,1);assert.match(elements.get('#camera-status').textContent,/利用できません/);assert.equal(elements.get('#start').hidden,false);
 await context.readCard({toDataURL:()=> 'data:image/jpeg;base64,'});assert.match(html,/読み取り結果/);assert.equal(elements.get('[name=name]').value,'新しい商品名');assert.equal(elements.get('[name=jan]').value,'4977330003109');assert.match(elements.get('#save-product').textContent,/更新/);assert.doesNotMatch(html,/type="checkbox"/);
 const submit=elements.get('#form').onsubmit;await submit({preventDefault(){},target:{}});await new Promise(setImmediate);assert.equal(dialogs,0);assert.equal(rows.length,1);assert.equal(rows[0].name,'新しい商品名');assert.equal(rows[0].priceInclusive,'631');assert.equal(rows[0].dept,'013');assert.equal(rows[0].id,'old');assert.equal(rows[0].category,'飲料');assert.ok(Number.isFinite(Date.parse(rows[0].readAt)));assert.equal(cameraRequests,2);assert.match(html,/今回 1件 保存/);
 await context.readCard({toDataURL:()=> 'data:image/jpeg;base64,'});failWrite=true;await elements.get('#form').onsubmit({preventDefault(){},target:{}});assert.equal(cameraRequests,2);assert.match(elements.get('#form-error').textContent,/保存領域/);assert.equal(elements.get('#save-product').disabled,false);assert.match(html,/読み取り結果/);
 await context.home();assert.doesNotMatch(html,/id="search"/);assert.match(html,/data-filter="日配"/);assert.match(elements.get('#list').innerHTML,/<table class="product-table">/);assert.match(elements.get('#list').innerHTML,/4977330003109/);assert.match(elements.get('#list').innerHTML,/登録 \d{4}\/\d{2}\/\d{2}/);
 failWrite=false;
 await Promise.all([context.saveManagement('old',{enabled:false}),context.saveManagement('old',{materialCount:'0'})]);
 assert.equal(rows[0].enabled,false);assert.equal(rows[0].materialCount,'0');assert.equal(rows[0].createdAt,'2026-10-19T00:00:00Z');assert.equal(rows[0].name,'新しい商品名');
 failWrite=true;await assert.rejects(context.saveManagement('old',{enabled:true}),/保存領域/);assert.equal(rows[0].enabled,false);
 failWrite=false;await context.saveManagement('old',{materialCount:''});assert.equal(rows[0].materialCount,'');assert.equal(rows[0].enabled,false);
 // The detail panel and inventory row share this actual event binding.
 const input={value:''},toggle={setAttribute(name,value){this[name]=value;}},status={textContent:''};let gray;
 const row={querySelector:selector=>({'.material-count':input,'.state-toggle':toggle,'.management-status':status})[selector],classList:{toggle(name,value){gray=value;}}};
 let detailSnapshot;
 context.bindManagement(row,'old',saved=>detailSnapshot=saved);
 assert.equal(toggle.textContent,'✕');input.value='0';await input.onchange();assert.equal(rows[0].materialCount,'0');assert.equal(gray,true);
 await toggle.onclick();assert.equal(rows[0].enabled,true);assert.equal(detailSnapshot.enabled,true);assert.equal(gray,true);
 input.value='';await input.onchange();assert.equal(gray,false);assert.equal(rows[0].materialCount,'');
 failWrite=true;await toggle.onclick();assert.equal(rows[0].enabled,true);assert.equal(toggle.textContent,'〇');assert.match(status.textContent,/保存できません/);
 failWrite=false;await context.home();assert.doesNotMatch(elements.get('#list').innerHTML,/class="is-gray"/);assert.match(elements.get('#list').innerHTML,/aria-pressed="false"/);
 rows.push({...core.emptyProduct(),id:'gray-new',name:'新しいグレー商品',jan:'',enabled:false,createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z'});
 await context.home();let view=elements.get('#list').innerHTML;assert.ok(view.indexOf('data-product="gray-new"')<view.indexOf('data-product="old"'));
 await elements.get('#sort-products').onclick();assert.deepEqual(JSON.parse(savedPreferences.get('card-note:inventory-order:v1')),['old','gray-new']);
 await context.home();view=elements.get('#list').innerHTML;assert.ok(view.indexOf('data-product="old"')<view.indexOf('data-product="gray-new"'));
 rows[0].enabled=false;failPreference=true;await elements.get('#sort-products').onclick();assert.match(elements.get('#toast').textContent,/保存できません/);assert.deepEqual(JSON.parse(savedPreferences.get('card-note:inventory-order:v1')),['old','gray-new']);

 failPreference=false;context.categorySettings();
 const names=['冷蔵','冷凍','常温','催事'];names.forEach((name,i)=>elements.get('#category-name-'+i).value=name);
 elements.get('#category-settings').onsubmit({preventDefault(){}});await new Promise(setImmediate);
 assert.deepEqual(JSON.parse(savedPreferences.get('card-note:category-names:v1')),names);
 assert.match(html,/data-filter="日配"[^>]*>冷蔵/);assert.match(html,/data-filter="その他"[^>]*>催事/);
 assert.equal(rows.find(p=>p.id==='old').category,'飲料');
 context.editor(rows.find(p=>p.id==='old'));assert.match(html,/value="飲料" checked><span>冷凍/);
 context.categorySettings();names.forEach((name,i)=>elements.get('#category-name-'+i).value=name);elements.get('#category-name-0').value='未選択';
 elements.get('#category-settings').onsubmit({preventDefault(){}});assert.match(elements.get('#category-error').textContent,/以外/);
 assert.deepEqual(JSON.parse(savedPreferences.get('card-note:category-names:v1')),names);
 elements.get('#category-defaults').onclick();assert.equal(elements.get('#category-name-0').value,'日配');
 assert.deepEqual(JSON.parse(savedPreferences.get('card-note:category-names:v1')),names);
 failPreference=true;elements.get('#category-settings').onsubmit({preventDefault(){}});
 assert.ok(elements.get('#category-error').textContent);assert.deepEqual(JSON.parse(savedPreferences.get('card-note:category-names:v1')),names);
});

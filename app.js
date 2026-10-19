import {frameSample,CaptureGate} from './scan-policy.js';
import {fields,emptyProduct,validJan,validateProduct,parseImport,mergeScan,productDate,management,isGray,compareRegistered,compareInventory} from './core.js';
import * as db from './db.js';
import {crop,decode,recognize,straighten,releaseOCR} from './recognition.js';
const app=document.querySelector('#app');let products=[],stream,timer,epoch=0,busy=false,currentImage=null,draft=null,wake=null,sessionCount=0,lastSavedSample=null,captureSample=null,capturedAt='';
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4500);}
function ask(title,message,ok='実行'){return new Promise(resolve=>{const d=$('#modal');$('#modal-title').textContent=title;$('#modal-message').textContent=message;$('#modal-ok').textContent=ok;const done=v=>{d.close();resolve(v);};$('#modal-ok').onclick=()=>done(true);$('#modal-cancel').onclick=()=>done(false);d.oncancel=e=>{e.preventDefault();done(false);};d.showModal();});}
function stop(){epoch++;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;wake?.release().catch(()=>{});wake=null;}
function screen(html){stop();app.className='';app.innerHTML=html;window.scrollTo(0,0);}
async function home(){if(busy)return;currentImage=null;draft=null;screen('<p>商品を読み込み中…</p>');try{products=await db.all();}catch(e){app.innerHTML='<h1>保存領域を開けません</h1><p>通常のChromeで開き直してください。プライベートモードや端末の空き容量も確認してください。</p>';return;}app.className='list-page';app.innerHTML=`<div class="list-toolbar"><h1>商品一覧</h1><button id="scan" class="primary">＋ 読み取る</button></div><div class="search"><input id="search" type="search" placeholder="商品名・JANで検索" aria-label="商品名・JANで検索"></div><div class="inventory-heading"><h2>保存した商品 <span class="count">${products.length}件</span></h2><button id="sort-products">並べ替え</button></div><div id="list"></div><button id="manual">＋ 手入力で登録</button><footer><h2>データのバックアップ</h2><p class="muted">この端末のブラウザに保存されます。定期的にJSONを書き出してください。</p><div class="actions"><button id="export">書き出す</button><button id="import">読み込む</button></div><input class="file-input" id="backup" type="file" accept="application/json,.json"><p class="muted">端末内処理 · アカウント不要<br>店舗の公式アプリではありません。</p></footer>`;
let order=products.slice().sort(compareRegistered).map(p=>p.id);
const list=()=>{
 const q=$('#search').value.normalize('NFKC').toLowerCase(),rank=new Map(order.map((id,i)=>[id,i]));
 const rows=products.filter(p=>(p.name+' '+p.jan).normalize('NFKC').toLowerCase().includes(q)).sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
 $('#list').innerHTML=rows.length?`<table class="product-table"><caption class="sr-only">保存した商品。商品名を押すと詳細を表示します。</caption><tbody>${rows.map(p=>{
  const m=management(p);return `<tr data-product="${esc(p.id)}" class="${isGray(p)?'is-gray':''}"><td>
  <div class="product-name-scroll"><button class="product-link" data-id="${esc(p.id)}">${esc(p.name)}</button></div>
  <div class="product-meta"><span>${esc(p.jan||'JAN未登録')}</span><small>${esc(productDate({createdAt:p.createdAt}))}</small></div>
  <div class="product-controls"><span class="management-status" role="status"></span><label>基材：<input class="material-count" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" value="${esc(m.materialCount)}" aria-label="${esc(p.name)}の基材数" autocomplete="off" enterkeyhint="done"></label><button class="state-toggle" aria-label="${esc(p.name)}の〇✕切り替え" aria-pressed="${!m.enabled}">${m.enabled?'〇':'✕'}</button></div>
  </td></tr>`;
 }).join('')}</tbody></table>`:`<div class="empty panel"><h2>${q?'一致する商品がありません':'まだ商品がありません'}</h2><p class="muted">${q?'検索する文字を変えてください。':'最初のプライスカードを登録しましょう。'}</p></div>`;
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detail(products.find(p=>p.id===b.dataset.id)));
 document.querySelectorAll('[data-product]').forEach(row=>{
  const id=row.dataset.product,input=row.querySelector('.material-count'),toggle=row.querySelector('.state-toggle'),status=row.querySelector('.management-status');
  const paint=p=>{const m=management(p);input.value=m.materialCount;toggle.textContent=m.enabled?'〇':'✕';toggle.setAttribute('aria-pressed',String(!m.enabled));row.classList.toggle('is-gray',isGray(p));};
  const save=async patch=>{
   const previous=products.find(p=>p.id===id);
   try{management({...previous,...patch});}catch(e){input.value=management(previous).materialCount;status.textContent=e.message;return;}
   paint({...previous,...patch});input.disabled=toggle.disabled=true;status.textContent='保存中…';
   try{const saved=await saveManagement(id,patch);paint(saved);status.textContent='';}
   catch(e){paint(products.find(p=>p.id===id)||previous);status.textContent='保存できませんでした。再度お試しください。';}
   finally{input.disabled=toggle.disabled=false;}
  };
  input.onchange=()=>save({materialCount:input.value.trim()});
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}};
  toggle.onclick=()=>save({enabled:!management(products.find(p=>p.id===id)).enabled});
 });
};
$('#sort-products').onclick=async()=>{await managementQueue;order=products.slice().sort(compareInventory).map(p=>p.id);list();toast('白背景 → グレー背景、それぞれ登録日の新しい順に並べました');};
list();$('#search').oninput=list;$('#scan').onclick=scanner;$('#manual').onclick=()=>editor({...emptyProduct(),barcodes:[]});$('#export').onclick=exportData;$('#import').onclick=()=>$('#backup').click();$('#backup').onchange=importData;
}
let managementQueue=Promise.resolve();
function saveManagement(id,patch){
 const task=managementQueue.then(async()=>{
  const latest=(await db.all()).find(p=>p.id===id);if(!latest)throw Error('商品が削除されています');
  const updated={...latest,...management({...latest,...patch}),updatedAt:new Date().toISOString()};
  await db.write([updated]);products=products.map(p=>p.id===id?updated:p);return updated;
 });
 managementQueue=task.catch(()=>{});return task;
}
function scanner(){
 if(busy)return;currentImage=null;captureSample=null;capturedAt='';
 const gate=new CaptureGate(lastSavedSample);
 screen(`<div class="scan-top"><button class="back" id="back">☰ 商品一覧</button><span class="count">今回 ${sessionCount}件 保存</span></div><h1>カードに合わせて、保存。</h1><div class="camera"><video id="video" playsinline muted autoplay></video><div class="guide"><span>カード全体を枠いっぱいに</span></div></div><p id="camera-status" role="status">カメラを起動しています…</p><label class="check"><input id="auto" type="checkbox" checked>静止したカードを自動で読み取る</label><div class="actions"><button id="start" hidden>カメラを再開</button><button id="capture" class="primary" disabled>今すぐ読み取る</button></div><div class="actions secondary"><button id="upload">画像から</button><button id="manual">手入力</button></div><input class="file-input" id="image-file" type="file" accept="image/*">`);
 app.className='scan-page';$('#back').onclick=home;$('#start').onclick=()=>startCamera(gate);
 $('#capture').onclick=()=>captureCard();$('#upload').onclick=()=>$('#image-file').click();$('#manual').onclick=()=>editor({...emptyProduct(),barcodes:[]});
 $('#image-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>30*1024*1024)throw Error('画像は30MB以下で選択してください');const image=await createImageBitmap(f);const scale=Math.min(1,2200/Math.max(image.width,image.height));const c=crop(image,0,0,image.width,image.height,scale);image.close();cropEditor(c);}catch(err){toast('画像を開けませんでした。'+err.message);}};
 startCamera(gate);
}
async function startCamera(gate=new CaptureGate(lastSavedSample)){
 const token=epoch;$('#start').disabled=true;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('HTTPSまたはlocalhostで開いてください');
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
  if(token!==epoch){s.getTracks().forEach(t=>t.stop());return;}
  stream=s;$('#video').srcObject=s;await $('#video').play();if(token!==epoch)return;
  $('#start').hidden=true;$('#capture').disabled=false;
  $('#camera-status').textContent=lastSavedSample?'次のカードに合わせてください。同じカードの連続撮影を抑止しています。':'枠に合わせて少し静止すると読み取ります。反応しない場合は下のボタンを押してください。';
  autoCapture(token,gate);
 }catch(e){if(token!==epoch)return;stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera-status').textContent='カメラを利用できません。カメラの許可を確認するか、画像から・手入力をご利用ください。';$('#start').hidden=false;$('#start').disabled=false;}
}
function cameraFrame(){
 const v=$('#video');if(!v?.videoWidth||!v.videoHeight)throw Error('カメラの準備中です');
 const rect=v.getBoundingClientRect(),guide=$('.guide').getBoundingClientRect();
 const scale=Math.max(rect.width/v.videoWidth,rect.height/v.videoHeight),ox=(v.videoWidth-rect.width/scale)/2,oy=(v.videoHeight-rect.height/scale)/2;
 return crop(v,ox+(guide.left-rect.left)/scale,oy+(guide.top-rect.top)/scale,guide.width/scale,guide.height/scale);
}
function sampleFrame(c){const small=document.createElement('canvas');small.width=64;small.height=64;const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(c,0,0,64,64);return frameSample(ctx.getImageData(0,0,64,64).data,64,64);}
function captureCard(c=null,sample=null,key=''){
 if(busy)return;try{const frame=c||cameraFrame();captureSample={...(sample||sampleFrame(frame)),key};capturedAt=new Date().toISOString();readCard(frame);}catch{toast('カメラの準備ができてからお試しください');}
}
async function autoCapture(token,gate){
 if(token!==epoch||!stream||busy)return;
 try{if($('#auto').checked){const c=cameraFrame(),sample=sampleFrame(c);const result=await decode(c);if(token!==epoch||busy)return;const key=result.length===1?result[0].format+':'+result[0].rawValue:'';if(gate.update(sample,key)){captureCard(c,sample,key);return;}}}catch{/* Try the next frame; manual capture remains available. */}
 if(token===epoch)timer=setTimeout(()=>autoCapture(token,gate),600);
}

function cropEditor(image){currentImage=image;screen(`<button class="back" id="back">← 読み取り直し</button><h1>カードの範囲を指定</h1><p>カードの左上から右下へドラッグしてください。傾きが大きい場合は撮り直してください。</p><div class="crop-wrap"><canvas id="crop-canvas"></canvas><div class="crop-box" id="crop-box"></div></div><p class="muted">1枚だけを、余白を少なく囲みます。枠は何度でも引き直せます。</p><div class="actions"><button id="rotate">90°回転</button><button id="whole">画像全体</button></div><button id="read" class="primary" style="width:100%">この範囲を読み取る</button>`);const c=$('#crop-canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);let selection={x:0,y:0,w:1,h:1},start=null;const render=()=>{const b=$('#crop-box');Object.assign(b.style,{left:selection.x*100+'%',top:selection.y*100+'%',width:selection.w*100+'%',height:selection.h*100+'%'});};render();const point=e=>{const r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};c.onpointerdown=e=>{start=point(e);c.setPointerCapture(e.pointerId);};c.onpointermove=e=>{if(!start)return;const p=point(e);selection={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};render();};c.onpointerup=()=>{start=null;};c.onpointercancel=()=>{start=null;};$('#whole').onclick=()=>{selection={x:0,y:0,w:1,h:1};render();};$('#rotate').onclick=()=>{const n=document.createElement('canvas');n.width=image.height;n.height=image.width;const ctx=n.getContext('2d');ctx.translate(n.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0);cropEditor(n);};const cornersButton=document.createElement('button');cornersButton.textContent='傾き補正：四隅を指定';cornersButton.style.marginTop='12px';$('#read').before(cornersButton);cornersButton.onclick=()=>cornerEditor(image);$('#back').onclick=scanner;$('#read').onclick=()=>{if(selection.w*c.width<70||selection.h*c.height<70){toast('カード全体を囲んでください');return;}readCard(crop(c,selection.x*c.width,selection.y*c.height,selection.w*c.width,selection.h*c.height));};}
function cornerEditor(image){screen('<button class="back" id="back">← 範囲指定に戻る</button><h1>カードの四隅をタップ</h1><p id="corner-status">1. 左上をタップしてください</p><div class="crop-wrap"><canvas id="corners"></canvas></div><div class="actions"><button id="reset">やり直す</button><button id="correct" class="primary" disabled>補正して読み取る</button></div>');const c=$('#corners');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');let points=[];const draw=()=>{ctx.drawImage(image,0,0);ctx.fillStyle='#edff65';ctx.strokeStyle='#12605b';ctx.lineWidth=3;for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,Math.max(5,c.width*.009),0,Math.PI*2);ctx.fill();ctx.stroke();}};draw();c.onpointerdown=e=>{if(points.length===4)return;const r=c.getBoundingClientRect();points.push({x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height});draw();$('#corner-status').textContent=['','2. 右上をタップしてください','3. 右下をタップしてください','4. 左下をタップしてください','四隅を指定しました'][points.length];$('#correct').disabled=points.length!==4;};$('#reset').onclick=()=>cornerEditor(image);$('#back').onclick=()=>cropEditor(image);$('#correct').onclick=()=>{const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%4];return sum+p.x*q.y-q.x*p.y;},0))/2;const cross=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});if(area<4900||cross.some(n=>n<=0)){toast('左上・右上・右下・左下の順に、カード全体を指定してください');return;}readCard(straighten(image,points));};}
async function readCard(c){const readAt=new Date().toISOString();screen('<h1>カードを読み取り中</h1><div class="panel progress"><div class="spinner"></div><p id="progress" role="status">バーコードを確認しています…</p><p class="muted">画像は外部へ送信されません。</p></div>');busy=true;currentImage=c;try{const result=await recognize(c,s=>$('#progress').textContent=s);busy=false;editor({...result.product,capturedAt,readAt,barcodes:result.barcodes,barcodeJan:result.product.jan,ocr:result.regions,ocrConfidence:result.confidence},result.warning);}catch(e){busy=false;editor({...emptyProduct(),capturedAt,readAt,barcodes:[]},'読み取れませんでした。手入力してください。');}}
function editor(p,warning=''){
 draft={...p};const editing=Boolean(p.id);
 screen(`<button class="back" id="cancel">${editing?'← 商品詳細':'← 次のスキャン'}</button><h1>${editing?'商品情報を編集':'読み取り結果'}</h1><p class="muted">必要な箇所だけ直して、保存。</p>${warning?`<div class="notice">${esc(warning)}</div>`:''}<form id="form"><div class="panel"><label>商品名<input name="name" value="${esc(p.name)}" required maxlength="300" autocomplete="off" enterkeyhint="next"></label><label>JAN<input name="jan" value="${esc(p.jan)}" inputmode="numeric" autocomplete="off" enterkeyhint="done"></label><p id="jan-status" class="muted" aria-live="polite"></p><p id="form-error" class="error-text" role="alert"></p></div><div class="entry-actions"><button class="primary" id="save-product" type="submit">${editing?'変更を保存':'保存して次へ'}</button><button type="button" id="retry">読み取り直し</button></div></form>${currentImage?'<details><summary>撮影したカードを見る・範囲を調整</summary><img id="review-image" class="preview" alt="読み取り対象のカード"><button id="adjust">範囲を調整して読み取り直す</button></details>':''}${sourceInfo(p)}`);
 app.className='entry-page';if(currentImage){$('#review-image').src=currentImage.toDataURL('image/jpeg',.85);$('#adjust').onclick=()=>cropEditor(currentImage);}
 const janInput=$('[name=jan]');
 const check=()=>{const j=janInput.value.trim(),existing=products.find(x=>x.jan===j&&x.id!==p.id);$('#jan-status').textContent=existing?`登録済み：${existing.name}。「保存して更新」でこの商品を更新します。`:j?(validJan(j)?'✓ JANのチェックデジットは正しいです':'JANの桁数・チェックデジットを確認してください。'):'JANは未登録です。バーコードを使うには入力してください。';$('#save-product').textContent=editing?'変更を保存':existing?'保存して更新・次へ':'保存して次へ';};
 janInput.oninput=check;check();$('#cancel').onclick=editing?()=>detail(p):scanner;$('#retry').onclick=scanner;
 let saving=false;
 $('#form').onsubmit=async e=>{
  e.preventDefault();if(saving)return;saving=true;const button=$('#save-product');button.disabled=true;
  try{
   const data=Object.fromEntries(new FormData(e.target));let item={...emptyProduct(),...draft,...Object.fromEntries(['name','jan'].map(k=>[k,data[k].trim()]))};validateProduct(item);
   // Re-read immediately before saving so another tab's data is not merged from a stale list.
   const latest=await db.all();const existing=latest.find(x=>x.jan&&x.jan===item.jan&&x.id!==item.id);
   if(existing){if(item.id)throw Error('別の商品とJANが重複しています。JANを修正してください。');item=mergeScan(existing,item);}
   const now=new Date().toISOString();item.id||=crypto.randomUUID();item.createdAt||=now;item.updatedAt=now;await db.write([item]);
   products=latest.filter(x=>x.id!==item.id).concat(item);currentImage=null;
   if(editing){toast('変更を保存しました');detail(item);}else{sessionCount++;lastSavedSample=captureSample;toast(existing?'更新しました。次のカードへ':'保存しました。次のカードへ');scanner();}
  }catch(err){$('#form-error').textContent=err.name==='ConstraintError'?'同じJANの商品が追加されました。もう一度保存してください。':err.message;button.disabled=false;}finally{saving=false;}
 };
}

function sourceInfo(p){return `<details><summary>読み取り元のデータ</summary><p>検出形式・デコード全文（未検出時は空欄）</p><pre>${esc(JSON.stringify(p.barcodes||[],null,2))}</pre>${p.ocr?`<p>OCR原文</p><pre>${esc(JSON.stringify(p.ocr,null,2))}</pre>`:''}</details>`;}
function barcode(p,target){const el=document.querySelector(target);el.innerHTML='';const originals=(p.barcodes||[]).filter(b=>p.barcodeJan===p.jan&&b.format==='CODE_128'&&/^[\x20-\x7e]+$/.test(b.rawValue));let value,format,label;if(originals.length===1){value=originals[0].rawValue;format='CODE128';label='検出したCODE 128の全文から再生成。元の符号化構成・店舗スキャナでの動作は未検証です。';}else if(validJan(p.jan)){value=p.jan;format=p.jan.length===13?'EAN13':'EAN8';label='JANのみの仮バーコードです。元カードとの同一性は未確認です。店舗スキャナで検証してください。';}else{el.innerHTML='<p>有効なJANがないため表示できません。</p>';return;}el.innerHTML='<svg role="img" aria-label="商品バーコード"></svg><p class="muted"></p>';try{JsBarcode(el.querySelector('svg'),value,{format,width:3,height:110,marginLeft:36,marginRight:36,marginTop:16,marginBottom:16,displayValue:true,fontSize:21,background:'#ffffff',lineColor:'#000000'});const svg=el.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);el.querySelector('p').textContent=label;}catch{el.textContent='この形式は表示できません。読み取り元のデータを確認してください。';}}
function detail(p){screen(`<button class="back" id="back">← 商品一覧</button><div class="eyebrow">PRODUCT DETAILS</div><h1>${esc(p.name)}</h1><div class="panel"><dl>${Object.entries(fields).filter(([k])=>k==='jan'||(k!=='name'&&p[k])).map(([k,label])=>`<dt>${label}</dt><dd>${esc(p[k]||'未登録')}${k.startsWith('price')&&p[k]?' 円':''}</dd>`).join('')}</dl></div><div class="actions"><button id="edit">編集する</button><button id="delete" class="danger">削除する</button></div>${sourceInfo(p)}<section class="panel"><h2>商品バーコード</h2><div class="barcode-box" id="barcode"></div><button id="expand" class="primary" style="width:100%">バーコードを大きく表示</button></section>`);barcode(p,'#barcode');$('#back').onclick=home;$('#edit').onclick=()=>editor(p);$('#delete').onclick=async()=>{if(await ask('商品を削除しますか？',`「${p.name}」を端末から削除します。`,'削除する'))try{await db.write([],p.id);toast('削除しました');home();}catch{toast('削除できませんでした');}};$('#expand').onclick=()=>expanded(p);}
async function expanded(p){screen(`<section class="barcode-screen"><button class="back" id="back">← 商品詳細</button><h1>${esc(p.name)}</h1><p class="muted">画面の明るさを上げて、スキャナに向けてください。</p><div id="large-barcode" class="barcode-box full-barcode"></div><div class="notice">左右の白い余白も含めて提示してください。横向きにすると幅を広く使えます。</div></section>`);barcode(p,'#large-barcode');$('#back').onclick=()=>detail(p);const token=epoch;try{const lock=await navigator.wakeLock?.request('screen');if(token===epoch)wake=lock;else await lock?.release();}catch{}}
async function exportData(){try{const rows=await db.all();const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),products:rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`card-note-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{toast('書き出しに失敗しました');}}
async function importData(e){const f=e.target.files[0];if(!f)return;try{if(f.size>10*1024*1024)throw Error('ファイルは10MB以下にしてください');const incoming=parseImport(await f.text());const existing=await db.all();const duplicates=incoming.filter(p=>p.jan&&existing.some(x=>x.jan===p.jan)).length;if(!await ask('バックアップを読み込む',`${incoming.length}件中、同じJANの${duplicates}件はスキップし、新しい商品だけ追加します。`,'読み込む'))return;const now=new Date().toISOString();const add=incoming.filter(p=>!p.jan||!existing.some(x=>x.jan===p.jan)).map(p=>({...p,id:crypto.randomUUID(),createdAt:p.createdAt||now,updatedAt:p.updatedAt||now}));await db.write(add);toast(`${add.length}件を読み込みました`);home();}catch(err){toast('読み込めませんでした。'+err.message);}finally{e.target.value='';}}
$('#home-link').onclick=e=>{e.preventDefault();home();};document.addEventListener('visibilitychange',()=>{if(document.hidden&&stream){stop();if($('#start')){$('#start').hidden=false;$('#start').disabled=false;$('#capture').disabled=true;$('#camera-status').textContent='カメラを停止しました。再開するにはカメラ起動を押してください。';}}});window.addEventListener('pagehide',()=>{stop();releaseOCR().catch(()=>{});});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>toast('オフライン準備に失敗しました。オンラインで再読み込みしてください。'));
async function boot(){try{products=await db.all();scanner();}catch{await home();}}
boot();

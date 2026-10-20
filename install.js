export const VERSION='0.3.1';
export function installView(standalone,promptAvailable){
 return standalone?'standalone':promptAvailable?'ready':'unknown';
}
const panel=document.querySelector('#install-panel');
if(panel){
 let pending=null;
 const button=document.querySelector('#install-button'),status=document.querySelector('#install-status');
 const mode=matchMedia('(display-mode: standalone)');
 const render=()=>{
  const state=installView(mode.matches||navigator.standalone===true,Boolean(pending));
  button.hidden=state!=='ready';
  status.textContent=state==='standalone'?'アプリとして起動しています。':state==='ready'?'この端末にインストールできます。':'Chromeからインストールの許可を受け取れていません。インストール済みかどうかは、この画面では確認できません。Chromeのメニューから「ホーム画面に追加」を確認してください。';
 };
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;render();});
 window.addEventListener('appinstalled',()=>{pending=null;render();status.textContent='Chromeからインストール受付の通知がありました。完了後、ホーム画面から開いてください。';});
 mode.addEventListener('change',render);
 button.onclick=async()=>{
  if(!pending)return;const event=pending;pending=null;button.disabled=true;
  try{await event.prompt();const choice=await event.userChoice;render();status.textContent=choice.outcome==='accepted'?'インストールを受け付けました。完了後、ホーム画面から開いてください。':'インストールをキャンセルしました。';}
  catch{render();status.textContent='インストール画面を開けませんでした。Chromeのメニューから確認してください。';}
  finally{button.disabled=false;}
 };
 render();
 if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{document.querySelector('#update-notice').hidden=false;});
 }
}

export async function prepareUpdate(){
 if(!('serviceWorker'in navigator))throw Error('このブラウザでは更新機能を利用できません。AndroidのChromeで開いてください。');
 const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
 await registration.update();
 const worker=registration.installing||registration.waiting||registration.active;
 if(!worker)throw Error('更新を開始できませんでした。');
 if(worker.state!=='activated')await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>done(Error('更新に時間がかかっています。通信を確認して、もう一度押してください。')),90000);
  function done(error){clearTimeout(timeout);worker.removeEventListener('statechange',check);error?reject(error):resolve();}
  function check(){if(worker.state==='activated')done();else if(worker.state==='redundant')done(Error('更新ファイルを取得できませんでした。通信と空き容量を確認してください。'));}
  worker.addEventListener('statechange',check);check();
 });
 const version=await new Promise((resolve,reject)=>{
  const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(Error('最新版を確認できませんでした。もう一度お試しください。'));},5000);
  channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data);};
  worker.postMessage('VERSION',[channel.port2]);
 });
 if(version!==VERSION)throw Error('公開ファイルの更新待ちです。少し待って再度お試しください。');
}

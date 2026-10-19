import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../install.js',import.meta.url),'utf8')).replace(/export /g,'');
function setup(standalone=false){
 const elements=Object.fromEntries(['install-panel','install-button','install-status','update-notice'].map(id=>['#'+id,{hidden:true,textContent:''}]));
 const events={};const context=vm.createContext({document:{querySelector:id=>elements[id]},matchMedia:()=>({matches:standalone,addEventListener(){}}),navigator:{},window:{addEventListener:(name,fn)=>events[name]=fn}});
 vm.runInContext(source,context);return {elements,events,context};
}
test('イベントがない場合は未インストールともインストール済みとも断定しない',()=>{
 const {elements}=setup();assert.equal(elements['#install-button'].hidden,true);assert.match(elements['#install-status'].textContent,/確認できません/);
 assert.match(setup(true).elements['#install-status'].textContent,/アプリとして起動/);
});
test('Chromeが許可した場合だけインストールボタンを表示し、拒否後の二重promptを防ぐ',async()=>{
 const {elements,events}=setup();let calls=0,prevented=false;
 events.beforeinstallprompt({preventDefault(){prevented=true;},async prompt(){calls++;},userChoice:Promise.resolve({outcome:'dismissed'})});
 assert.equal(prevented,true);assert.equal(elements['#install-button'].hidden,false);
 await elements['#install-button'].onclick();await elements['#install-button'].onclick();
 assert.equal(calls,1);assert.equal(elements['#install-button'].hidden,true);assert.match(elements['#install-status'].textContent,/キャンセル/);
});
test('インストール受付と実際の起動成功を区別し、prompt失敗も表示する',async()=>{
 const {elements,events}=setup();events.appinstalled();assert.match(elements['#install-status'].textContent,/受付/);
 events.beforeinstallprompt({preventDefault(){},async prompt(){throw Error('Unavailable');}});
 await elements['#install-button'].onclick();assert.match(elements['#install-status'].textContent,/開けません/);assert.equal(elements['#install-button'].disabled,false);
});
test('更新はworkerの実バージョンを確認する。旧版なら成功扱いしない',async()=>{
 const {context}=setup();let version='0.1.1';
 context.setTimeout=setTimeout;context.clearTimeout=clearTimeout;
 context.MessageChannel=class{constructor(){this.port1={close(){}};this.port2={reply:data=>this.port1.onmessage({data})};}};
 context.navigator.serviceWorker={register:async()=>({update:async()=>{},active:{state:'activated',postMessage:(message,ports)=>ports[0].reply(version)}})};
 await assert.rejects(context.prepareUpdate(),/更新待ち/);version='0.2.9';await context.prepareUpdate();
});

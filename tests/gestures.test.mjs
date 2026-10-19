import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachLongPress} from '../gestures.js';
function setup(){
 const handlers={},tasks=new Map();let holds=0,id=0;
 const row={isConnected:true,addEventListener:(name,fn)=>handlers[name]=fn};
 attachLongPress(row,()=>holds++,{setTimeout:(fn,delay)=>{assert.equal(delay,600);tasks.set(++id,fn);return id;},clearTimeout:id=>tasks.delete(id)});
 const send=(name,extra={})=>{let blocked=false;handlers[name]({button:0,isPrimary:true,clientX:0,clientY:0,pointerId:1,target:{closest:()=>null},preventDefault:()=>blocked=true,stopImmediatePropagation:()=>blocked=true,...extra});return blocked;};
 return {row,send,tick:()=>{for(const [id,fn] of [...tasks]){tasks.delete(id);fn();}},holds:()=>holds};
}
test('静止長押しだけで確認を呼び、直後の商品詳細クリックを抑止する',()=>{
 const s=setup();s.send('pointerdown');s.tick();assert.equal(s.holds(),1);s.send('pointerup');assert.equal(s.send('click'),true);assert.equal(s.send('click'),false);
});
test('短いタップ・移動・キャンセル・欄外への移動では長押しを起動しない',()=>{
 for(const [event,extra] of [['pointerup',{}],['pointermove',{clientX:9}],['pointercancel',{}],['pointerleave',{}]]){
  const s=setup();s.send('pointerdown');s.send(event,extra);s.tick();assert.equal(s.holds(),0);assert.equal(s.send('click'),false);
 }
});
test('基材や〇✕、右クリック、複数指、削除済み行は対象にしない',()=>{
 for(const extra of [{target:{closest:()=>({})}},{button:2},{isPrimary:false}]){const s=setup();s.send('pointerdown',extra);s.tick();assert.equal(s.holds(),0);}
 const s=setup();s.send('pointerdown');s.row.isConnected=false;s.tick();assert.equal(s.holds(),0);
});
test('コンテキストメニューを抑止するが基材入力のメニューは妨げない',()=>{
 const s=setup();assert.equal(s.send('contextmenu'),true);assert.equal(s.send('contextmenu',{target:{closest:()=>({})}}),false);
});

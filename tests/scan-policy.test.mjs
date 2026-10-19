import {test} from 'node:test';import assert from 'node:assert/strict';
import {frameSample,CaptureGate} from '../scan-policy.js';
function cardPixels(ink=true){const a=new Uint8ClampedArray(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const black=ink&&x>8&&x<55&&((y>7&&y<12&&x%4<2)||(y>53&&y<60&&x%3===0));const i=(y*64+x)*4;a[i]=a[i+1]=a[i+2]=black?30:235;a[i+3]=255;}return a;}
test('白紙は撮影せず、白地の文字とバーがあるカードのみ候補にする',()=>{assert.equal(frameSample(cardPixels(false),64,64).cardLike,false);assert.equal(frameSample(cardPixels(),64,64).cardLike,true);});
test('安定した4フレームで撮影し、動きがある場合は数え直す',()=>{const g=new CaptureGate(),s=frameSample(cardPixels(),64,64);assert.equal(g.update(s),false);assert.equal(g.update(s),false);assert.equal(g.update({...s,pixels:s.pixels.map((v,i)=>v+(i%2?30:-30))}),false);assert.equal(g.update(s),false);assert.equal(g.update(s),false);assert.equal(g.update(s),false);assert.equal(g.update(s),true);});
test('保存した同じJANを連続撮影せず、異なるJANは撮影できる',()=>{const s=frameSample(cardPixels(),64,64),g=new CaptureGate({...s,key:'EAN_13:A'});for(let i=0;i<8;i++)assert.equal(g.update(s,'EAN_13:A'),false);for(let i=0;i<3;i++)assert.equal(g.update(s,'EAN_13:B'),false);assert.equal(g.update(s,'EAN_13:B'),true);});
test('バーコードなしの同じカードを抑止、カードを外せば再開',()=>{const s=frameSample(cardPixels(),64,64),g=new CaptureGate({...s,key:''});for(let i=0;i<8;i++)assert.equal(g.update(s),false);const empty=frameSample(cardPixels(false),64,64);g.update(empty);g.update(empty);for(let i=0;i<3;i++)assert.equal(g.update(s),false);assert.equal(g.update(s),true);});

test('白地の条件に合わなくても模様が4フレーム静止したら撮影する',()=>{const s={pixels:[30,180,45,190],cardLike:false,contentLike:true},g=new CaptureGate();for(let i=0;i<3;i++)assert.equal(g.update(s),false);assert.equal(g.update(s),true);});
test('露出変化は静止として扱い、ゆっくりした累積移動では撮影しない',()=>{
 const s={pixels:[60,160,70,180],cardLike:true},g=new CaptureGate();for(let i=0;i<3;i++)assert.equal(g.update({...s,pixels:s.pixels.map(v=>v+i*8)}),false);assert.equal(g.update({...s,pixels:s.pixels.map(v=>v+24)}),true);
 const moving=new CaptureGate();for(let i=0;i<8;i++)assert.equal(moving.update({...s,pixels:s.pixels.map((v,j)=>v+(j%2?i*7:-i*7))}),false);
});

// Touch has its own lifecycle: browser pointercancel/leave must not cancel a still finger.
export function attachLongPress(row,onHold,clock={setTimeout,clearTimeout}){
 let timer=null,start=null,held=false;
 const control=target=>Boolean(target.closest('input,label,.state-toggle'));
 const cancel=()=>{if(timer!==null)clock.clearTimeout(timer);timer=null;start=null;};
 const fire=()=>{if(held||!start||!row.isConnected)return;held=true;cancel();onHold();};
 const begin=(x,y,id)=>{cancel();held=false;start={x,y,id};timer=clock.setTimeout(fire,450);};
 const move=(x,y,id)=>{if(start&&(id!==start.id||Math.hypot(x-start.x,y-start.y)>12))cancel();};
 row.addEventListener('touchstart',e=>{cancel();held=false;if(e.touches.length!==1||control(e.target))return;const t=e.touches[0];begin(t.clientX,t.clientY,t.identifier);},{passive:true});
 row.addEventListener('touchmove',e=>{if(e.touches.length!==1){cancel();return;}const t=e.touches[0];move(t.clientX,t.clientY,t.identifier);},{passive:true});
 row.addEventListener('touchend',cancel,{passive:true});
 row.addEventListener('touchcancel',cancel,{passive:true});
 row.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;cancel();held=false;
  if(e.isPrimary===false||e.button!==0||control(e.target))return;
  begin(e.clientX,e.clientY,e.pointerId);
 });
 row.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')move(e.clientX,e.clientY,e.pointerId);});
 for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])row.addEventListener(event,e=>{if(e.pointerType!=='touch')cancel();});
 row.addEventListener('click',e=>{if(held){held=false;e.preventDefault();e.stopImmediatePropagation();}},true);
 row.addEventListener('contextmenu',e=>{if(!control(e.target)){e.preventDefault();fire();}});
}

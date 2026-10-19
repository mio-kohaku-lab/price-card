// Do not prevent pointerdown: native vertical/horizontal scrolling must remain available.
export function attachLongPress(row,onHold,clock={setTimeout,clearTimeout}){
 let timer=null,start=null,held=false;
 const control=target=>Boolean(target.closest('input,label,.state-toggle'));
 const cancel=()=>{if(timer!==null)clock.clearTimeout(timer);timer=null;start=null;};
 row.addEventListener('pointerdown',e=>{
  cancel();held=false;
  if(e.isPrimary===false||e.button!==0||control(e.target))return;
  start={x:e.clientX,y:e.clientY,id:e.pointerId};
  timer=clock.setTimeout(()=>{timer=null;if(!start||!row.isConnected)return;held=true;start=null;onHold();},600);
 });
 row.addEventListener('pointermove',e=>{if(start&&(e.pointerId!==start.id||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8))cancel();});
 for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])row.addEventListener(event,cancel);
 row.addEventListener('click',e=>{if(held){held=false;e.preventDefault();e.stopImmediatePropagation();}},true);
 row.addEventListener('contextmenu',e=>{if(!control(e.target))e.preventDefault();});
}

// A conservative visual trigger, not a claim that the printed fields are readable.
export function frameSample(rgba,width,height){
 const pixels=[],region={top:[0,0],bottom:[0,0],edge:[0,0]};let white=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2],v=Math.round(.299*r+.587*g+.114*b);pixels.push(v);
  const isWhite=v>165&&Math.max(r,g,b)-Math.min(r,g,b)<65;if(isWhite)white++;
  if(y<height*.4){region.top[0]++;if(v<125)region.top[1]++;}
  if(y>height*.65){region.bottom[0]++;if(v<125)region.bottom[1]++;}
  if(x<width*.04||x>width*.96||y<height*.025||y>height*.975){region.edge[0]++;if(isWhite)region.edge[1]++;}
 }
 const sorted=[...pixels].sort((a,b)=>a-b),contrast=sorted[Math.floor(sorted.length*.95)]-sorted[Math.floor(sorted.length*.05)];
 let edges=0;for(let y=0;y<height;y++)for(let x=1;x<width;x++)if(Math.abs(pixels[y*width+x]-pixels[y*width+x-1])>18)edges++;
 const contentLike=contrast>35&&edges/(width*height)>.025;
 return {pixels,contentLike,cardLike:white/pixels.length>.50&&region.top[1]/region.top[0]>.012&&region.bottom[1]/region.bottom[0]>.025&&region.edge[1]/region.edge[0]>.35};
}
export function frameDifference(a,b){if(!a||!b||a.length!==b.length)return Infinity;return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;}
export class CaptureGate{
 constructor(blocked=null){this.blocked=blocked;this.previous=null;this.count=0;this.empty=0;this.status='searching';this.anchor=null;}
 update(sample,key=''){
  const candidate=Boolean(key)||sample.cardLike||sample.contentLike;
  if(!candidate){this.status='searching';if(++this.empty>=2)this.blocked=null;this.count=0;this.previous=null;this.anchor=null;return false;}this.empty=0;
  if(this.blocked&&((key&&this.blocked.key)?key===this.blocked.key:frameDifference(sample.pixels,this.blocked.pixels)<12)){this.status='blocked';this.count=0;this.previous=null;this.anchor=null;return false;}
  if(this.blocked&&frameDifference(sample.pixels,this.blocked.pixels)>=12)this.blocked=null;
  const stable=this.previous&&motionDifference(sample.pixels,this.previous.pixels)<8&&motionDifference(sample.pixels,this.anchor)<12&&key===this.previous.key;
  if(!stable)this.anchor=sample.pixels;this.count=stable?this.count+1:1;this.status=this.count>1?'steady':'settling';this.previous={...sample,key};return this.count>=4;
 }
}

// Ignore uniform exposure changes when checking movement, but retain spatial changes.
export function motionDifference(a,b){
 if(!a||!b||a.length!==b.length)return Infinity;
 const delta=a.reduce((sum,v,i)=>sum+v-b[i],0)/a.length;
 return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]-delta),0)/a.length;
}

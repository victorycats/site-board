'use strict';
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const W=6000,H=2200,NW=104,NH=196,GAP=16,PAD=18,HEAD=72;
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
function safePath(v){return typeof v==='string'&&v.length<200&&/^[A-Za-z0-9_./-]+$/.test(v)&&!v.includes('..');}
function dataImage(v){return typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);}
function hashFrac(str,salt){let h=2166136261;for(const c of str+salt){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;}
async function render(board,storage){
  const canvas=createCanvas(W,H),g=canvas.getContext('2d');
  g.fillStyle='#ece3cd';g.fillRect(0,0,W,H);
  const frames=board.reservations||{},list=Object.entries(board.posts||{}).map(([id,p])=>({id,...p}));
  const indexes={},groups={};
  for(const p of list)if(p.fid&&frames[p.fid])(groups[p.fid]??=[]).push(p);
  for(const group of Object.values(groups))group.sort((a,b)=>(a.t||0)-(b.t||0)).forEach((p,i)=>indexes[p.id]=i);
  for(const p of list){
    let source;
    if(safePath(p.imgPath)){
      const {data,error}=await storage.download(p.imgPath);
      if(error||!data)throw Error('Cannot load note '+p.id);
      source=Buffer.from(await data.arrayBuffer());
    }else{
      const data=board.imgs?.[p.id]||p.img;
      if(!dataImage(data))throw Error('Missing image for note '+p.id);
      source=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
    }
    const im=await loadImage(source);
    if(!(im.width>0&&im.height>0))throw Error('Invalid image for note '+p.id);
    const fr=p.fid&&frames[p.fid];
    const land=fr?fr.ori==='l':!!p.land,w=land?160:NW,h=w*im.height/im.width;
    if(fr){
      const cellH=land?150:NH;
      const cols=Math.max(1,Math.floor(((fr.rw||0)*W-2*PAD+GAP)/(w+GAP)+1e-6));
      const i=indexes[p.id]||0;
      g.drawImage(im,(fr.rx||0)*W+PAD+(i%cols)*(w+GAP),(fr.ry||0)*H+HEAD+PAD+Math.floor(i/cols)*(cellH+GAP),w,h);
    }else{
      const x=clamp(typeof p.nx==='number'?p.nx:hashFrac(p.id,'x'))*(W-NW);
      const y=clamp(typeof p.ny==='number'?p.ny:hashFrac(p.id,'y'))*(H-NH);
      g.save();g.translate(x+w/2,y+h/2);g.rotate((p.angle||0)*Math.PI/180);g.drawImage(im,-w/2,-h/2,w,h);g.restore();
    }
  }
  return canvas.encode('jpeg',85);
}
module.exports={render};

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {render}=require('../render');
test('renders portrait, rotated landscape and framed note on a full-sized board',async()=>{
 const note=createCanvas(30,45),g=note.getContext('2d');g.fillStyle='#ffffff';g.fillRect(0,0,30,45);g.fillStyle='#000000';g.fillRect(5,5,20,35);
 const b=await note.encode('png');
 const board={posts:{a:{imgPath:'a.png',nx:0.05,ny:0.05},b:{imgPath:'a.png',nx:0.2,ny:0.2,land:true,angle:25},c:{imgPath:'a.png',fid:'frame',t:1}},reservations:{frame:{rx:0.5,ry:0.2,rw:0.1,ori:'p'}}};
 const bytes=await render(board,{download:async()=>({data:new Blob([b]),error:null})});
 const image=await loadImage(bytes);assert.equal(image.width,6000);assert.equal(image.height,2200);
 const result=createCanvas(6000,2200);const ctx=result.getContext('2d');ctx.drawImage(image,0,0);
 const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
 assert.ok(pixel(350,200)[0]<80);assert.ok(pixel(3070,560)[0]<80);assert.ok(pixel(5999,2199)[0]>200);
 require('node:fs').writeFileSync(require('node:path').join(__dirname,'../../render-test.jpg'),bytes);
});
test('missing image aborts rather than silently saving an incomplete board',async()=>{
 await assert.rejects(render({posts:{a:{}}},{}),/Missing image/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {due,digest,imageState,commitReset,cycle}=require('../core');
const NOW=1800000000000;
function fixture(){return {meta:{board:9,resetDays:14,serverReset:true},boards:{9:{count:1,startedAt:NOW-14*86400000,posts:{a:{imgPath:'a.png',nx:0.3}}}}};}
function expected(root){return {id:9,hash:digest(imageState(root.boards[9]))};}
test('exact deadline, days disabled, and count trigger',()=>{
 const b={startedAt:NOW-14*86400000,count:0};
 assert.equal(due({resetDays:14},b,NOW-1),false);assert.equal(due({resetDays:14},b,NOW),true);
 assert.equal(due({resetDays:0},b,NOW),false);assert.equal(due({resetDays:0},{count:300},NOW),true);
});
test('one atomic transition sets fresh timestamp and keeps old notes',()=>{
 const root=fixture(),e=expected(root);
 assert.ok(commitReset(root,e,{clean:'a.jpg'},NOW));
 assert.equal(root.meta.board,10);assert.equal(root.boards[10].startedAt,NOW);
 assert.ok(root.boards[9].posts.a);assert.equal(due(root.meta,root.boards[10],NOW),false);
 assert.equal(commitReset(root,e,{},NOW),undefined);
});
test('reject changes to notes, frame geometry, settings or next-board collision',()=>{
 for(const mutate of [r=>r.boards[9].posts.a.nx=0.6,r=>r.boards[9].reservations={x:{rw:0.5}},r=>r.meta.resetDays=90,r=>r.boards[10]={count:5},r=>r.meta.serverReset=false]){
  const root=fixture(),e=expected(root);mutate(root);assert.equal(commitReset(root,e,{},NOW),undefined);assert.equal(root.meta.board,9);
 }
});
test('like changes do not cause unnecessary archive retries',()=>{
 const root=fixture(),e=expected(root);root.boards[9].posts.a.sou=5;assert.ok(commitReset(root,e,{},NOW));
});
function harness({failUpload=false,failVerify=false,change=false}={}){
 let root=fixture();const stored=new Map();let uploads=0;
 const ref=path=>({get:async()=>({val:()=>structuredClone(path==='meta'?root.meta:root.boards[9])}),transaction:async cb=>{
  const copy=structuredClone(root);if(change)copy.boards[9].posts.new={imgPath:'new.png'};
  const v=cb(copy);if(v)root=v;return {committed:!!v};
 }});
 return {db:{ref},storage:{remove:async paths=>{for(const p of paths)stored.delete(p);return {error:null};},upload:async(p,b)=>{uploads++;if(failUpload)return {error:{message:'failed'}};stored.set(p,b);return {error:null};},download:async p=>({error:failVerify?{message:'failed'}:null,data:new Blob([stored.get(p)])})},render:async()=>Buffer.from('jpeg'),now:()=>NOW,logger:{info(){},warn(){}},root:()=>root,uploads:()=>uploads};
}
test('successful cycle uploads and verifies the image before commit',async()=>{
 const h=harness();assert.equal((await cycle(h)).status,'reset');assert.equal(h.uploads(),1);assert.equal(h.root().meta.board,10);
});
test('upload and verification failures do not advance',async()=>{
 for(const opts of [{failUpload:true},{failVerify:true}]){const h=harness(opts);await assert.rejects(cycle(h));assert.equal(h.root().meta.board,9);}
});
test('changed board during archive aborts transition',async()=>{
 const h=harness({change:true});assert.equal((await cycle(h)).status,'conflict');assert.equal(h.root().meta.board,9);
});
test('render failure keeps current board and does not upload',async()=>{
 const h=harness();h.render=async()=>{throw Error('missing image');};await assert.rejects(cycle(h));assert.equal(h.uploads(),0);assert.equal(h.root().meta.board,9);
});

test('reserved slot without a completed note prevents premature reset',async()=>{
 const h=harness();h.root().boards[9].count=2;await assert.rejects(cycle(h),/Post count differs/);assert.equal(h.root().meta.board,9);assert.equal(h.uploads(),0);
});

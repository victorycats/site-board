'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const r=require('../../database.rules.json').rules;
const admin='VRZS1oZuihN7if6GD2yuP1qvDik1';
const snap=v=>({val:()=>v,exists:()=>v!=null,isNumber:()=>typeof v==='number',isBoolean:()=>typeof v==='boolean',child:path=>snap(path.split('/').reduce((a,k)=>a?.[k],v))});
function permitted(expr,uid,mode,bid='9',dataValue=9,newValue=10){
 return Function('auth','root','data','newData','$bid','return '+expr)({uid},snap({meta:{serverReset:mode,board:9},boards:{9:{count:300}}}),snap(dataValue),snap(newValue),bid);
}
test('server mode blocks browser board advance including administrator',()=>{
 assert.equal(permitted(r.meta.board['.write'],admin,true),false);
 assert.equal(permitted(r.meta.board['.write'],'visitor',true),false);
 assert.equal(permitted(r.meta.board['.write'],admin,false),true);
 assert.equal(permitted(r.meta.board['.write'],'visitor',false),true);
});
test('mode switch is readable by visitors and writable only by administrator',()=>{
 assert.equal(permitted(r.meta.serverReset['.write'],admin,true),true);
 assert.equal(permitted(r.meta.serverReset['.write'],'visitor',true),false);
});
test('every old-board write permission includes the active-board guard',()=>{
 let n=0;
 function walk(v){for(const [k,x] of Object.entries(v)){if(k==='.write'&&typeof x==='string'){assert.ok(x.includes("$bid === ''+root.child('meta/board').val()"));n++;}else if(x&&typeof x==='object')walk(x);}}
 walk(r.boards.$bid);assert.equal(n,12);
 const count=r.boards.$bid.count['.write'];
 assert.equal(permitted(count,'visitor',true,'8'),false);
 assert.equal(permitted(count,'visitor',true,'9'),true);
});
test('server mode blocks legacy locks, pending and reset-log writes',()=>{
 for(const node of [r.boards.$bid.archiving,r.boards.$bid.advancing,r.meta.pendingArchive.$bid,r.meta.resetLog.$bid])assert.equal(permitted(node['.write'],admin,true),false);
});

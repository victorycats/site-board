'use strict';
const {createHash}=require('node:crypto');
const DAY=86400000;
function stable(v){
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function digest(v){return createHash('sha256').update(stable(v)).digest('hex');}
function due(meta,board,now){
  const days=meta.resetDays;
  const limit=Number.isInteger(meta.boardLimit)&&meta.boardLimit>=10&&meta.boardLimit<=1000?meta.boardLimit:300;
  return Number(board.count||0)>=limit || (typeof days==='number'&&days>0&&days<=90&&Number.isFinite(board.startedAt)&&now>=board.startedAt+days*DAY);
}
function imageState(board){
  // Likes do not affect the saved artwork; edits, additions, deletions and movement do.
  const posts={};
  for(const [id,p] of Object.entries(board.posts||{})){
    posts[id]={};
    for(const key of ['imgPath','img','nx','ny','angle','land','fid','t','hidden'])if(p[key]!==undefined)posts[id][key]=p[key];
  }
  return {posts,imgs:board.imgs||{},reservations:board.reservations||{},count:board.count||0,startedAt:board.startedAt??null};
}
function commitReset(root,expected,archive,now){
  if(!root||root.meta?.serverReset!==true||root.meta.board!==expected.id)return;
  const board=root.boards?.[expected.id];
  if(!board||!due(root.meta,board,now)||digest(imageState(board))!==expected.hash)return;
  // Never overwrite a preexisting next board, including an old board selected by an administrator.
  if(root.boards?.[expected.id+1])return;
  root.meta.resetLog??={};
  root.meta.resetLog[expected.id]={at:now,count:board.count||0,...archive,auto:true,server:true};
  if(root.meta.pendingArchive)delete root.meta.pendingArchive[expected.id];
  board.closedAt=now;
  root.boards[expected.id+1]={startedAt:now,count:0};
  root.meta.board=expected.id+1;
  return root;
}
async function cycle({db,storage,render,now=Date.now,logger=console}){
  const meta=(await db.ref('meta').get()).val()||{};
  if(meta.serverReset!==true)return {status:'disabled'};
  const id=meta.board;
  if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid meta/board');
  const board=(await db.ref('boards/'+id).get()).val();
  if(!board)throw Error('Current board is missing');
  if(!Number.isFinite(board.startedAt)){
    // Existing installations without a start date begin their first period now.
    await db.ref('boards/'+id+'/startedAt').transaction(v=>v==null?now():undefined);
    return {status:'initialized'};
  }
  if(!due(meta,board,now()))return {status:'not-due'};
  if(Number(board.count||0)!==Object.keys(board.posts||{}).length)throw Error('Post count differs from saved notes; a post is in flight or count needs repair. Current board left intact.');
  const hash=digest(imageState(board));
  const stamp=new Date(now()).toISOString().slice(0,19).replace(/[:T]/g,'-');
  const prefix='archives/board-'+id+'-'+stamp;
  const clean=prefix+'.jpg';
  const image=await render(board,storage);
  // The old RTDB board remains intact; no user metadata is copied into public Storage.
  try {
  for(const [path,data,type] of [[clean,image,'image/jpeg']]){
    const {error}=await storage.upload(path,data,{contentType:type,upsert:true});
    if(error)throw Error('Archive upload failed: '+error.message);
    const check=await storage.download(path);
    if(check.error||!check.data||check.data.size!==data.length)throw Error('Archive verification failed');
  }
  } catch(error) {
    await storage.remove([clean]).catch(()=>{});
    throw error;
  }
  const rootRef=db.ref();
  // Populate the transaction cache before comparing the entire database snapshot.
  await rootRef.get();
  const result=await rootRef.transaction(root=>commitReset(root,{id,hash},{stamp,clean},now()),undefined,false);
  if(!result.committed){const cleanup=await storage.remove([clean]);if(cleanup.error)throw Error('Archive conflict cleanup failed');logger.warn('Board changed during archive; left current board intact. Retry next cycle.');return {status:'conflict'};}
  logger.info('Archived board '+id+'; advanced to '+(id+1));
  return {status:'reset',id,clean};
}
module.exports={due,digest,imageState,commitReset,cycle};

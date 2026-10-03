'use strict';
const {initializeApp,cert,deleteApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const {createClient}=require('@supabase/supabase-js');
const {cycle,due}=require('./core');
const {render}=require('./render');
async function main(){
  const json=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!json)throw Error('FIREBASE_SERVICE_ACCOUNT_JSON secret is missing');
  const account=JSON.parse(json);
  if(account.project_id!=='fg21-dk2027-writeboard')throw Error('Service account project does not match site');
  const app=initializeApp({credential:cert(account),databaseURL:'https://fg21-dk2027-writeboard-default-rtdb.asia-southeast1.firebasedatabase.app'});
  try{
    const db=getDatabase(app);
    if(process.env.RESET_DRY_RUN!=='false'){
      const meta=(await db.ref('meta').get()).val()||{};
      const board=(await db.ref('boards/'+meta.board).get()).val()||{};
      console.log(JSON.stringify({dryRun:true,serverReset:meta.serverReset===true,board:meta.board,resetDays:meta.resetDays,startedAt:board.startedAt??null,due:due(meta,board,Date.now())}));
      return;
    }
    const key=process.env.SUPABASE_STORAGE_SERVER_KEY;
    if(!key)throw Error('SUPABASE_STORAGE_SERVER_KEY secret is missing');
    const supa=createClient('https://oicwpmyvophbzfaqfbka.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}});
    console.log(JSON.stringify(await cycle({db,storage:supa.storage.from('board-images'),render})));
  }finally{await deleteApp(app);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

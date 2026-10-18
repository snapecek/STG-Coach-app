// Repeatable release checks: fictional backend only, no cloud writes or secrets.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const env={...process.env,VITE_SUPABASE_URL:'https://stg-test.example.invalid',VITE_SUPABASE_ANON_KEY:'sb_publishable_fictional_release_checks'};
for(const key of Object.keys(env))if(key.startsWith('STG_')||/SERVICE_ROLE|PRIVATE_KEY|DISPATCH_SECRET|RESEND_API_KEY/.test(key))delete env[key];
const flags=[...new Set(fs.readFileSync('scripts/check-member-ui.cjs','utf8').match(/STG_[A-Z_]+_ONLY/g))].sort();
const logDir=fs.mkdtempSync(path.join(os.tmpdir(),'trenomi-release-ui-'));
let server,failed=false;
async function run(args,extra={}){
 const name=(extra.flag||path.basename(args.at(-1)))+(extra.engine?'-'+extra.engine:''),file=path.join(logDir,name+'.log'),log=fs.openSync(file,'w');
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{env:{...env,...(extra.flag?{[extra.flag]:'1'}:{}),...(extra.engine?{STG_BROWSER:extra.engine}:{})},stdio:['ignore',log,log]});const timer=setTimeout(()=>child.kill('SIGTERM'),180000);child.on('error',()=>resolve(-1));child.on('exit',code=>{clearTimeout(timer);resolve(code)});});
 fs.closeSync(log);console.log((code===0?'PASS ':'FAIL ')+name);if(code!==0){failed=true;console.error(fs.readFileSync(file,'utf8'))}
}
(async()=>{
 if(process.env.UI_EXTERNAL_SERVER!=='1')server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort'],{env,stdio:['ignore','ignore','inherit']});
 try{
  let ready=false;for(let i=0;i<100;i++){if(server?.exitCode!=null)throw new Error('Vite failed to start');try{const response=await fetch('http://127.0.0.1:5173');if(response.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  if(!ready)throw new Error('Vite did not start');
  for(const flag of flags)await run(['scripts/check-member-ui.cjs'],{flag});
  await run(['scripts/check-member-ui.cjs'],{flag:'STG_ANALYSIS_LAYOUT_ONLY',engine:'webkit'});
  await run(['scripts/check-member-ui.cjs'],{flag:'STG_EXPERIENCE_ONLY',engine:'webkit'});
  for(const file of ['check-auth-persistence.cjs','check-share-editor.cjs','check-share-touch-ui.cjs','check-journal-share-dialog.cjs','check-release-runtime.cjs'])await run(['scripts/'+file]);
  console.log('Browser logs: '+logDir);if(failed)process.exitCode=1;
 }finally{server?.kill('SIGTERM')}
})().catch(error=>{console.error(error.message);server?.kill('SIGTERM');process.exitCode=1});

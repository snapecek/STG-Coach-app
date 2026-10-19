// Local packaged assets only. Never inject private backend credentials.
const {spawnSync}=require('node:child_process');
(async()=>{
 const {loadEnv}=await import('vite'),env={...loadEnv('native',process.cwd(),'VITE_'),...process.env};
 const url=new URL(env.VITE_SUPABASE_URL||'');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Nastavte veřejnou HTTPS adresu Supabase.');
 const key=env.VITE_SUPABASE_ANON_KEY||'';
 if(!key.startsWith('sb_publishable_')){const payload=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString());if(payload.role!=='anon')throw new Error('Nativní balíček smí obsahovat pouze veřejný publishable/anon klíč.');}
 const publicUrl=new URL(env.VITE_PUBLIC_APP_URL||'');
 if(publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password||publicUrl.pathname!=='/'||publicUrl.search||publicUrl.hash||['localhost','127.0.0.1','::1'].includes(publicUrl.hostname))throw new Error('Nastavte VITE_PUBLIC_APP_URL na veřejnou kořenovou HTTPS adresu webové aplikace.');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit',env});if(result.status!==0)process.exit(result.status||1);
 const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','native','--outDir','dist-native'],{stdio:'inherit',env});process.exitCode=build.status||0;
})().catch(()=>{console.error('Nativní build nelze připravit. Zkontrolujte .env.native.local: VITE_SUPABASE_URL, veřejný VITE_SUPABASE_ANON_KEY a HTTPS VITE_PUBLIC_APP_URL. Soukromé klíče sem nepatří.');process.exitCode=1});

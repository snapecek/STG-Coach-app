// Authenticated, bounded operational reports. Intentionally no arbitrary error
// text, stack, URL, user/club identifiers or attachment payloads in the log.
const limits=new Map();
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end()}
 const value=req.body;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='incident,kind,release,scope,screen'||!['render','module','slow'].includes(value.kind)||!['root','section'].includes(value.scope)||!['overview','calendar','attendance','members','analysis','journal','templates','auth','unknown'].includes(value.screen)||!/^[-a-zA-Z0-9_.]{1,80}$/.test(value.release)||! /^[a-f0-9-]{36}$/.test(value.incident))return res.status(400).end();
 const authorization=req.headers.authorization;
 if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._-]{10,4096}$/.test(authorization))return res.status(401).end();
 const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)return res.status(503).end();
 try{
  const auth=await fetch(new URL('/auth/v1/user',url),{headers:{Authorization:authorization,apikey:key},signal:AbortSignal.timeout(5000)});
  if(!auth.ok)return res.status(401).end();
  const user=await auth.json();if(typeof user.id!=='string')return res.status(401).end();
  const now=Date.now();for(const [id,entry] of limits)if(entry.until<=now)limits.delete(id);
  const entry=limits.get(user.id)||{count:0,until:now+60000};
  if(entry.count>=10||(!limits.has(user.id)&&limits.size>=1000))return res.status(429).end();
  entry.count++;limits.set(user.id,entry);
  console.error(JSON.stringify({event:'trenomi.client_error',incident:value.incident,release:value.release,kind:value.kind,scope:value.scope,screen:value.screen}));
  return res.status(204).end();
 }catch{return res.status(503).end()}
}

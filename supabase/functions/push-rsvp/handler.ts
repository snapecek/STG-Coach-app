export type PushJob={job_id:number;token:string;endpoint:string;p256dh:string;auth:string;payload:{title:string;body:string;url:string;tag:string;expiresAt:string}};
export type PushDeps={configured:()=>boolean;publicKey:()=>string;dispatchSecret:()=>string;claim:()=>Promise<PushJob[]>;send:(job:PushJob,ttl:number)=>Promise<void>;finish:(job:PushJob,outcome:'sent'|'expired'|'retry')=>Promise<void>};
export function allowedPushEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)&&u.pathname.length>1}catch{return false}}
function sameSecret(actual:string,expected:string){if(expected.length<32||actual.length!==expected.length)return false;let difference=0;for(let i=0;i<expected.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return difference===0}
export function pushHandler(appUrl:string,deps:PushDeps){
 const site=new URL(appUrl);if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw new Error('Fixed HTTPS APP_URL required');
 return async(req:Request)=>{
  const headers={'Access-Control-Allow-Origin':site.origin,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'},reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==site.origin)return reply(403,{error:'Nepovolený původ.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method==='GET')return deps.configured()?reply(200,{publicKey:deps.publicKey()}):reply(503,{error:'Mobilní oznámení nejsou na serveru aktivovaná.'});
  if(req.method!=='POST')return reply(405,{error:'Nepovolená metoda.'});
  if(!sameSecret(req.headers.get('Authorization')||'','Bearer '+deps.dispatchSecret()))return reply(401,{error:'Neplatné ověření.'});
  if(!deps.configured())return reply(503,{error:'Odesílání není nastavené.'});
  try{
   const jobs=await deps.claim();let accepted=0,retry=0,expired=0;
   for(const job of jobs){
    // Never let a stored subscription turn the privileged worker into an arbitrary HTTP client.
    const destination=new URL(job.payload.url,site.origin);const ttl=Math.min(3600,Math.floor((Date.parse(job.payload.expiresAt)-Date.now())/1000));
    if(!allowedPushEndpoint(job.endpoint)||destination.origin!==site.origin||!Number.isFinite(ttl)||ttl<=0){await deps.finish(job,'sent');continue}
    let outcome:'sent'|'expired'|'retry'='sent';
    try{await deps.send(job,ttl);accepted++}catch(e){const status=Number((e as {statusCode?:number})?.statusCode);outcome=status===404||status===410?'expired':'retry';if(outcome==='expired')expired++;else retry++}
    // Acknowledgement failure retains the lease for retry; never claim successful delivery to the caller.
    await deps.finish(job,outcome);
   }
   return reply(200,{accepted,retry,expired});
  }catch{return reply(502,{error:'Odesílání se nepodařilo dokončit. Fronta zůstává připravená pro další pokus.'})}
 };
}

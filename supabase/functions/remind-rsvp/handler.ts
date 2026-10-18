import type {RsvpEmail} from './email.ts';
export type EmailJob={job_id:number;token:string};
export type EmailDeps={configured:()=>boolean;dispatchSecret:()=>string;claim:()=>Promise<EmailJob[]>;prepare:(job:EmailJob)=>Promise<RsvpEmail|null>;send:(item:RsvpEmail,key:string)=>Promise<void>;finish:(job:EmailJob,outcome:'sent'|'skipped'|'retry')=>Promise<void>};
function authorized(actual:string,secret:string){if(secret.length<32||actual.length!==secret.length+7)return false;const expected='Bearer '+secret;let diff=0;for(let i=0;i<expected.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0}
export function rsvpEmailHandler(deps:EmailDeps){return async(req:Request)=>{
 const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'Použijte POST.'});
 // This endpoint is scheduler-only, never a browser-controlled mailing API.
 if(req.headers.has('Origin'))return reply(403,{error:'Nepovolený původ.'});
 if(!authorized(req.headers.get('Authorization')||'',deps.dispatchSecret()))return reply(401,{error:'Neplatné ověření.'});
 if(!deps.configured())return reply(503,{error:'E-mailová připomenutí nejsou nakonfigurovaná.'});
 try{
  const jobs=await deps.claim();let accepted=0,skipped=0,retry=0;
  for(const job of jobs){
   let outcome:'sent'|'skipped'|'retry';
   try{const item=await deps.prepare(job);if(!item)outcome='skipped';else{await deps.send(item,'trenomi-rsvp24-'+job.job_id);outcome='sent'}}catch{outcome='retry'}
   // If acknowledgement fails, keep the lease and fail the run. A later retry
   // uses the same provider idempotency key, so accepted mail is not duplicated.
   await deps.finish(job,outcome);
   if(outcome==='sent')accepted++;else if(outcome==='skipped')skipped++;else retry++;
  }
  return reply(200,{accepted,skipped,retry});
 }catch{return reply(502,{error:'Frontu připomenutí se nepodařilo zpracovat.'})}
};}

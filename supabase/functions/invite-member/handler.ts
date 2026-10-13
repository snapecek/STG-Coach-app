export type InviteDependencies={
 authorize:(bearer:string,clubId:string)=>Promise<boolean>;
 issue:(bearer:string,clubId:string,memberId:string,email:string)=>Promise<{id:string;token:string}>;
 send:(email:string,redirect:string)=>Promise<void>;
 revoke:(bearer:string,id:string)=>Promise<void>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invitationHandler(appUrl:string,deps:InviteDependencies){
 const site=new URL(appUrl);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw new Error('APP_URL must be a fixed HTTPS application URL');
 return async(request:Request)=>{
  const origin=request.headers.get('Origin');
  const headers={'Access-Control-Allow-Origin':site.origin,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&origin!==site.origin)return reply(403,{error:'Nepovolený původ požadavku.'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'Použijte POST.'});
  const bearer=request.headers.get('Authorization')||'';
  if(!/^Bearer \S{20,8000}$/.test(bearer))return reply(401,{error:'Přihlaste se znovu.'});
  let input:Record<string,unknown>;
  try{const body=await request.text();if(body.length>8000)return reply(413,{error:'Požadavek je příliš dlouhý.'});input=JSON.parse(body);}catch{return reply(400,{error:'Neplatný požadavek.'});}
  if(!input||typeof input.clubId!=='string'||!uuid.test(input.clubId)||typeof input.memberId!=='string'||!uuid.test(input.memberId)||typeof input.email!=='string')return reply(400,{error:'Zkontrolujte klub, člena a e-mail.'});
  const email=input.email.trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Zadejte platný e-mail.'});
  let invitation:{id:string;token:string}|undefined;
  try{
   if(!await deps.authorize(bearer,input.clubId))return reply(403,{error:'Pozvánky spravuje trenér nebo správce klubu.'});
   invitation=await deps.issue(bearer,input.clubId,input.memberId,email);
   const link=new URL(site.href);link.searchParams.set('club-invite',invitation.token);
   await deps.send(email,link.href);
   return reply(200,{id:invitation.id,link:link.href,delivery:'queued'});
  }catch{
   if(invitation){try{await deps.revoke(bearer,invitation.id);}catch{/* Do not leak tokens, email addresses or provider errors. */}}
   return reply(502,{error:'Pozvánku se nepodařilo odeslat. Zkontrolujte SMTP, nastavení Auth a propojení člena. Zkuste to později.'});
  }
 };
}

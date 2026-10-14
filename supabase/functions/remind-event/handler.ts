export function unansweredMembers<T extends {id:string;user_id:string|null;purge_after?:string|null}>(members:T[],participation:{member_id:string;response:string|null}[],selectedRoster:boolean,now=Date.now()){return members.filter(member=>{const p=participation.find(row=>row.member_id===member.id);return (!member.purge_after||Date.parse(member.purge_after)>now)&&(!selectedRoster||!!p)&&!p?.response;});}
export type Reminder={memberId:string;email:string;name:string;eventName:string;startsAt:string;place:string};
export type ReminderDeps={configured:()=>boolean;authorize:(bearer:string,club:string)=>Promise<boolean>;recipients:(bearer:string,club:string,event:string)=>Promise<{recipients:Reminder[];skipped:number}>;send:(item:Reminder,event:string,key:string)=>Promise<void>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function reminderHandler(appUrl:string,deps:ReminderDeps){const site=new URL(appUrl);if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw new Error('Fixed HTTPS APP_URL required');
 return async(req:Request)=>{const headers={'Access-Control-Allow-Origin':site.origin,'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'},reply=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers});
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==site.origin)return reply(403,{error:'Nepovolený původ.'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Použijte POST.'});
 const bearer=req.headers.get('Authorization')||'';if(!/^Bearer \S{20,8000}$/.test(bearer))return reply(401,{error:'Přihlaste se znovu.'});
 let input:{clubId:string;eventId:string;action:string};try{const body=await req.text();if(body.length>2000)return reply(413,{error:'Příliš dlouhý požadavek.'});input=JSON.parse(body);if(!input||!uuid.test(input.clubId)||!uuid.test(input.eventId)||!['preview','send'].includes(input.action))throw new Error();}catch{return reply(400,{error:'Neplatný požadavek.'})}
 try{if(!await deps.authorize(bearer,input.clubId))return reply(403,{error:'Připomenutí může odeslat trenér nebo správce klubu.'});if(!deps.configured())return reply(503,{error:'E-mailová připomenutí nejsou nakonfigurovaná. Správce musí nastavit funkci remind-event a odesílací službu.'});const {recipients,skipped}=await deps.recipients(bearer,input.clubId,input.eventId);if(recipients.length>100)return reply(400,{error:'Jedno připomenutí podporuje nejvýše 100 příjemců.'});
 if(input.action==='preview')return reply(200,{eligible:recipients.length,skipped});
 let accepted=0,failed=0;const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 // Provider idempotency prevents duplicate delivery on retry within this Prague calendar day.
 for(const item of recipients){try{await deps.send(item,input.eventId,`stg-reminder-${input.eventId}-${item.memberId}-${day}`);accepted++}catch{failed++}}
 return reply(200,{eligible:recipients.length,accepted,failed,skipped});
 }catch{return reply(400,{error:'Připomenutí nelze připravit. Obnovte data; událost musí být budoucí, nezrušená a ve vašem klubu.'})}
 };
}

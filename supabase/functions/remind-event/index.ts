import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {unansweredMembers,reminderHandler,type Reminder} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,appUrl=Deno.env.get('APP_URL')||'https://project-ym4q2.vercel.app/';
const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('REMINDER_FROM');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},scoped=(bearer:string)=>createClient(url,anon,{...options,global:{headers:{Authorization:bearer}}}),admin=createClient(url,service,options);
Deno.serve(reminderHandler(appUrl,{
 configured:()=>!!key&&!!from,
 async authorize(bearer,club){const c=scoped(bearer),{data,error}=await c.auth.getUser();if(error||!data.user)return false;const role=await c.rpc('has_club_role',{target:club,roles:['owner','coach']});return !role.error&&role.data===true},
 async recipients(bearer,club,event){const c=scoped(bearer);const e=await c.from('events').select('id,name,place,starts_at,status,event_kind,roster_only').eq('club_id',club).eq('id',event).single();if(e.error||!e.data||e.data.status!=='scheduled'||Date.parse(e.data.starts_at)<=Date.now())throw new Error('Invalid event');
 const m=await c.from('members').select('id,name,user_id,purge_after').eq('club_id',club).is('removed_at',null).limit(501);if(m.error||!m.data||m.data.length>500)throw new Error('Roster too large');
 const p=await c.from('participation').select('member_id,response').eq('club_id',club).eq('event_id',event).limit(501);if(p.error||!p.data||p.data.length>500)throw new Error('Roster unavailable');
 const unanswered=unansweredMembers(m.data,p.data,!!(e.data.roster_only||e.data.event_kind==='race'));if(unanswered.filter(m=>m.user_id).length>100)throw new Error('Recipient limit');
 const recipients:Reminder[]=[];let skipped=0;
 for(const member of unanswered){if(!member.user_id){skipped++;continue}const account=await admin.auth.admin.getUserById(member.user_id);if(account.error)throw new Error('Auth unavailable');if(!account.data.user?.email||!account.data.user.email_confirmed_at){skipped++;continue}recipients.push({memberId:member.id,email:account.data.user.email,name:member.name,eventName:e.data.name,place:e.data.place,startsAt:e.data.starts_at})}return {recipients,skipped};
 },
 async send(item,event,idempotency){
  const when=new Date(item.startsAt).toLocaleString('cs-CZ',{timeZone:'Europe/Prague',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
  const text=`Dobrý den, ${item.name},\n\nprosím potvrďte svou účast na události ${item.eventName}.\n${when} (Praha)\nMísto: ${item.place}\n\nOtevřete Trenomi a zvolte Jdu / Nejdu / Možná:\n${new URL('/',appUrl).href}\n\nPřipomenutí odeslal trenér vašeho klubu.`;
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify({from,to:[item.email],subject:'Trenomi: potvrďte účast',text})});if(!response.ok)throw new Error('Provider rejected');}finally{await new Promise(resolve=>setTimeout(resolve,550));}
 }
}));

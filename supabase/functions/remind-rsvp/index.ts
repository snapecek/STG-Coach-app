import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {rsvpEmailHandler} from './handler.ts';
import {rsvpEmail,type RsvpEmail} from './email.ts';
const key=Deno.env.get('RESEND_API_KEY')||'',from=Deno.env.get('REMINDER_FROM')||'',secret=Deno.env.get('PUSH_DISPATCH_SECRET')||'';
const appUrl=Deno.env.get('APP_URL')||'https://project-ym4q2.vercel.app/';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
Deno.serve(rsvpEmailHandler({
 configured:()=>!!key&&!!from&&secret.length>=32,dispatchSecret:()=>secret,
 async claim(){const {data,error}=await admin.rpc('claim_member_rsvp_email_jobs',{batch_size:10});if(error)throw new Error('Queue unavailable');return data||[]},
 async prepare(job){const {data,error}=await admin.rpc('prepare_member_rsvp_email',{target_job:job.job_id,expected_token:job.token});if(error)throw new Error('Recipient unavailable');return data?.[0] as RsvpEmail||null},
 async send(item,idempotency){
  const mail=rsvpEmail(appUrl,item);
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify({from,to:[item.email],subject:mail.subject,html:mail.html,text:mail.text})});if(!response.ok)throw new Error('Provider rejected mail');}
  finally{await new Promise(resolve=>setTimeout(resolve,550))}
 },
 async finish(job,result){const {error}=await admin.rpc('finish_member_rsvp_email',{target_job:job.job_id,expected_token:job.token,result});if(error)throw new Error('Acknowledgement failed')}
}));

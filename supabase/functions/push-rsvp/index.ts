import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import {pushHandler,type PushJob} from './handler.ts';
const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'',privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||'',secret=Deno.env.get('PUSH_DISPATCH_SECRET')||'';
const appUrl=Deno.env.get('APP_URL')||'https://project-ym4q2.vercel.app/';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
Deno.serve(pushHandler(appUrl,{
 configured:()=>/^[A-Za-z0-9_-]{87}$/.test(publicKey)&&/^[A-Za-z0-9_-]{43}$/.test(privateKey)&&secret.length>=32,
 publicKey:()=>publicKey,dispatchSecret:()=>secret,
 async claim(){const {data,error}=await admin.rpc('claim_coach_push_jobs',{batch_size:10});if(error)throw new Error('Queue unavailable');return data as PushJob[]},
 async send(job,ttl){await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify(job.payload),{TTL:ttl,timeout:8000,urgency:'high',vapidDetails:{subject:new URL(appUrl).origin,publicKey,privateKey}})},
 async finish(job,outcome){const {error}=await admin.rpc('finish_coach_push_job',{target_job:job.job_id,expected_token:job.token,outcome});if(error)throw new Error('Acknowledgement failed')}
}));

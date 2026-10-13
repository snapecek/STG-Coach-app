import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {invitationHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl=Deno.env.get('APP_URL')||'https://project-ym4q2.vercel.app/';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const scoped=(bearer:string)=>createClient(url,anon,{...options,global:{headers:{Authorization:bearer}}});
const admin=createClient(url,service,options);
Deno.serve(invitationHandler(appUrl,{
 async authorize(bearer,clubId){const client=scoped(bearer);const {data,error}=await client.auth.getUser();if(error||!data.user)return false;const role=await client.rpc('has_club_role',{target:clubId,roles:['owner','coach']});return !role.error&&role.data===true;},
 async issue(bearer,clubId,memberId,email){const {data,error}=await scoped(bearer).rpc('issue_club_invitation',{target_club:clubId,target_member:memberId,target_email:email});if(error||!data)throw new Error('Invitation failed');return data;},
 async send(email,redirect){
  const invitation=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:redirect});
  if(!invitation.error)return;
  // Existing accounts receive a login link directly to their verified email.
  if(!['email_exists','user_already_exists'].includes(invitation.error.code||'')&&!/already (?:been )?registered|already exists/i.test(invitation.error.message))throw new Error('Auth delivery failed');
  const mail=createClient(url,anon,options);
  const {error}=await mail.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect}});
  if(error)throw new Error('Auth delivery failed');
 },
 async revoke(bearer,id){const {error}=await scoped(bearer).rpc('revoke_club_invitation',{invitation_id:id});if(error)throw new Error('Revocation failed');}
}));

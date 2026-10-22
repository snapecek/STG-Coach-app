-- Applied immediately before migration 050, then checked and removed.
begin;
insert into auth.users(id,email) values('1fff0000-0000-4000-8000-000000000001','migration@example.invalid');
insert into public.clubs(id,name) values('2fff0000-0000-4000-8000-000000000001','Migration fixture');
insert into public.club_roles values('2fff0000-0000-4000-8000-000000000001','1fff0000-0000-4000-8000-000000000001','owner');
insert into public.members(id,club_id,user_id,name,kind) values('3fff0000-0000-4000-8000-000000000001','2fff0000-0000-4000-8000-000000000001','1fff0000-0000-4000-8000-000000000001','Člen','member');
insert into public.templates(id,club_id,name,type,place,minutes,training_icon)
 select md5('tri-template-'||icon)::uuid,'2fff0000-0000-4000-8000-000000000001','Původní '||icon,'Běh','Park',60,icon from (values ('medal'),('fencing'),('archery'),('nutrition'),('hurdles'),('throwing'),('rowing-pair'),('high-jump'),('shot-put'),('pool'),('stadium'),('weightlifting'),('diving'),('gym-bag'),('whistle'),('gymnastics'),('bench'),('golf'),('steeplechase'),('podium'),('swimming'),('none')) icons(icon);
insert into public.events(id,club_id,template_id,name,starts_at,type,place,plan,actual_notes,actual_duration_minutes)
 select md5('tri-event-'||training_icon)::uuid,club_id,id,'Původní '||training_icon,now()-interval '2 days',type,place,'Původní plán','Zachovaný zápis',45 from public.templates where club_id='2fff0000-0000-4000-8000-000000000001';
insert into public.participation(club_id,event_id,member_id,response,attended)
 select club_id,id,'3fff0000-0000-4000-8000-000000000001','yes',true from public.events where club_id='2fff0000-0000-4000-8000-000000000001';
update public.events set completed_at=now() where club_id='2fff0000-0000-4000-8000-000000000001';
commit;

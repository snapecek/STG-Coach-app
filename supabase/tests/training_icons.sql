-- Disposable DB only; icon snapshots, validation, series and RLS.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní klub');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fiktivní člen','member');
insert into public.templates(id,club_id,name,type,place,minutes,plan,training_icon) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Šablona','Kondice','Park',60,'Původní plán','swimming');
insert into public.events(id,club_id,template_id,name,starts_at,type,place,plan) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Trénink',now()-interval '2 days','Kondice','Park','Původní plán');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000001') is distinct from 'swimming' then raise exception 'FAIL inherited template icon';end if;
end $$;
update public.templates set training_icon='running';
update public.events set place='Jiný park';
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000001') is distinct from 'swimming' then raise exception 'FAIL snapshot changed with template';end if;
 begin
  update public.templates set training_icon='invalid';raise exception 'FAIL invalid icon accepted';
 exception when check_violation then null;end;
end $$;
-- Whole-club series inherits the template; explicit copied icons and none survive.
select count(*) from public.create_training_series('20000000-0000-4000-8000-000000000001','[
 {"id":"50000000-0000-4000-8000-000000000002","template_id":"40000000-0000-4000-8000-000000000001","name":"Nový běh","place":"Park","type":"Běh","plan":"","starts_at":"2026-12-01T18:00:00Z","duration_minutes":60},
 {"id":"50000000-0000-4000-8000-000000000003","name":"Kopie plavání","place":"Bazén","type":"Plavání","plan":"","starts_at":"2026-12-02T18:00:00Z","duration_minutes":60,"training_icon":"swimming"},
 {"id":"50000000-0000-4000-8000-000000000004","template_id":"40000000-0000-4000-8000-000000000001","name":"Bez ikony","place":"Park","type":"Běh","plan":"","starts_at":"2026-12-03T18:00:00Z","duration_minutes":60,"training_icon":"none"}
]'::jsonb);
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000002') is distinct from 'running' then raise exception 'FAIL series inheritance';end if;
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000003') is distinct from 'swimming' then raise exception 'FAIL copied icon';end if;
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000004') is distinct from 'none' then raise exception 'FAIL disabled watermark';end if;
end $$;

insert into public.training_groups(id,club_id,name) values('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní skupina');
insert into public.training_group_members(club_id,group_id,member_id) values('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
select count(*) from public.create_group_trainings('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','[
 {"id":"50000000-0000-4000-8000-000000000005","template_id":"40000000-0000-4000-8000-000000000001","name":"Skupina","place":"Park","type":"Běh","plan":"","starts_at":"2026-12-04T18:00:00Z","duration_minutes":60},
 {"id":"50000000-0000-4000-8000-000000000006","name":"Kopie pro skupinu","place":"Bazén","type":"Plavání","plan":"","starts_at":"2026-12-05T18:00:00Z","duration_minutes":60,"training_icon":"swimming"}
]'::jsonb);
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000005') is distinct from 'running' then raise exception 'FAIL group inheritance';end if;
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000006') is distinct from 'swimming' then raise exception 'FAIL group copied icon';end if;
end $$;
delete from public.templates;
do $$begin
 if exists(select 1 from public.events where template_id is not null) then raise exception 'FAIL deleted template reference';end if;
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000001') is distinct from 'swimming' then raise exception 'FAIL deletion lost icon';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n integer;begin
 update public.events set training_icon='medal';get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL member changed training icon';end if;
end $$;
rollback;

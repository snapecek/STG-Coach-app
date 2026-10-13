begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001');
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní kapacita');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach');
insert into public.members(id,club_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','Fiktivní člen '||n,'member' from generate_series(1,3) n;
insert into public.events(id,club_id,name,starts_at,place,type,capacity) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Omezený trénink',now()+interval '2 days','Park','Kondice',1);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into public.participation(club_id,event_id,member_id,response,seat_status,reservation_order) select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,'yes','confirmed',-1 from public.members order by id;
do $$begin
 if (select count(*) from public.participation where seat_status='confirmed')<>1 or (select count(*) from public.participation where seat_status='waiting')<>2 then raise exception 'FAIL capacity overflow';end if;
 if exists(select 1 from public.participation where reservation_order=-1) then raise exception 'FAIL forged ordering';end if;
end $$;
-- Staff upsert of attendance preserves the original reservation and queue position.
select set_config('stg.order',(select reservation_order::text from public.participation where member_id='30000000-0000-4000-8000-000000000002'),true);
insert into public.participation(club_id,event_id,member_id,attended,confirmed_by) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',true,'10000000-0000-4000-8000-000000000001') on conflict(event_id,member_id) do update set attended=excluded.attended,confirmed_by=excluded.confirmed_by;
update public.participation set response='no' where member_id='30000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.participation where member_id='30000000-0000-4000-8000-000000000002' and seat_status='confirmed' and attended=true and confirmed_by='10000000-0000-4000-8000-000000000001' and reservation_order::text=current_setting('stg.order')) then raise exception 'FAIL promotion or attendance';end if;
end $$;
-- Repeating yes does not jump the queue, and forged allocation is overwritten.
update public.participation set response='yes',seat_status='confirmed',reservation_order=0 where member_id='30000000-0000-4000-8000-000000000003';
do $$begin if not exists(select 1 from public.participation where member_id='30000000-0000-4000-8000-000000000003' and seat_status='waiting' and reservation_order>0) then raise exception 'FAIL queue jump';end if;end $$;
-- Leaving and rejoining goes to the end.
update public.participation set response='yes' where member_id='30000000-0000-4000-8000-000000000001';
update public.events set capacity=2;
do $$begin if not exists(select 1 from public.participation where member_id='30000000-0000-4000-8000-000000000003' and seat_status='confirmed') then raise exception 'FAIL increased capacity';end if;
 begin update public.events set capacity=1;raise exception 'FAIL reduced confirmed capacity';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
-- Archive releases its future seat, but never overwrites actual attendance.
select public.archive_club_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
do $$begin if not exists(select 1 from public.participation where member_id='30000000-0000-4000-8000-000000000001' and seat_status='confirmed') then raise exception 'FAIL archive promotion';end if;
 if not exists(select 1 from public.participation where member_id='30000000-0000-4000-8000-000000000002' and response='no' and attended=true) then raise exception 'FAIL archived attendance';end if;
end $$;
update public.events set capacity=null;
update public.participation set response='maybe' where member_id='30000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from public.participation where response<>'yes' and seat_status is not null) then raise exception 'FAIL non-yes reservation';end if;end $$;
update public.events set starts_at=now()-interval '1 day';
do $$begin begin update public.events set capacity=3;raise exception 'FAIL changed past capacity';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
set local role anon;
do $$begin begin perform public.rebalance_training_seats('50000000-0000-4000-8000-000000000001');raise exception 'FAIL exposed internal function';exception when insufficient_privilege then null;end;end $$;
rollback;

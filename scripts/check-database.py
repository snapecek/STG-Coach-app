#!/usr/bin/env python3
"""Disposable PostgreSQL migrations, RLS regressions and competing reservations.
No production credentials, network ports or hosted writes are used.
"""
import os, subprocess, uuid
from pathlib import Path
from time import sleep
root=Path(__file__).resolve().parents[1]
env=os.environ.copy()
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
name='stg-db-'+uuid.uuid4().hex[:10]
def docker(*args,**kwargs):return subprocess.run(['docker','--host=unix:///var/run/docker.sock',*args],env=env,check=True,**kwargs)
def sql(statement):return docker('exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At',input=statement,text=True,capture_output=True).stdout
try:
 docker('run','-d','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine',capture_output=True)
 for attempt in range(30):
  try:docker('exec',name,'pg_isready','-h','127.0.0.1','-U','postgres',capture_output=True);break
  except subprocess.CalledProcessError:sleep(1)
 else:raise RuntimeError('PostgreSQL did not start')
 tests=['tenant_access','club_management','journal_photos','race_results','distinct_races','member_access','training_capacity','training_groups','event_tasks','training_series','weekly_goals','journal_distance','attendance_matrix','training_performances','race_teams','training_games','member_event_roster','race_companion','preset_library_team_games','open_races','event_type_colors','communication','private_chat','member_guests','chat_mentions','club_settings','owner_controls_archive','club_activity','membership_applications','member_join_dates','recorded_training_guests','shareable_club_invitations','training_cover_photo','member_training_photos','event_location_map','saved_event_locations','coach_rsvp_push','club_fees','fee_deletion_recurring','bulk_fee_deletion','member_rsvp_email','workspace_sync_notifications']
 files=[root/'supabase/tests/local-bootstrap.sql',*sorted((root/'supabase/migrations').glob('*.sql')),*[root/f'supabase/tests/{test}.sql' for test in tests]]
 for file in files:
  try:sql(file.read_text())
  except subprocess.CalledProcessError as e:raise RuntimeError(f'{file.name}: {e.stderr}') from e
  print(f'PASS {file.name}',flush=True)
 club='20000000-0000-4000-8000-000000000099';event='50000000-0000-4000-8000-000000000099'
 sql(f"insert into clubs(id,name) values ('{club}','Fiktivní souběh');insert into members(id,club_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'{club}','Fiktivní '||n,'guest' from generate_series(98,99)n;insert into events(id,club_id,name,starts_at,place,type,capacity) values ('{event}','{club}','Souběžný trénink',now()+interval '2 days','Park','Běh',1);")
 def reserve(member):return f"insert into participation(club_id,event_id,member_id,response) values ('{club}','{event}','30000000-0000-4000-8000-{member:012d}','yes');"
 # Hold the event row after inserting first reservation. Start second while it is locked.
 process=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 process.stdin.write('begin;'+reserve(98)+"select 'LOCK_HELD';select pg_sleep(2);commit;\n");process.stdin.close()
 for line in process.stdout:
  if line.strip()=='LOCK_HELD':break
 else:raise RuntimeError('First reservation failed before locking')
 sql(reserve(99))
 if process.wait(timeout=10)!=0:raise RuntimeError(process.stderr.read())
 counts=sql(f"select count(*) filter(where seat_status='confirmed'),count(*) filter(where seat_status='waiting') from participation where event_id='{event}';").strip()
 if counts!='1|1':raise RuntimeError('Concurrent reservations exceeded capacity: '+counts)
 print('PASS competing transactions: one confirmed, one waiting',flush=True)

 # A writer that obtained an XID before the checkpoint commits after a newer
 # transaction. An inclusive snapshot xmin cursor must not lose its late write.
 import json
 sync_owner='10000000-0000-4000-8000-000000000089'
 sync_event='50000000-0000-4000-8000-000000000089'
 sql(f"insert into auth.users(id) values('{sync_owner}');insert into club_roles values('{club}','{sync_owner}','coach');")
 def changes(cursor=None):
  argument='null' if cursor is None else "'"+cursor+"'"
  result=sql(f"begin;set local role authenticated;select set_config('request.jwt.claims','{{\"sub\":\"{sync_owner}\"}}',true);select club_workspace_changes('{club}',{argument});commit;")
  return json.loads(next(line for line in result.splitlines() if '"changes"' in line))
 late=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 late.stdin.write("begin;select pg_current_xact_id();select 'SYNC_XID_HELD';\n");late.stdin.flush()
 for line in late.stdout:
  if line.strip()=='SYNC_XID_HELD':break
 else:raise RuntimeError('Sync writer failed before assigning XID')
 checkpoint=changes()['cursor']
 sql(f"insert into templates(club_id,name,place,type,minutes,plan) values('{club}','Novější změna','Park','Běh',60,'');")
 first_delta=changes(checkpoint)
 if any(c['key']==sync_event for c in first_delta['changes']):raise RuntimeError('Late writer committed before race could be tested')
 late.stdin.write(f"insert into events(id,club_id,name,starts_at,place,type) values('{sync_event}','{club}','Pozdní změna',now()+interval '3 days','Park','Běh');commit;\n");late.stdin.close()
 if late.wait(timeout=10)!=0:raise RuntimeError(late.stderr.read())
 second_delta=changes(first_delta['cursor'])
 if not any(c['key']==sync_event and c['row']['name']=='Pozdní změna' for c in second_delta['changes']):raise RuntimeError('Workspace cursor lost an older transaction committed later')
 idle=changes(second_delta['cursor'])
 if idle['changes']:raise RuntimeError('Idle workspace replayed settled changes')
 print('PASS workspace sync: out-of-order commit is replayed, settled history is not transferred',flush=True)

 # A writer already holding the club lock must finish before the archive snapshot.
 archive_club='20000000-0000-4000-8000-000000000091'
 archive_event='50000000-0000-4000-8000-000000000091'
 archive_owner='10000000-0000-4000-8000-000000000091'
 archive_member='30000000-0000-4000-8000-000000000091'
 sql(f"insert into auth.users(id) values('{archive_owner}');insert into clubs(id,name) values('{archive_club}','Fiktivní archivace');insert into club_roles values('{archive_club}','{archive_owner}','owner');insert into members(id,club_id,name,kind) values('{archive_member}','{archive_club}','Host','guest');insert into events(id,club_id,name,starts_at,place,type) values('{archive_event}','{archive_club}','Trénink',now()+interval '2 days','Park','Běh');")
 writer=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 writer.stdin.write(f"begin;insert into participation(club_id,event_id,member_id,response) values('{archive_club}','{archive_event}','{archive_member}','yes');select 'ARCHIVE_LOCK_HELD';select pg_sleep(2);commit;\n");writer.stdin.close()
 for line in writer.stdout:
  if line.strip()=='ARCHIVE_LOCK_HELD':break
 else:raise RuntimeError('Archive race writer failed')
 sql(f"begin;set local role authenticated;select set_config('request.jwt.claims','{{\"sub\":\"{archive_owner}\"}}',true);select archive_club('{archive_club}','Fiktivní archivace');commit;")
 if writer.wait(timeout=10)!=0:raise RuntimeError(writer.stderr.read())
 count=sql(f"select jsonb_array_length(snapshot->'tables'->'participation') from club_archives where club_id='{archive_club}';").strip()
 if count!='1':raise RuntimeError('Archive snapshot omitted committed participation')
 print('PASS archive vs competing writer: snapshot includes completed write before freezing club',flush=True)

 # Competing receipts cannot overpay a charge. Both RPCs serialize on the club lock.
 fee_owner='10000000-0000-4000-8000-000000000090'
 fee_member='30000000-0000-4000-8000-000000000099'
 sql(f"insert into auth.users(id) values('{fee_owner}');insert into club_roles values('{club}','{fee_owner}','owner');")
 def fee_auth(statement):return f"begin;set local role authenticated;select set_config('request.jwt.claims','{{\"sub\":\"{fee_owner}\"}}',true);{statement};commit;"
 sql(fee_auth(f"select set_club_fees_enabled('{club}',true);select create_club_fee_charges('{club}',array['{fee_member}']::uuid[],'training','Hala',8000,current_date,null,null,'{event}')"))
 charge=sql(f"select id from club_fee_charges where club_id='{club}' and member_id='{fee_member}';").strip()
 receipt_a='60000000-0000-4000-8000-000000000090';receipt_b='60000000-0000-4000-8000-000000000091'
 writer=subprocess.Popen(['docker','--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 writer.stdin.write(fee_auth(f"select record_club_fee_payment('{club}','{charge}','{receipt_a}',6000,current_date,'cash');select 'FEE_LOCK_HELD';select pg_sleep(2)")+"\n");writer.stdin.close()
 for line in writer.stdout:
  if line.strip()=='FEE_LOCK_HELD':break
 else:raise RuntimeError('First receipt failed')
 sql(fee_auth(f"do $$begin begin perform record_club_fee_payment('{club}','{charge}','{receipt_b}',6000,current_date,'bank');raise exception 'FAIL competing overpayment';exception when raise_exception then if sqlerrm<>'Fee payment exceeds balance' then raise;end if;end;end $$"))
 if writer.wait(timeout=10)!=0:raise RuntimeError(writer.stderr.read())
 paid=sql(f"select count(*),sum(amount_cents) from club_fee_payments where charge_id='{charge}' and voided_at is null;").strip()
 if paid!='1|6000':raise RuntimeError('Competing receipts overpaid: '+paid)
 print('PASS competing receipts: balance checked after prior committed payment',flush=True)

finally:
 docker('rm','-f',name,capture_output=True)

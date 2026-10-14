#!/usr/bin/env python3
"""Pilot preflight: read-only settings and club/account checks.
No fixture writes, Auth emails, invitations, password changes or migrations.
Only safe status/role/count metadata is printed, never variable or token values.
"""
import json, os, urllib.request, urllib.error
required=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','STG_TEST_EMAIL','STG_TEST_PASSWORD']
if not all(os.environ.get(n) for n in required):raise SystemExit('Chybí testovací konfigurace; hodnoty nebyly vypsány.')
base=os.environ['VITE_SUPABASE_URL'].rstrip('/')
key=os.environ['VITE_SUPABASE_ANON_KEY'];origin='https://project-ym4q2.vercel.app';sessions=[]
def request(path,method='GET',payload=None,token=None,site=False):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 if site:headers['Origin']=origin
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(payload).encode() if payload is not None else None),timeout=25) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None,r.headers.get('Access-Control-Allow-Origin')
 except urllib.error.HTTPError as e:
  return e.code,None,e.headers.get('Access-Control-Allow-Origin')
def expect(condition,label):
 if not condition:raise AssertionError(label)
 print('PASS '+label,flush=True)
def login(prefix):
 s,d,_=request('/auth/v1/token?grant_type=password','POST',{'email':os.environ[prefix+'EMAIL'],'password':os.environ[prefix+'PASSWORD']})
 expect(s==200 and d and d.get('access_token'),prefix+'přihlášení')
 sessions.append(d['access_token']);return d
try:
 s,settings,_=request('/auth/v1/settings');expect(s==200,'nastavení Auth dostupné')
 expect(settings.get('external',{}).get('email') is True,'e-mailové přihlášení zapnuté')
 expect(settings.get('disable_signup') is True,'veřejná registrace vypnutá')
 expect(settings.get('mailer_autoconfirm') is False,'ověření e-mailu zachované')
 s,_,_=request('/functions/v1/invite-member','GET',site=True);expect(s==405,'pozvánková funkce nasazená')
 s,_,allowed=request('/functions/v1/invite-member','OPTIONS',site=True);expect(s==204 and allowed==origin,'pozvánky dostupné z aplikace přes CORS')
 staff=login('STG_TEST_');token=staff['access_token']
 s,roles,_=request('/rest/v1/club_roles?select=club_id,role&user_id=eq.'+staff['user']['id'],token=token)
 expect(s==200 and any(r['role'] in ['owner','coach'] for r in roles),'testovací účet má správu klubu')
 club=next(r['club_id'] for r in roles if r['role'] in ['owner','coach'])
 for table,columns in [('club_presets','id'),('training_games','id,mode'),('training_game_teams','id')]:
  s,_,_=request('/rest/v1/'+table+'?select='+columns+'&club_id=eq.'+club+'&limit=1',token=token);expect(s==200,'migrace 020: '+table)
 members=[]
 for offset in range(0,1000000,500):
  s,rows,_=request('/rest/v1/members?select=id,user_id,removed_at&club_id=eq.'+club+'&order=id&limit=500&offset='+str(offset),token=token);expect(s==200,'členský registr dostupný')
  members.extend(rows)
  if len(rows)<500:break
 else:raise AssertionError('registr není celý načtený')
 active=[m for m in members if not m['removed_at']]
 print('INFO aktivní členské záznamy:',len(active),'z toho propojené s účtem:',sum(bool(m['user_id']) for m in active),flush=True)
 if os.environ.get('STG_MEMBER_TEST_EMAIL') and os.environ.get('STG_MEMBER_TEST_PASSWORD'):
  member=login('STG_MEMBER_TEST_');expect(member['user']['id']!=staff['user']['id'],'oddělený trenérský a členský účet')
  s,roles,_=request('/rest/v1/club_roles?select=club_id,role&user_id=eq.'+member['user']['id'],token=member['access_token']);expect(s==200 and any(r['club_id']==club and r['role']=='member' for r in roles),'člen má členskou roli ve stejném klubu')
  s,profile,_=request('/rest/v1/rpc/my_club_member','POST',{'target_club':club},token=member['access_token']);expect(s==200 and len(profile)==1,'členský účet je propojený se záznamem')
 print('UNVERIFIED doručení pozvánek a obnovy hesla; SMTP a Auth redirecty nelze potvrdit těmito veřejnými kontrolami.',flush=True)
 print('UNVERIFIED čtyři konkrétní pilotní účty a průchod jejich schránkami/prohlížeči.',flush=True)
except Exception as e:
 print('FAIL '+(str(e) if isinstance(e,AssertionError) else type(e).__name__),flush=True);raise SystemExit(1)
finally:
 for token in sessions:
  try:request('/auth/v1/logout?scope=local','POST',token=token)
  except Exception:pass

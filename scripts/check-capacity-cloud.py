#!/usr/bin/env python3
"""Opt-in hosted reservation test; touches only newly generated fictional fixtures."""
import os,json,uuid,urllib.request,urllib.error,datetime,concurrent.futures
required=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','STG_TEST_EMAIL','STG_TEST_PASSWORD']
if not all(os.environ.get(n) for n in required):raise SystemExit('Chybí testovací konfigurace; hodnoty nebyly vypsány.')
base=os.environ['VITE_SUPABASE_URL'].rstrip('/');key=os.environ['VITE_SUPABASE_ANON_KEY'];token=None;members=[];event=None;failed=False

def request(path,method='GET',payload=None,preference=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 if preference:headers['Prefer']=preference
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(payload).encode() if payload is not None else None),timeout=25) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:return e.code,None

def expect(value,label):
 if not value:raise AssertionError(label)
 print('PASS:',label,flush=True)
try:
 status,session=request('/auth/v1/token?grant_type=password','POST',{'email':os.environ['STG_TEST_EMAIL'],'password':os.environ['STG_TEST_PASSWORD']});expect(status==200,'přihlášení bez odesílání e-mailu');token=session['access_token'];uid=session['user']['id']
 status,roles=request('/rest/v1/club_roles?select=club_id,role&user_id=eq.'+uid);expect(status==200 and any(r['role']=='owner' for r in roles),'owner role');club=next(r['club_id'] for r in roles if r['role']=='owner')
 status,_=request('/rest/v1/events?select=capacity&limit=0');expect(status==200,'kapacitní migrace dostupná')
 members=[str(uuid.uuid4()) for _ in range(3)];event=str(uuid.uuid4())
 status,_=request('/rest/v1/members','POST',[{'id':m,'club_id':club,'name':'Fiktivní test čekací listiny','kind':'guest'} for m in members]);expect(status==201,'tři fiktivní hosté')
 future=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=2)).isoformat()
 status,_=request('/rest/v1/events','POST',{'id':event,'club_id':club,'name':'Fiktivní test kapacity','place':'Fiktivní park','type':'Kondice','starts_at':future,'capacity':1});expect(status==201,'fiktivní trénink s jedním místem')
 path='/rest/v1/participation?event_id=eq.'+event+'&club_id=eq.'+club
 def join(m):return request('/rest/v1/participation','POST',{'club_id':club,'event_id':event,'member_id':m,'response':'yes'})[0]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:expect(all(s==201 for s in pool.map(join,members[:2])),'dvě souběžná přihlášení')
 status,rows=request(path);expect(status==200 and sum(p['seat_status']=='confirmed' for p in rows)==1 and sum(p['seat_status']=='waiting' for p in rows)==1,'poslední místo získal jen jeden účastník')
 confirmed=next(p['member_id'] for p in rows if p['seat_status']=='confirmed');waiting=next(p['member_id'] for p in rows if p['seat_status']=='waiting')
 expect(join(members[2])==201,'třetí zájemce zařazen na konec')
 status,_=request(path+'&member_id=eq.'+waiting,'PATCH',{'attended':True,'confirmed_by':uid});expect(status==204,'samostatná trenérova docházka')
 status,_=request(path+'&member_id=eq.'+confirmed,'PATCH',{'response':'no'});expect(status==204,'uvolnění prvního místa')
 status,rows=request(path);p=next(p for p in rows if p['member_id']==waiting);expect(p['seat_status']=='confirmed' and p['attended'] is True and p['confirmed_by']==uid,'první čekající povýšen bez přepsání docházky')
 status,_=request('/rest/v1/events?id=eq.'+event+'&club_id=eq.'+club,'PATCH',{'capacity':2});expect(status==204,'zvýšení kapacity')
 status,rows=request(path);expect(sum(p['seat_status']=='confirmed' for p in rows)==2,'zvýšení kapacity potvrdilo čekajícího')
 status,_=request('/rest/v1/events?id=eq.'+event+'&club_id=eq.'+club,'PATCH',{'capacity':1});expect(status>=400,'snížení pod potvrzená místa odmítnuto')
 status,_=request('/rest/v1/rpc/archive_club_member','POST',{'target_club':club,'target_member':waiting});expect(status==200,'archivace pouze fiktivního hosta')
 status,rows=request(path);p=next(p for p in rows if p['member_id']==waiting);expect(p['response']=='no' and p['seat_status'] is None and p['attended'] is True,'archivace uvolnila rezervaci a zachovala docházku')
except Exception as e:failed=True;print('FAIL:',str(e) if isinstance(e,AssertionError) else type(e).__name__,flush=True)
finally:
 if token:
  for table,ids in [('events',[event] if event else []),('members',members)]:
   if ids:
    query='/rest/v1/'+table+'?id=in.('+','.join(ids)+')';status,_=request(query,'DELETE');check,rows=request(query+'&select=id')
    if status>=400 or check!=200 or rows!=[]:failed=True;print('FAIL: fixture cleanup '+table,flush=True)
    else:print('PASS: fixture cleanup '+table,flush=True)
  request('/auth/v1/logout?scope=local','POST')
if failed:raise SystemExit(1)

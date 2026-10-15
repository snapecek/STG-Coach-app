#!/usr/bin/env python3
"""Opt-in live self-RSVP and invitation RPC checks. Sends NO emails, changes NO passwords.
Uses one existing verified owner account and only fictional fixture club records.
"""
import json,os,uuid,urllib.request,urllib.error,datetime
names=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','STG_TEST_EMAIL','STG_TEST_PASSWORD']
if not all(os.environ.get(n) for n in names):raise SystemExit('Chybí testovací konfigurace; hodnoty nebyly vypsány.')
base=os.environ['VITE_SUPABASE_URL'].rstrip('/');key=os.environ['VITE_SUPABASE_ANON_KEY'];token=None
members=[];events=[];failed=False

def request(path,method='GET',payload=None,preference=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 if preference:headers['Prefer']=preference
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(payload).encode() if payload is not None else None),timeout=25) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:
  try:code=json.load(e).get('code','unknown')
  except Exception:code='unknown'
  return e.code,{'code':code}

def expect(value,label):
 if not value:raise AssertionError(label)
 print('PASS:',label,flush=True)
try:
 status,session=request('/auth/v1/token?grant_type=password','POST',{'email':os.environ['STG_TEST_EMAIL'],'password':os.environ['STG_TEST_PASSWORD']});expect(status==200,'přihlášení bez odesílání e-mailu');token=session['access_token'];uid=session['user']['id']
 status,roles=request('/rest/v1/club_roles?select=club_id,role&user_id=eq.'+uid);expect(status==200 and any(r['role']=='owner' for r in roles),'owner role pro fixture test');club=next(r['club_id'] for r in roles if r['role']=='owner')
 status,profile=request('/rest/v1/rpc/my_club_member','POST',{'target_club':club});expect(status==200,'dostupná členská migrace')
 member,other=str(uuid.uuid4()),str(uuid.uuid4());members=[member,other]
 for mid in members:
  status,_=request('/rest/v1/members','POST',{'id':mid,'club_id':club,'name':'Fiktivní členský RPC test','kind':'guest'});expect(status==201,'fiktivní host pro test')
 status,inv=request('/rest/v1/rpc/issue_club_invitation','POST',{'target_club':club,'target_member':member,'target_email':os.environ['STG_TEST_EMAIL']});expect(status==200 and len(inv.get('token',''))==64,'jednorázová pozvánka pouze v DB; žádný e-mail')
 status,accepted=request('/rest/v1/rpc/accept_club_invitation','POST',{'invitation_token':inv['token']})
 if profile:
  expect(status>=400,'účet se stávajícím členem nesloučí duplicitní historii');own=profile[0]['id']
 else:
  expect(status==200 and accepted==club,'ověřený účet přijme pozvánku k původnímu ID hosta')
  status,profile=request('/rest/v1/rpc/my_club_member','POST',{'target_club':club});expect(status==200 and profile[0]['id']==member,'zachována identita člena');own=member
  status,_=request('/rest/v1/rpc/accept_club_invitation','POST',{'invitation_token':inv['token']});expect(status>=400,'pozvánku nelze použít podruhé')
 status,role=request('/rest/v1/club_roles?select=role&club_id=eq.'+club+'&user_id=eq.'+uid);expect(status==200 and role[0]['role']=='owner','přijetí nesníží existující owner roli')
 future=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=2)).isoformat();eid,race=str(uuid.uuid4()),str(uuid.uuid4());events=[eid,race]
 for ident,kind in [(eid,'training'),(race,'race')]:
  status,_=request('/rest/v1/events','POST',{'id':ident,'club_id':club,'name':'Fiktivní členská událost','place':'Fiktivní park','type':'Kondice' if kind=='training' else 'OCR','plan':'Jen test','starts_at':future,'event_kind':kind,**({'capacity':1} if kind=='training' else {})});expect(status==201,'fiktivní událost pro RSVP')
 status,_=request('/rest/v1/participation','POST',{'club_id':club,'event_id':eid,'member_id':other,'response':'yes'});expect(status==201,'fiktivní první rezervace obsadí jediné místo')
 status,p=request('/rest/v1/rpc/respond_to_club_event','POST',{'target_club':club,'target_event':eid,'answer':'yes'});expect(status==200 and p['member_id']==own and p['response']=='yes' and p['attended'] is None and p['seat_status']=='waiting','čekací odpověď svázaná s vlastní identitou bez potvrzení docházky')
 status,_=request('/rest/v1/participation?club_id=eq.'+club+'&event_id=eq.'+eid+'&member_id=eq.'+own,'PATCH',{'attended':True,'confirmed_by':uid});expect(status==204,'staff potvrzení ve fiktivní události')
 status,p=request('/rest/v1/rpc/respond_to_club_event','POST',{'target_club':club,'target_event':eid,'answer':'maybe'});expect(status==200 and p['response']=='maybe' and p['attended'] is True and p['confirmed_by']==uid,'vlastní RSVP zachová trenérovu docházku')
 status,p=request('/rest/v1/rpc/respond_to_club_event','POST',{'target_club':club,'target_event':race,'answer':'yes'});expect(status==200 and p['member_id']==own and p['attended'] is None,'člen se přihlásí na závod bez předchozí soupisky')
 status,p=request('/rest/v1/rpc/respond_to_club_event','POST',{'target_club':club,'target_event':race,'answer':'no'});expect(status==200 and p['response']=='no','pozvaný závodník může odpovědět Nejdu')
 tid,other_task=str(uuid.uuid4()),str(uuid.uuid4())
 status,_=request('/rest/v1/event_tasks','POST',[{'id':tid,'club_id':club,'event_id':eid,'title':'Fiktivní vlastní úkol','assignee_id':own},{'id':other_task,'club_id':club,'event_id':eid,'title':'Fiktivní cizí úkol','assignee_id':other}]);expect(status==201,'fiktivní přiřazené úkoly')
 status,own_tasks=request('/rest/v1/rpc/my_event_tasks','POST',{'target_club':club});expect(status==200 and tid in [t['id'] for t in own_tasks] and other_task not in [t['id'] for t in own_tasks],'vlastní čtení úkolů bez cizího přiřazení')
 status,_=request('/rest/v1/rpc/complete_event_task','POST',{'target_club':club,'target_task':tid,'finished':True});expect(status in [200,204],'dokončení fiktivního úkolu')
 status,own_tasks=request('/rest/v1/rpc/my_event_tasks','POST',{'target_club':club});expect(status==200 and next(t for t in own_tasks if t['id']==tid)['completed_at'] is not None,'dokončení úkolu přetrvalo v RPC')
 status,_=request('/rest/v1/events?id=eq.'+eid+'&club_id=eq.'+club,'PATCH',{'status':'cancelled'});expect(status==204,'zrušení fiktivní události')
 status,_=request('/rest/v1/rpc/respond_to_club_event','POST',{'target_club':club,'target_event':eid,'answer':'no'});expect(status>=400,'zrušená událost nepřijímá RSVP')
 status,rows=request('/rest/v1/rpc/my_club_participation','POST',{'target_club':club});expect(status==200 and all(p['member_id']==own for p in rows),'osobní čtení vrací pouze vlastní účast')
except Exception as e:
 failed=True;print('FAIL:',str(e) if isinstance(e,AssertionError) else type(e).__name__,flush=True)
finally:
 if token:
  for table,ids in [('events',events),('members',members)]:
   if ids:
    query='/rest/v1/'+table+'?id=in.('+','.join(ids)+')'
    status,_=request(query,'DELETE');check,rows=request(query+'&select=id')
    if status>=400 or check!=200 or rows!=[]:failed=True;print('FAIL: fixture cleanup '+table,flush=True)
    else:print('PASS: fixture cleanup '+table,flush=True)
  request('/auth/v1/logout?scope=local','POST')
if failed:raise SystemExit(1)

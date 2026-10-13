#!/usr/bin/env python3
"""Opt-in API smoke test. Only fictional fixtures; removes only generated UUIDs.
Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, STG_TEST_EMAIL, STG_TEST_PASSWORD.
Run only against a development club owned by that test account.
"""
import json, os, uuid, urllib.request, urllib.error
required=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','STG_TEST_EMAIL','STG_TEST_PASSWORD']
if not all(os.environ.get(n) for n in required):
    raise SystemExit('Chybí konfigurace nebo testovací přihlášení. Hodnoty nebyly vypsány.')
base=os.environ['VITE_SUPABASE_URL'].rstrip('/')
key=os.environ['VITE_SUPABASE_ANON_KEY']
token=None

def request(path, method='GET', payload=None, preference=None, anonymous=False):
    headers={'apikey':key,'Content-Type':'application/json'}
    if token and not anonymous: headers['Authorization']='Bearer '+token
    if preference: headers['Prefer']=preference
    req=urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read()
            return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        try: code=json.load(error).get('code','unknown')
        except Exception: code='unknown'
        return error.code,{'code':code}

def expect(condition, label):
    if not condition: raise AssertionError(label)
    print('PASS:',label,flush=True)

member=str(uuid.uuid4());template=str(uuid.uuid4());events=[str(uuid.uuid4()),str(uuid.uuid4())]
failed=False
try:
    status,session=request('/auth/v1/token?grant_type=password','POST',{'email':os.environ['STG_TEST_EMAIL'],'password':os.environ['STG_TEST_PASSWORD']})
    expect(status==200,'přihlášení testovacího účtu')
    token=session['access_token'];uid=session['user']['id']
    status,roles=request('/rest/v1/club_roles?select=club_id,role&user_id=eq.'+uid)
    expect(status==200 and any(r['role']=='owner' for r in roles),'testovací účet má správce klubu')
    club=next(r['club_id'] for r in roles if r['role']=='owner')
    status,rows=request('/rest/v1/members','POST',{'id':member,'club_id':club,'name':'Fiktivní integrační host','kind':'guest'},'return=representation')
    expect(status==201 and rows[0]['kind']=='guest','uložení fiktivního hosta bez účtu')
    status,rows=request('/rest/v1/templates','POST',{'id':template,'club_id':club,'name':'Fiktivní integrační šablona','type':'Běh','place':'Fiktivní park','minutes':45,'plan':'Pouze integrační test'},'return=representation')
    expect(status==201,'uložení šablony')
    rows=[{'id':eid,'club_id':club,'template_id':template,'name':'Fiktivní integrační běh','type':'Běh','place':'Fiktivní park','plan':'Test','starts_at':date} for eid,date in zip(events,['2026-10-21T16:00:00Z','2026-10-28T17:00:00Z'])]
    status,_=request('/rest/v1/events','POST',rows,'return=representation')
    expect(status==201,'atomické vytvoření série tréninků')
    identity={'club_id':club,'event_id':events[0],'member_id':member}
    path='/rest/v1/participation?on_conflict=event_id,member_id'
    status,rows=request(path,'POST',{**identity,'response':'yes'},'resolution=merge-duplicates,return=representation')
    expect(status==201 and rows[0]['attended'] is None,'RSVP nevytvoří potvrzenou docházku')
    status,rows=request(path,'POST',{**identity,'attended':True,'confirmed_by':uid},'resolution=merge-duplicates,return=representation')
    expect(status in [200,201] and rows[0]['response']=='yes' and rows[0]['attended'] is True,'docházka zachová RSVP')
    status,rows=request(path,'POST',{**identity,'response':'maybe'},'resolution=merge-duplicates,return=representation')
    expect(status in [200,201] and rows[0]['attended'] is True and rows[0]['confirmed_by']==uid,'změna RSVP zachová docházku i trenéra')
    status,rows=request('/rest/v1/participation?event_id=eq.'+events[0]+'&member_id=eq.'+member)
    expect(status==200 and len(rows)==1 and rows[0]['response']=='maybe','opětovné načtení uložené účasti')
    for table in ['members','templates','events','participation']:
        status,rows=request('/rest/v1/'+table+'?select=*&club_id=eq.'+club,anonymous=True)
        expect(status in [401,403] or (status==200 and rows==[]),'anonym nemá přístup: '+table)
    denied=str(uuid.uuid4())
    for table in ['members','templates','events','participation']:
        status,rows=request('/rest/v1/'+table+'?select=*&club_id=eq.'+denied)
        expect(status==200 and rows==[],'nepřiřazený klub není čitelný: '+table)
    status,result=request('/rest/v1/members','POST',{'id':str(uuid.uuid4()),'club_id':denied,'name':'Blokovaný fiktivní host','kind':'guest'})
    expect(status in [401,403] and result.get('code')=='42501','RLS blokuje zápis do nepřiřazeného klubu před cizím klíčem')
    status,result=request('/rest/v1/members?id=eq.'+member,'PATCH',{'club_id':denied})
    expect(status in [401,403] and result.get('code')=='42501','RLS blokuje přesun záznamu do nepřiřazeného klubu')
    status,archived=request('/rest/v1/rpc/archive_club_member','POST',{'target_club':club,'target_member':member,'restore':False})
    expect(status==200 and archived['removed_at'] and archived['purge_after'],'archivace člena a datum retenčního limitu')
    status,restored=request('/rest/v1/rpc/archive_club_member','POST',{'target_club':club,'target_member':member,'restore':True})
    expect(status==200 and restored['id']==member and restored['removed_at'] is None,'obnovení stejného člena se zachovanou historií')
    status,rows=request('/rest/v1/participation?event_id=eq.'+events[0]+'&member_id=eq.'+member)
    expect(status==200 and rows[0]['attended'] is True,'docházka po archivaci a obnovení zůstává')
    status,rows=request('/rest/v1/events?id=eq.'+events[0],'PATCH',{'starts_at':'2030-11-18T17:30:00Z'},'return=representation')
    expect(status==200 and rows[0]['starts_at'].startswith('2030-11-18T17:30'),'přesun události na jiný datum a čas')
    status,_=request('/rest/v1/events?id=eq.'+events[0],'PATCH',{'status':'cancelled'},'return=representation')
    expect(status==200,'zrušení události bez smazání')
    status,rows=request('/rest/v1/participation?event_id=eq.'+events[0]+'&member_id=eq.'+member)
    expect(status==200 and len(rows)==1,'zrušení zachová docházku')
    from datetime import datetime, timezone, timedelta
    past=(datetime.now(timezone.utc)-timedelta(days=2)).isoformat()
    status,_=request('/rest/v1/events?id=eq.'+events[0],'PATCH',{'status':'scheduled','starts_at':past,'actual_notes':'Fiktivní skutečný průběh'},'return=representation')
    expect(status==200,'obnovení události a uložení skutečného průběhu')
    status,members=request('/rest/v1/members?select=id,removed_at&club_id=eq.'+club)
    expect(status==200,'načtení očekávaného seznamu pro kontrolu docházky')
    for row in members:
        if row['id']!=member and (not row['removed_at'] or row['removed_at']>past):
            status,_=request(path,'POST',{'club_id':club,'event_id':events[0],'member_id':row['id'],'attended':False,'confirmed_by':uid},'resolution=merge-duplicates')
            expect(status in [200,201],'potvrzení absence pouze ve fiktivní testovací události')
    status,rows=request('/rest/v1/events?id=eq.'+events[0],'PATCH',{'completed_at':datetime.now(timezone.utc).isoformat()},'return=representation')
    expect(status==200 and rows[0]['completed_at'] is not None and rows[0]['completed_by']==uid,'dokončení události s ověřenou docházkou a průběhem')
    status,_=request(path,'POST',{**identity,'response':'yes'},'resolution=merge-duplicates')
    status,rows=request('/rest/v1/events?id=eq.'+events[0])
    expect(status==200 and rows[0]['completed_at'] is None,'změna účasti znovu otevře událost ke kontrole')
    status,_=request('/rest/v1/templates?id=eq.'+template,'PATCH',{'name':'Fiktivní upravená šablona'},'return=representation')
    expect(status==200,'úprava šablony')
    status,_=request('/rest/v1/templates?id=eq.'+template,'DELETE')
    expect(status==204,'smazání používané šablony')
    status,rows=request('/rest/v1/events?id=eq.'+events[0])
    expect(status==200 and rows[0]['template_id'] is None and rows[0]['plan']=='Test','existující trénink zachová plán po smazání šablony')
except Exception as error:
    failed=True
    print('FAIL:',str(error) if isinstance(error,AssertionError) else type(error).__name__,flush=True)
finally:
    if token:
        for table,ids in [('events',events),('templates',[template]),('members',[member])]:
            try:
                status,_=request('/rest/v1/'+table+'?id=in.('+','.join(ids)+')','DELETE')
                if status not in [200,204]: failed=True;print('FAIL: cleanup '+table,flush=True)
                else:
                    status,left=request('/rest/v1/'+table+'?select=id&id=in.('+','.join(ids)+')')
                    expect(status==200 and left==[],'odstranění vlastních testovacích záznamů: '+table)
            except Exception:
                failed=True;print('FAIL: cleanup '+table,flush=True)
        try: request('/auth/v1/logout?scope=local','POST',{})
        except Exception: failed=True;print('FAIL: odhlášení testovací relace',flush=True)
raise SystemExit(1 if failed else 0)

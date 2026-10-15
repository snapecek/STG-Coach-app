import {it,expect} from 'vitest';
import {invitationState,latestMemberInvitations,type MemberInvitation} from './memberAccess';
const row=(overrides:Partial<MemberInvitation>={}):MemberInvitation=>({id:'a',member_id:'m',created_at:'2026-10-14T12:00:00Z',expires_at:'2026-10-21T12:00:00Z',accepted_at:null,revoked_at:null,...overrides});
const now=Date.parse('2026-10-15T12:00:00Z');
it('distinguishes uninvited, pending, expired, revoked and accepted records',()=>{expect(invitationState(undefined,false,now)).toBe('none');expect(invitationState(row(),false,now)).toBe('pending');expect(invitationState(row({expires_at:'2026-10-15T12:00:00Z'}),false,now)).toBe('expired');expect(invitationState(row({revoked_at:'2026-10-15T10:00:00Z'}),false,now)).toBe('revoked');expect(invitationState(row({accepted_at:'2026-10-15T10:00:00Z'}),false,now)).toBe('accepted');});
it('linked accounts are never marked as uninvited or expired',()=>{expect(invitationState(undefined,true,now)).toBe('linked');expect(invitationState(row({expires_at:'2026-10-10T12:00:00Z'}),true,now)).toBe('linked');});
it('selects the latest invitation per member independently of paging order',()=>{const latest=row({id:'b',created_at:'2026-10-15T10:00:00Z'}),other=row({member_id:'other'});const rows=latestMemberInvitations([latest,other,row()]);expect(rows.get('m')).toBe(latest);expect(rows.get('other')).toBe(other);});

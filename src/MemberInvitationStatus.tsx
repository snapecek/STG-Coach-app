import {invitationState,invitationDate,type MemberInvitation} from './memberAccess';
export function MemberInvitationStatus({invitation,linked,now,loading,error}:{invitation?:MemberInvitation;linked:boolean;now:number;loading:boolean;error:string}){
 if(loading&&!linked)return <small className="member-invitation-status">Načítám stav pozvánky…</small>;
 if(error&&!linked)return <small className="member-invitation-status unavailable">Stav pozvánky nelze ověřit</small>;
 const state=invitationState(invitation,linked,now);
 const labels={linked:'Účet propojen',none:'Zatím nepozván',pending:'Pozvánka čeká na přijetí',accepted:'Pozvánka přijata',revoked:'Pozvánka odvolána',expired:'Pozvánka vypršela'};
 return <span className={'member-invitation-status '+state}><b>{labels[state]}</b>{invitation&&<><time dateTime={invitation.created_at} title="Čas vytvoření pozvánky. Doručení e-mailu se ověřuje ve schránce příjemce.">Pozvánka z {invitationDate(invitation.created_at)}</time>{invitation.accepted_at?<small>Přijata {invitationDate(invitation.accepted_at)}</small>:invitation.revoked_at?<small>Odvolána {invitationDate(invitation.revoked_at)}</small>:state==='pending'?<small>Platí do {invitationDate(invitation.expires_at)}</small>:null}</>}</span>;
}

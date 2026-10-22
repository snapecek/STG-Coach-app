import {overviewEventStyle,type EventTypeColor} from './eventTypeColors';
import {TrainingWatermark} from './TrainingIcon';
import {EventLocationSection} from './EventLocationSection';
import {useState,type ReactNode} from 'react';
import {CalendarDays,MapPin,Trophy,Dumbbell,CheckCircle2,Users,ClipboardList,MessageCircle} from 'lucide-react';
import {clubTimeZone,type EventRow} from './clubData';
export function EventDetail({event,colors,actions,attendance,record,footer,tasks,games,chat,chatUnread=0,hero,info,initialTab='info'}:{event:EventRow;colors?:EventTypeColor[];actions?:ReactNode;attendance?:ReactNode;record?:ReactNode;footer?:ReactNode;tasks?:ReactNode;games?:ReactNode;chat?:ReactNode;chatUnread?:number;hero?:ReactNode;info?:ReactNode;initialTab?:string}){
 const [tab,setTab]=useState(initialTab),race=event.event_kind==='race';
 const date=new Date(event.starts_at),day=date.toLocaleDateString('cs-CZ',{timeZone:clubTimeZone,day:'numeric'}),month=date.toLocaleDateString('cs-CZ',{timeZone:clubTimeZone,month:'short'});
 const tabs=[{id:'info',label:'Informace',icon:CalendarDays},...(attendance?[{id:'attendance',label:'Účast',icon:Users}]:[]),...(tasks?[{id:'tasks',label:'Úkoly',icon:CheckCircle2}]:[]),...(games?[{id:'games',label:'Minihry',icon:Trophy}]:[]),...(chat?[{id:'chat',label:'Chat',icon:MessageCircle}]:[]),...(record?[{id:'record',label:race?'Výsledky':'Deník',icon:ClipboardList}]:[])];
 const active=tabs.some(t=>t.id===tab)?tab:'info';
 const unread=Math.max(0,Math.floor(chatUnread)||0),unreadDescription='event-chat-unread-'+event.id;
 return <>
  <div style={overviewEventStyle(event,colors)} className="training-hero-watermark overview-event-color watermark-surface"><TrainingWatermark source={event}/>{hero||<div className={'detail-hero '+(race?'race':'training')}><div className="detail-date"><strong>{day}</strong><span>{month}</span></div><div><span className="detail-kind">{race?<Trophy size={14}/>:<Dumbbell size={14}/>} {race?'Závod':event.type} · {event.status==='cancelled'?'Zrušeno':event.completed_at?'Dokončeno':'Naplánováno'}</span><h2>{event.name}</h2>{event.group_name&&<span className="event-group-label">{event.group_name}</span>}<p>{date.toLocaleString('cs-CZ',{timeZone:clubTimeZone,weekday:'long',hour:'2-digit',minute:'2-digit'})}</p></div></div>}
  </div>
  <div className="detail-tabs" role="tablist" aria-label="Detail události">{tabs.map(t=><button role="tab" className={t.id==='chat'&&unread?'has-unread':undefined} aria-describedby={t.id==='chat'&&unread?unreadDescription:undefined} aria-selected={active===t.id} aria-controls={'event-'+t.id} id={'tab-'+t.id} key={t.id} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}{t.id==='chat'&&unread>0&&<span className="chat-badge event-chat-unread" aria-hidden="true">{unread>99?'99+':unread}</span>}</button>)}</div>
  {chat&&unread>0&&<span id={unreadDescription} className="sr-only" role="status">Nepřečtené zprávy v chatu události: {unread}</span>}
  <div id="event-info" role="tabpanel" aria-labelledby="tab-info" hidden={active!=='info'}>
   {info===undefined?<><div className="detail-facts"><div><MapPin size={19}/><span><small>MÍSTO</small><b>{event.place}</b></span></div><div><CalendarDays size={19}/><span><small>{race?'ČASOVÉ OKNO':'DÉLKA'}</small><b>{event.duration_minutes} minut</b></span></div>{!race&&event.capacity!=null&&<div><Users size={19}/><span><small>KAPACITA</small><b>{event.capacity} míst · s čekací listinou</b></span></div>}{race&&event.race_distance_km!=null&&<div><Trophy size={19}/><span><small>DÉLKA TRASY</small><b>{event.race_distance_km} km</b></span></div>}</div><div className="detail-block"><h3>{race?'Organizační pokyny':'Plán tréninku'}</h3><p className="preserve-lines">{event.plan||(race?'Pokyny zatím nejsou doplněné.':'Plán zatím není doplněný.')}</p>{race&&event.race_registration_url&&<a className="external-action" href={event.race_registration_url} target="_blank" rel="noopener noreferrer">Registrace u pořadatele ↗</a>}</div></>:info}
   {active==='info'&&<EventLocationSection value={event.event_location} inline/>}{actions}
  </div>
  {attendance&&<div id="event-attendance" role="tabpanel" aria-labelledby="tab-attendance" hidden={active!=='attendance'}>{attendance}</div>}
  {tasks&&<div id="event-tasks" role="tabpanel" aria-labelledby="tab-tasks" hidden={active!=='tasks'}>{tasks}</div>}
  {games&&<div id="event-games" role="tabpanel" aria-labelledby="tab-games" hidden={active!=='games'}>{games}</div>}
  {record&&<div id="event-record" role="tabpanel" aria-labelledby="tab-record" hidden={active!=='record'}>{record}</div>}
  {chat&&active==='chat'&&<div id="event-chat" role="tabpanel" aria-labelledby="tab-chat">{chat}</div>}
  {footer&&(active==='info'||active==='record')&&<div className="detail-footer"><CheckCircle2 size={20}/><div>{footer}</div></div>}
 </>;
}

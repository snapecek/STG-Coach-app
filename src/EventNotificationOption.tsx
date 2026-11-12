export function EventNotificationOption({checked,onChange}:{checked:boolean;onChange:(checked:boolean)=>void}){
 return <div className="event-notification-option"><label className="checkbox-label"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>Upozornit členy a trenéry</label><p className="muted">Změna se zobrazí ve zvonečku členům, kterým je událost určená, a trenérům klubu. Na zařízeních s povolenými oznámeními přijde také mobilní upozornění.</p></div>;
}

// The existing name field is preserved; only its presentation is split.
export function AttendanceName({name}:{name:string}){
 const parts=name.trim().split(/\s+/),surname=parts.length>1?parts.pop():'';
 return <span className="attendance-person-name"><span>{parts.join(' ')}</span>{surname&&<>{' '}<span>{surname}</span></>}</span>;
}

export function AttendancePeoplePagination({section,onPage}:{section:{label:string;page:number;total:number};onPage:(page:number)=>void}){
 if(section.total<=10)return null;
 return <nav className="attendance-pagination attendance-people-pagination" aria-label={'Stránkování · '+section.label}>
  <button disabled={!section.page} onClick={()=>onPage(section.page-1)}>Předchozí</button>
  <span>{section.label}: {section.page*10+1}–{Math.min((section.page+1)*10,section.total)} z {section.total}</span>
  <button disabled={(section.page+1)*10>=section.total} onClick={()=>onPage(section.page+1)}>Další</button>
 </nav>;
}

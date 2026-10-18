import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
// Keep viewport-fixed navigation outside scrolling/grid ancestors in Safari.
export function MobileClubNavigation({children,count,member=false}:{children:ReactNode;count:number;member?:boolean}){
 return createPortal(<nav className={'mobile-club-nav'+(member?' member-mobile-nav':'')} style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}} aria-label="Mobilní navigace">{children}</nav>,document.body);
}

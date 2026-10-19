import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
// Render navigation in the shell footer, outside the scrollable club content.
export function MobileClubNavigation({children,count,member=false,target}:{target?:HTMLElement|null;children:ReactNode;count:number;member?:boolean}){
 return createPortal(<nav className={'mobile-club-nav'+(member?' member-mobile-nav':'')} style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}} aria-label="Mobilní navigace">{children}</nav>,target||document.body);
}

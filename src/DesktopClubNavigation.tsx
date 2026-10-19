import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';

// Keep desktop tabs inside the same sticky block as the club and account icons.
export function DesktopClubNavigation({children,target}:{children:ReactNode;target?:HTMLElement|null}){
 return target?createPortal(children,target):children;
}

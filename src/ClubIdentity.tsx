import {useEffect,useState} from 'react';
import {ImagePlus} from 'lucide-react';
export function ClubIdentity({name,logoUrl=''}:{name:string;logoUrl?:string}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[logoUrl]);return <span className="club-identity"><span className="club-logo-placeholder">{logoUrl&&!failed?<img src={logoUrl} alt={'Logo klubu '+name} onError={()=>setFailed(true)}/>:<ImagePlus size={25} aria-label="Místo pro logo klubu"/>}</span><span>{name}</span></span>}

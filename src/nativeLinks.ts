const queryKeys=new Set(['auth','type','token_hash','code','club-invite','join-invite','push-club','push-event','rsvp-club','rsvp-event','error','error_code','error_description']);
const hashKeys=new Set(['type','access_token','refresh_token','expires_at','expires_in','token_type','error','error_code','error_description']);

// Only known app routes may enter the privileged local WebView. Never load a
// caller-supplied origin, path, arbitrary HTML or javascript in that WebView.
export function nativeLinkTarget(value:string,publicOrigin:string):string|null{
 try{
  const url=new URL(value);
  const custom=url.protocol==='trenomi:'&&['auth','open'].includes(url.hostname);
  const web=url.protocol==='https:'&&url.origin===new URL(publicOrigin).origin;
  if((!custom&&!web)||url.username||url.password||url.port||!['','/'].includes(url.pathname))return null;
  const query=new URLSearchParams(),hash=new URLSearchParams();
  for(const [key,item] of url.searchParams)if(queryKeys.has(key))query.append(key,item);
  for(const [key,item] of new URLSearchParams(url.hash.slice(1)))if(hashKeys.has(key))hash.append(key,item);
  if(!query.size&&!hash.size)return null;
  return '/'+(query.size?'?'+query:'')+(hash.size?'#'+hash:'');
 }catch{return null}
}

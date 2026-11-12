export function hasBetaAuthIntent(href:string,pending=false){
 if(pending)return true;
 const url=new URL(href),hash=new URLSearchParams(url.hash.slice(1));
 return ['auth','code','token_hash','type','error','error_description','club-invite','join-invite','push-club','rsvp-club'].some(key=>url.searchParams.has(key))
  ||['access_token','refresh_token','token_hash','error','error_description'].some(key=>hash.has(key));
}

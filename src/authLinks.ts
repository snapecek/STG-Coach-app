export type AuthLink={invite:string|null;accessToken:string|null;refreshToken:string|null;code:string|null;passwordSetup:boolean;error:boolean};
export function parseAuthLink(url:string):AuthLink{
 const u=new URL(url),hash=new URLSearchParams(u.hash.slice(1));const invite=u.searchParams.get('club-invite');const type=hash.get('type')||u.searchParams.get('auth');
 const validType=['invite','recovery','magiclink','signup'].includes(type||'');
 return {invite:invite&&/^[0-9a-f]{64}$/.test(invite)?invite:null,accessToken:validType?hash.get('access_token'):null,refreshToken:validType?hash.get('refresh_token'):null,code:u.searchParams.get('code'),passwordSetup:type==='invite'||type==='recovery',error:hash.has('error')||u.searchParams.has('error')||!!invite&&!/^[0-9a-f]{64}$/.test(invite)};
}
export function cleanAuthUrl(url:string){const u=new URL(url);for(const name of ['club-invite','join-invite','code','auth','error','error_code','error_description'])u.searchParams.delete(name);u.hash='';return u.pathname+u.search;}
export function validateNewPassword(password:string,confirm:string){if(password.length<12||password.length>128)throw new Error('Heslo musí mít 12 až 128 znaků.');if(password!==confirm)throw new Error('Hesla se neshodují.');}

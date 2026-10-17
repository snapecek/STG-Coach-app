export type EmailLinkType='invite'|'recovery'|'magiclink'|'signup';
export type AuthLink={invite:string|null;accessToken:string|null;refreshToken:string|null;code:string|null;tokenHash:string|null;verificationType:EmailLinkType|null;passwordSetup:boolean;error:boolean};
export function parseAuthLink(url:string):AuthLink{
 const u=new URL(url),hash=new URLSearchParams(u.hash.slice(1));const invite=u.searchParams.get('club-invite');const type=hash.get('type')||u.searchParams.get('type')||u.searchParams.get('auth');const tokenHash=u.searchParams.get('token_hash')||hash.get('token_hash');
 const validType=['invite','recovery','magiclink','signup'].includes(type||'');
 return {invite:invite&&/^[0-9a-f]{64}$/.test(invite)?invite:null,accessToken:validType?hash.get('access_token'):null,refreshToken:validType?hash.get('refresh_token'):null,code:u.searchParams.get('code'),tokenHash:validType&&tokenHash?tokenHash:null,verificationType:validType?type as EmailLinkType:null,passwordSetup:type==='invite'||type==='recovery',error:!!tokenHash&&(!validType||!!u.searchParams.get('code')||hash.has('access_token')||hash.has('refresh_token'))||hash.has('error')||u.searchParams.has('error')||!!invite&&!/^[0-9a-f]{64}$/.test(invite)};
}
export function cleanAuthUrl(url:string){const u=new URL(url);for(const name of ['club-invite','join-invite','code','auth','token_hash','type','error','error_code','error_description'])u.searchParams.delete(name);u.hash='';return u.pathname+u.search;}
export function validateNewPassword(password:string,confirm:string){if(password.length<12||password.length>128)throw new Error('Heslo musí mít 12 až 128 znaků.');if(password!==confirm)throw new Error('Hesla se neshodují.');}

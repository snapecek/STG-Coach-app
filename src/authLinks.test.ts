import {describe,it,expect} from 'vitest';
import {parseAuthLink,cleanAuthUrl,validateNewPassword} from './authLinks';
const token='a'.repeat(64);
describe('Bezpečné Auth odkazy',()=>{
 it('rozpozná pozvánku a potřebu nastavení hesla',()=>{expect(parseAuthLink('https://example.invalid/?club-invite='+token+'#type=invite&access_token=fake&refresh_token=fake-refresh')).toMatchObject({invite:token,accessToken:'fake',refreshToken:'fake-refresh',passwordSetup:true,error:false})});
 it('nepřijme session token z neznámého typu odkazu',()=>expect(parseAuthLink('https://example.invalid/#type=unknown&access_token=fake&refresh_token=fake').accessToken).toBeNull());
 it('vyčistí tokeny i kód před načítáním dalších stránek',()=>{const clean=cleanAuthUrl('https://example.invalid/?club-invite='+token+'&code=fake&auth=recovery&workspace=cloud#access_token=fake');expect(clean).toBe('/?workspace=cloud');expect(clean).not.toContain(token)});
 it('rozpozná chybu a neplatný klubový token',()=>{expect(parseAuthLink('https://example.invalid/?club-invite=bad').error).toBe(true);expect(parseAuthLink('https://example.invalid/#error=expired&error_description=secret').error).toBe(true)});
 it('handles verified signup links and removes applicant invitation tokens',()=>{expect(parseAuthLink('https://example.invalid/?join-invite='+token+'#type=signup&access_token=fake&refresh_token=fake-refresh')).toMatchObject({accessToken:'fake',passwordSetup:false,error:false});expect(cleanAuthUrl('https://example.invalid/?join-invite='+token+'&auth=signup')).toBe('/')});
 it('kontroluje délku a shodu hesel',()=>{expect(()=>validateNewPassword('short','short')).toThrow();expect(()=>validateNewPassword('fictional-password','different')).toThrow();expect(()=>validateNewPassword('fictional-password','fictional-password')).not.toThrow()});
});

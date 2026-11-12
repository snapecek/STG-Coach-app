import {expect,it} from 'vitest';
import {hasBetaAuthIntent} from './betaEntry';

it('opens the public welcome for ordinary visits and section anchors',()=>{
 for(const url of ['https://www.trenomi.eu/','https://trenomi.eu/#features','https://trenomi.eu/?workspace=cloud'])expect(hasBetaAuthIntent(url)).toBe(false);
});
it('preserves login, invitation, password and notification entry links',()=>{
 for(const suffix of ['?auth=login','?auth=recovery','?club-invite=token','?join-invite=token','?code=token','?error=access_denied','?token_hash=token&type=signup','?push-club=club&push-event=event','?rsvp-club=club&rsvp-event=event','#token_hash=token&type=signup','#access_token=token&refresh_token=token','#error=access_denied'])expect(hasBetaAuthIntent('https://trenomi.eu/'+suffix)).toBe(true);
});
it('keeps a pending invitation or password setup usable after URL cleanup',()=>{
 expect(hasBetaAuthIntent('https://trenomi.eu/',true)).toBe(true);
});

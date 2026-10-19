import {describe,it,expect} from 'vitest';
import {nativeLinkTarget} from './nativeLinks';
const origin='https://trenomi.eu';
describe('native incoming links',()=>{
 it('accepts PKCE recovery and invitation links without redirecting the WebView off origin',()=>{
  expect(nativeLinkTarget('trenomi://auth/?auth=recovery&code=one-time-code',origin)).toBe('/?auth=recovery&code=one-time-code');
  expect(nativeLinkTarget(origin+'/?join-invite='+'a'.repeat(64),origin)).toBe('/?join-invite='+'a'.repeat(64));
  expect(nativeLinkTarget('trenomi://open/?rsvp-club=club&rsvp-event=event',origin)).toBe('/?rsvp-club=club&rsvp-event=event');
 });
 it('preserves known auth fragments for the existing explicit email confirmation flow',()=>{
  expect(nativeLinkTarget('trenomi://auth/#type=recovery&access_token=access&refresh_token=refresh',origin)).toBe('/#type=recovery&access_token=access&refresh_token=refresh');
 });
 it.each(['https://attacker.example/?code=x','http://trenomi.eu/?code=x','https://user:password@trenomi.eu/?code=x','trenomi://evil/?code=x','trenomi://auth/another-page?code=x','javascript:alert(1)','not a URL','https://trenomi.eu/another-page?code=x','trenomi://auth:123/?code=x'])('rejects untrusted or unexpected routes: %s',value=>expect(nativeLinkTarget(value,origin)).toBeNull());
 it('drops arbitrary navigation and HTML parameters and ignores links without a supported target',()=>{
  expect(nativeLinkTarget('trenomi://auth/?code=x&redirect=https://attacker.example#html=bad',origin)).toBe('/?code=x');
  expect(nativeLinkTarget('trenomi://open/?redirect=https://attacker.example',origin)).toBeNull();
 });
});

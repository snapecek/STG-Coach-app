import {describe,expect,it} from 'vitest';
import {isIosStandalone} from './iosPwa';

const phone={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1',platform:'iPhone',maxTouchPoints:5,standalone:true};
describe('installed iOS detection',()=>{
 it('covers installed iPhone apps despite frozen or missing version tokens',()=>{
  expect(isIosStandalone(phone)).toBe(true);
  expect(isIosStandalone({...phone,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Mobile/15E148'})).toBe(true);
 });
 it('covers iPad desktop user agents and OS-only installed user agents',()=>{
  expect(isIosStandalone({...phone,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/27.0 Safari/605.1.15',platform:'MacIntel'})).toBe(true);
  expect(isIosStandalone({...phone,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) Mobile/15E148'})).toBe(true);
 });
 it('does not change Safari tabs, Android, or desktop Macs',()=>{
  expect(isIosStandalone({...phone,standalone:false})).toBe(false);
  expect(isIosStandalone({...phone,userAgent:'Mozilla/5.0 (Linux; Android 16) Chrome/140.0',platform:'Linux armv8l'})).toBe(false);
  expect(isIosStandalone({...phone,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/27.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:0})).toBe(false);
  expect(isIosStandalone({...phone,userAgent:'Unknown device',platform:'',maxTouchPoints:0})).toBe(false);
 });
});

import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({native:false,write:vi.fn(),read:vi.fn(),remove:vi.fn(),share:vi.fn()}));
vi.mock('./nativePlatform',()=>({isNativeApp:()=>mocks.native}));
vi.mock('@capacitor/filesystem',()=>({Directory:{Cache:'CACHE'},Filesystem:{writeFile:mocks.write,readdir:mocks.read,deleteFile:mocks.remove}}));
vi.mock('@capacitor/share',()=>({Share:{share:mocks.share}}));
import {exportFile,shareInvitation,shareCancelled} from './nativeFiles';
beforeEach(()=>{vi.clearAllMocks();mocks.native=false;mocks.read.mockResolvedValue({files:[]});mocks.write.mockResolvedValue({uri:'file:///private/cache/graphic.png'});mocks.share.mockResolvedValue({});vi.stubGlobal('FileReader',class{result='data:image/png;base64,YWJj';onload?:()=>void;readAsDataURL(){this.onload?.()}})});
afterEach(()=>vi.unstubAllGlobals());
describe('file and invitation sharing',()=>{
 it('uses the native share sheet and private cache for graphics and exports',async()=>{
  mocks.native=true;const file=new File(['abc'],'trenomi.png',{type:'image/png'});
  expect(await exportFile(file,{share:true,title:'Trénink',text:'Hotovo'})).toBe('shared');
  expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({directory:'CACHE',data:'YWJj',recursive:true,path:expect.stringMatching(/^trenomi-exports\/.+-trenomi.png$/)}));
  expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({files:['file:///private/cache/graphic.png'],title:'Trénink',text:'Hotovo'}));
  mocks.read.mockResolvedValue({files:[{name:'old.png',type:'file',mtime:1},{name:'new.png',type:'file',mtime:Date.now()}]});
  await exportFile(file);expect(mocks.remove).toHaveBeenCalledWith({directory:'CACHE',path:'trenomi-exports/old.png'});expect(mocks.remove).toHaveBeenCalledTimes(1);
 });
 it('preserves browser file sharing and falls back to downloads without native plugins',async()=>{
  const share=vi.fn();vi.stubGlobal('navigator',{canShare:()=>true,share});const file=new File(['abc'],'trenomi.png');
  expect(await exportFile(file,{share:true})).toBe('shared');expect(share).toHaveBeenCalledWith(expect.objectContaining({files:[file]}));expect(mocks.write).not.toHaveBeenCalled();
  const click=vi.fn();vi.stubGlobal('document',{createElement:()=>({click})});vi.stubGlobal('navigator',{});
  expect(await exportFile(file)).toBe('downloaded');expect(click).toHaveBeenCalledOnce();
 });
 it('uses native text sharing and exposes cancellation rather than reporting a false success',async()=>{
  mocks.native=true;expect(await shareInvitation({title:'Pozvánka',text:'Přidej se',url:'https://trenomi.eu/?join-invite=token'})).toBe(true);
  mocks.share.mockRejectedValue(new Error('Share canceled'));await expect(exportFile(new File(['abc'],'file.png'))).rejects.toThrow('Share canceled');
  expect(shareCancelled(new Error('Share canceled'))).toBe(true);expect(shareCancelled(new Error('Permission denied'))).toBe(false);
 });
 it('rejects oversized native exports before allocating base64 data',async()=>{
  mocks.native=true;await expect(exportFile({size:65*1024*1024,name:'backup.zip'} as File)).rejects.toThrow('64 MB');expect(mocks.write).not.toHaveBeenCalled();
 });
});

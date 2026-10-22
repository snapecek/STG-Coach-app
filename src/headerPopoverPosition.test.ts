import {describe,it,expect} from 'vitest';
import {headerPopoverPosition} from './headerPopoverPosition';
const base={host:{left:40,top:20},viewport:{left:0,width:1440},preferredWidth:320,bottom:880};
describe('header popovers',()=>{
 it('opens towards the centre from either trigger edge',()=>{
  expect(headerPopoverPosition({...base,trigger:{left:40,right:84,bottom:64}})).toMatchObject({side:'left',left:0,top:52,width:320});
  expect(headerPopoverPosition({...base,trigger:{left:1300,right:1344,bottom:64}})).toMatchObject({side:'right',left:984,top:52,width:320});
 });
 it('fits a narrow viewport and reserves space above the mobile navigation',()=>{
  const p=headerPopoverPosition({...base,host:{left:17,top:60},viewport:{left:0,width:320},trigger:{left:17,right:61,bottom:104},gutter:17,bottom:700});
  expect(p).toMatchObject({left:0,width:286,top:52,maxHeight:588});
 });
 it('clamps both viewport edges, including a zoomed visual viewport',()=>{
  expect(headerPopoverPosition({...base,trigger:{left:0,right:44,bottom:64}}).left).toBe(-28);
  const p=headerPopoverPosition({...base,viewport:{left:100,width:390},trigger:{left:420,right:464,bottom:64}});
  expect(p.left+base.host.left+p.width).toBeLessThanOrEqual(478);
  expect(headerPopoverPosition({...base,bottom:60,trigger:{left:0,right:44,bottom:64}}).maxHeight).toBe(0);
 });
 it('anchors clubs to their own left edge even on the right of the screen',()=>{
  const p=headerPopoverPosition({...base,host:{left:1050,top:20},trigger:{left:1050,right:1150,bottom:64},alignment:'left'});
  expect(p).toMatchObject({side:'left',left:0,width:320});
 });
 it('keeps the requested trigger edge when a desktop panel needs a narrower width',()=>{
  const p=headerPopoverPosition({...base,host:{left:1250,top:20},trigger:{left:1250,right:1350,bottom:64},alignment:'left'});
  expect(p).toMatchObject({left:0,width:178,side:'left'});
  const right=headerPopoverPosition({...base,host:{left:100,top:20},trigger:{left:100,right:144,bottom:64},alignment:'right'});
  expect(right.left+100+right.width).toBe(144);
 });

});

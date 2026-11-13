import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';
const {memberCases}=createRequire(import.meta.url)('./release-ui-cases.cjs');

describe('release member UI scenario discovery',()=>{
 it('runs both selected sport values while retaining automatic discovery',()=>{
  const source='STG_SELECTED_HIIT_ONLY STG_COMPLETED_QUEUE_ONLY STG_SELECTED_HIIT_ONLY STG_NEW_CHECK_ONLY';
  expect(memberCases(source)).toEqual([
   {flag:'STG_COMPLETED_QUEUE_ONLY',value:'1'},
   {flag:'STG_NEW_CHECK_ONLY',value:'1'},
   {flag:'STG_SELECTED_HIIT_ONLY',value:'hiit'},
   {flag:'STG_SELECTED_HIIT_ONLY',value:'kettlebell'},
  ]);
 });
});

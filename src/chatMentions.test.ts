import {describe,it,expect} from 'vitest';
import {mentionQuery,selectedMentionIds,messageSegments,normalizeMention} from './chatMentions';
const jana={user_id:'a',name:'Jana Nováková'},jan={user_id:'b',name:'Jan (trenér)'};
describe('explicit chat mentions',()=>{
 it('finds @ names and plain name suggestions at the caret, excluding email addresses',()=>{expect(mentionQuery('Ahoj @Ja',8)).toEqual({start:5,end:8,query:'Ja',explicit:true});expect(mentionQuery('Ahoj Jana',9)?.query).toBe('Jana');expect(mentionQuery('test@example',12)).toBeNull();expect(mentionQuery('@Jana něco dál',5)?.query).toBe('Jana');expect(normalizeMention('NOVÁKOVÁ')).toBe('novakova')});
 it('notifies only explicitly selected identities still present in the message',()=>{expect(selectedMentionIds('Jana Nováková', [jana])).toEqual([]);expect(selectedMentionIds('@Jana Nováková', [jana,jana,jan])).toEqual(['a']);expect(selectedMentionIds('@Jan (trenér)',[jana,jan])).toEqual(['b'])});
 it('renders stored mentions as safe text and handles regex characters and longer names',()=>{expect(messageSegments('<script> @Jan (trenér)',[jan])).toEqual([{text:'<script> ',mention:false},{text:'@Jan (trenér)',mention:true}]);expect(messageSegments('@Jana Nováková',[{user_id:'c',name:'Jana'},jana])).toEqual([{text:'@Jana Nováková',mention:true}]);expect(messageSegments('@Jana Nováková',[])[0].mention).toBe(false)});
});

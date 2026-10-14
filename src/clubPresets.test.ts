import {it,expect} from 'vitest';
import {validatePreset} from './clubPresets';
it('rejects malformed race and game defaults',()=>{expect(()=>validatePreset('race','Závod',{discipline:'OCR',minutes:180,distance_km:-1})).toThrow();expect(()=>validatePreset('game','Minihra',{})).toThrow();expect(()=>validatePreset('equipment','x'.repeat(41),{})).toThrow();expect(()=>validatePreset('race','Závod',{discipline:'OCR',minutes:180,distance_km:5})).not.toThrow();});

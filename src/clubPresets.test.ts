import {it,expect} from 'vitest';
import {standardRacePresets,validatePreset} from './clubPresets';
it('race presets preserve separate Spartan disciplines and distances',()=>{expect(standardRacePresets.map(p=>[p.name,p.settings.discipline,p.settings.distance_km])).toEqual([['10 km','Silniční běh',10],['Spartan Sprint','OCR',5],['Spartan Super','OCR',10],['Spartan Beast','OCR',21],['Spartan Ultra','OCR',50]]);});
it('rejects malformed race and game defaults',()=>{expect(()=>validatePreset('race','Závod',{discipline:'OCR',minutes:180,distance_km:-1})).toThrow();expect(()=>validatePreset('game','Minihra',{})).toThrow();expect(()=>validatePreset('equipment','x'.repeat(41),{})).toThrow();expect(()=>validatePreset('race','Závod',{discipline:'OCR',minutes:180,distance_km:5})).not.toThrow();});

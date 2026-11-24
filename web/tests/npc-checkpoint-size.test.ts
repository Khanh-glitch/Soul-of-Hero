import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {selectSnapshots,serializeSnapshot} from '../src/game/persist';
const path=process.env.SOH_NAV_CHECKPOINT;
it.skipIf(!path)('re-saves the real frontier in canonical order without nesting the old blob',()=>{
 const text=readFileSync(path!,'utf8'),before=JSON.parse(JSON.parse(text).payload),start=performance.now();
 const loaded=selectSnapshots([text,text]);expect(loaded.bad).toEqual([]);const loadMs=performance.now()-start;
 expect(loaded.gs).not.toHaveProperty('navigation');const at=performance.now(),next=serializeSnapshot(loaded.gs!),saveMs=performance.now()-at;
 const after=JSON.parse(JSON.parse(next).payload);expect(after.navigation).toBe(before.navigation);expect(after.revision).toBe(before.revision+1);
 console.log('NAV_CHECKPOINT',JSON.stringify({fileBytes:Buffer.byteLength(text),navigationChars:before.navigation.length,loadMs,saveMs}));
});

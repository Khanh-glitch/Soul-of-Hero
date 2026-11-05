import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateStage1, expandRle, BODY_SHA } from '../src/game/veyra/intake';
const root=resolve('geography/veyra-lr01');const read=(p:string)=>{const path=resolve(root,p);return path.startsWith(root+'/')&&existsSync(path)?new Uint8Array(readFileSync(path)):undefined;};
const pkg=JSON.parse(readFileSync(resolve(root,'world_lab/lr01/output/geography_package.v1.json'),'utf8'));
describe('pinned geography-only Stage 1',()=>{
 it('recomputes exact revision, canon, all 79 payloads and 21 rasters and validates IDs',()=>{expect(pkg.revisionDigest).toBe(BODY_SHA);expect(validateStage1(pkg,read)).toEqual([]);});
 it('rejects unknown identity, altered body, missing/corrupt bytes and duplicate IDs',()=>{const changed=structuredClone(pkg);changed.body.featureIndex[1].id=changed.body.featureIndex[0].id;changed.revision=2;const errors=validateStage1(changed,p=>p.includes('elevation.u8')?undefined:read(p));expect(errors).toContain('unknown schema, version, map ID or stage');expect(errors).toContain('body revision digest mismatch');expect(errors).toContain('package metadata digest mismatch');expect(errors.some(e=>e.includes('invalid feature'))).toBe(true);expect(errors.some(e=>e.includes('elevation.u8'))).toBe(true);});
 it('rejects malformed RLE rather than silently filling or wrapping',()=>{expect(()=>expandRle([[0,43749]],11)).toThrow();expect(()=>expandRle([[12,43750]],11)).toThrow();expect(()=>expandRle([[0,43751]],11)).toThrow();});
});

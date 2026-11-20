import { readFileSync } from 'node:fs';
import { afterEach, it, expect, vi } from 'vitest';
import { initPfx, fullMode, hasEntry, catalog } from '../src/game/pixelfx';
const embedded=JSON.parse(readFileSync('public/pixelfx-assets/index.json','utf8'));
afterEach(()=>vi.unstubAllGlobals());
it('ships a truthful HTTP descriptor without claiming an external pack or removing pilot art',async()=>{
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>embedded}));vi.stubGlobal('fetch',fetcher);
 expect(await initPfx()).toBe(false);expect(await fullMode()).toBe(false);expect(fetcher).toHaveBeenCalledWith('pixelfx-assets/index.json');
 expect(hasEntry('shadow/black-hole')).toBe(true);expect(catalog().some(e=>e.pilot)).toBe(true);
});
it('still loads an explicitly hosted full pack, retaining the bundled art when a subsequent manifest is unavailable',async()=>{
 vi.stubGlobal('location',{protocol:'https:',search:'?pfxbase=/foundry'});
 const external={id:'external/fixture',name:'Fixture',category:'external',export:{state:'ready',pages:{combined:[],light:[]}}};
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({effects:[external]})}).mockResolvedValueOnce({ok:false});vi.stubGlobal('fetch',fetcher);
 expect(await initPfx()).toBe(true);expect(fetcher).toHaveBeenCalledWith('/foundry/index.json');expect(hasEntry(external.id)).toBe(true);expect(hasEntry('shadow/black-hole')).toBe(true);
 expect(await initPfx()).toBe(false);expect(hasEntry('shadow/black-hole')).toBe(true);
});

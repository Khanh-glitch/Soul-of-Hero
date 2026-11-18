import React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
const fixtures=vi.hoisted(()=>({
 getArt:vi.fn(),
 icon:{fiber:{width:16,height:16,toDataURL:vi.fn(()=>{throw Error('UI must not encode');})}},
 st:{claim:{width:32,height:24,toDataURL:vi.fn(()=>{throw Error('UI must not encode');})}},
}));
vi.mock('../src/game/art',()=>({getArt:()=>{fixtures.getArt();return fixtures;}}));
vi.mock('../src/game/item-atlas',()=>({atlasIconUrl:(k:string)=>k==='wood'?'approved:wood':''}));
import {ArtImage,Icon} from '../src/ui/common';
it('keeps approved art as an img without constructing procedural art',()=>{
 fixtures.getArt.mockClear();const html=renderToStaticMarkup(<Icon k="wood" size={18}/>);
 expect(html).toContain('src="approved:wood"');expect(html).toContain('data-icon="atlas157"');expect(html).toContain('width="18"');expect(fixtures.getArt).not.toHaveBeenCalled();
});
it('uses native-resolution procedural canvas with independent CSS presentation size, never PNG encoding',()=>{
 const html=renderToStaticMarkup(<ArtImage k="st:claim" width={48} height={36} alt="Cabinet" className="px ghost" style={{opacity:.3}}/>);
 expect(html).toContain('<canvas');expect(html).toContain('width="32" height="24"');expect(html).toContain('width:48px;height:36px;opacity:0.3');expect(html).toContain('aria-label="Cabinet"');expect(html).toContain('role="img"');expect(html).toContain('class="px ghost"');
 expect(fixtures.st.claim.toDataURL).not.toHaveBeenCalled();
});
it('item fallback and unknown/prototype names never invoke encoders or inherit sprite properties',()=>{
 const html=renderToStaticMarkup(<><Icon k="fiber" size={18}/><Icon k="__proto__"/><ArtImage k="st:toString"/></>);
 expect((html.match(/<canvas/g)||[]).length).toBe(3);expect(html).toContain('data-item="fiber"');expect(html).toContain('aria-hidden="true"');expect(fixtures.icon.fiber.toDataURL).not.toHaveBeenCalled();
});
it('no React UI consumer calls the legacy synchronous URL API',()=>{
 for(const file of ['SurvivorScreen','BuildBar','VehicleConsole','panels']){
  const text=readFileSync(`src/ui/${file}.tsx`,'utf8');expect(text).not.toMatch(/\biconUrl(?:St)?\s*\(/);expect(text).toContain('ArtImage');
 }
 const css=readFileSync('src/index.css','utf8');expect(css).toContain(':is(img, canvas[data-icon])');
});

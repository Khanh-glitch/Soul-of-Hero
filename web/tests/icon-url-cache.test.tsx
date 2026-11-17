import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const art = vi.hoisted(() => ({ icon: { scrap: { toDataURL: vi.fn(() => 'drawn:scrap') }, coal: { toDataURL: vi.fn(() => 'drawn:coal') } }, st: { claim: { toDataURL: vi.fn(() => 'drawn:claim') } } }));
vi.mock('../src/game/art', () => ({ getArt: () => art }));
vi.mock('../src/game/item-atlas', () => ({ atlasIconUrl: (k: string) => k === 'wood' ? 'atlas:wood' : '' }));
import { iconUrl, Icon } from '../src/ui/common';
it('encodes only the requested fallback, retains exact cached bytes and keeps atlas priority', () => {
  expect(iconUrl('wood')).toBe('atlas:wood');
  expect(iconUrl('scrap')).toBe('drawn:scrap'); expect(iconUrl('scrap')).toBe('drawn:scrap');
  expect(art.icon.scrap.toDataURL).toHaveBeenCalledTimes(1);
  expect(art.icon.coal.toDataURL).not.toHaveBeenCalled(); expect(art.st.claim.toDataURL).not.toHaveBeenCalled();
  expect(iconUrl('st:claim')).toBe('drawn:claim'); expect(art.st.claim.toDataURL).toHaveBeenCalledTimes(1);
  expect(iconUrl('unknown')).toBe(''); expect(iconUrl('toString')).toBe('');
  expect(renderToStaticMarkup(<Icon k="wood" />)).toContain('data-icon="atlas157"');
  expect(renderToStaticMarkup(<Icon k="scrap" />)).toContain('data-icon="drawn"');
});

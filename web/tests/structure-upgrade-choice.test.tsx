import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {selectedStructureUpgrade,StructureUpgradeChoice} from '../src/ui/StructureUpgradeChoice';
import {upgradeTargets} from '../src/game/catalog';
describe('upgrade target presentation uses the engine target grammar',()=>{
  it('has two optional wood-wall choices without imposing a Plank step on Stone',()=>{
    expect(upgradeTargets('wall_wood')).toEqual(['wall_stone','wall_plank']);
    expect(selectedStructureUpgrade('wall_wood',null)).toBe('wall_stone');
    expect(selectedStructureUpgrade('wall_wood','wall_plank')).toBe('wall_plank');
    expect(selectedStructureUpgrade('floor_wood','wall_plank')).toBe('floor_stone');
    expect(selectedStructureUpgrade('wall_plank',null)).toBe('wall_stone');
    expect(selectedStructureUpgrade('wall_brick','wall_plank')).toBeUndefined();
    expect(upgradeTargets('__proto__')).toEqual([]);
  });
  it('shows the real material bill, default choice and persistent Plank preference',()=>{
    const selected=renderToStaticMarkup(<StructureUpgradeChoice preferred="wall_plank" onChange={()=>{}}/>);
    expect(selected).toContain('Wall upgrade choice');expect(selected).toContain('Default upgrade');
    expect(selected).toMatch(/Plank Wall.*3 Plank/);expect(selected).toContain('aria-pressed="true"');
    expect(selected).toContain('wood walls only');
  });
});

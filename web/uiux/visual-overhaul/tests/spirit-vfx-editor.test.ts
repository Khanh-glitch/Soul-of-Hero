import {describe,it,expect} from 'vitest';
import {DEFAULT_SPIRIT,validateSpirit,tunedSpirit} from '../src/game/spirit-vfx-editor';
describe('Spirit VFX prototype data',()=>{
 it('accepts the default four layers and rejects malformed or unsafe values',()=>{const v=structuredClone(DEFAULT_SPIRIT);expect(validateSpirit(v)).toEqual(v);v.layers['q.beam'].dx=501;expect(validateSpirit(v)).toBeNull();v.layers['q.beam'].dx=0;v.layers['e.arrive'].scale=Number.NaN;expect(validateSpirit(v)).toBeNull();expect(validateSpirit({schema:'bad'})).toBeNull();});
 it('keeps existing beam anchor, baseline scale, orientation, and length by default',()=>{const v=tunedSpirit('q.beam',100,200,Math.PI/2,130);expect(v.x).toBe(100);expect(v.y).toBe(220);expect(v.scale).toBe(0.55);expect(v.stretch).toBeCloseTo(130/(238*0.55));expect(v.angle).toBe(Math.PI/2);});
});

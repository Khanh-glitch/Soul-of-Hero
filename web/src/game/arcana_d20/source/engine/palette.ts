// Hue-shifted, discrete colour ramps. Lookups snap to bands (no interpolation),
// which is what keeps procedural shading reading as authored pixel art.

export type RGB = [number, number, number];
export type Ramp = RGB[];

const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const R = (...h: string[]): Ramp => h.map(hex);

export const P = {
  // PYRE: soot -> oxblood -> crimson -> vermilion -> amber -> bone-white
  fire: R('#140608', '#3a0a10', '#6e0f16', '#a8180f', '#de4512', '#f7821b', '#ffbb3a', '#ffe58a', '#fffbe8'),
  ember: R('#2b0a0c', '#7a1410', '#d1400f', '#ff9a2a', '#ffe9a0'),
  ash: R('#0d0b0c', '#1f1a1a', '#383030', '#5a4d48', '#857268'),
  // TIDE
  water: R('#040c1a', '#08203d', '#0d3a63', '#145f8e', '#1f8fb8', '#43c0dc', '#93e6f2', '#e8fdff'),
  deep: R('#02060f', '#041228', '#071f3e', '#0b3157', '#114a73'),
  ice: R('#101a33', '#1d3557', '#2f5d8a', '#4f8fc0', '#86c3e8', '#c4ecff', '#f4feff'),
  foam: R('#a9e9f4', '#d9f8ff', '#ffffff'),
  // TEMPEST
  volt: R('#0a0a20', '#1b1c52', '#3134a6', '#5a72ff', '#93bdff', '#d8f0ff', '#ffffff'),
  plasma: R('#1c0a33', '#4b1a8a', '#8d4cff', '#c9a2ff', '#f3e6ff'),
  steel: R('#0d0f1a', '#1e2236', '#373d5c', '#5c6688', '#8d98b8'),
  // VERDANT
  leaf: R('#06140c', '#0f2e1b', '#1a4d2a', '#2a7536', '#4e9e3a', '#8ccc4c', '#d2f58a', '#f6ffd2'),
  bark: R('#120c09', '#2a1a12', '#46301e', '#6b4a2c', '#957043'),
  bloom: R('#3d0a2a', '#7a1652', '#c42f7e', '#ef6fa8', '#ffb6d3', '#fff0f6'),
  spore: R('#06231e', '#0b4a3e', '#14806a', '#33c4a0', '#86f2d2', '#e0fff6'),
  gold: R('#3a2206', '#7a4d0e', '#c08a1c', '#f2c54a', '#fff0a8'),
  // ASTRAL
  void: R('#030209', '#0e0724', '#231048', '#43207e', '#7440c4', '#ad7cff', '#e3d0ff', '#ffffff'),
  star: R('#2a1a4a', '#6a52b0', '#b6a6ff', '#e8e4ff', '#fffef2'),
  rift: R('#ff3fc1', '#ff8ae0', '#7ff3ff', '#d6ffff'),
};

export function ramp(r: Ramp, t: number): RGB {
  const i = t <= 0 ? 0 : t >= 1 ? r.length - 1 : Math.floor(t * r.length);
  return r[i < r.length ? i : r.length - 1];
}
/** dithered band lookup: blends between neighbouring bands using a bayer threshold */
export function rampD(r: Ramp, t: number, th: number): RGB {
  const f = t * (r.length - 1);
  let i = Math.floor(f);
  if (f - i > th) i++;
  return r[i < 0 ? 0 : i >= r.length ? r.length - 1 : i];
}

export const SCHOOLS = {
  PYRE: { name: 'Pyre', color: '#ff7a24', dim: '#5a1a10' },
  TIDE: { name: 'Tide', color: '#43c0dc', dim: '#0d3a63' },
  TEMPEST: { name: 'Tempest', color: '#93bdff', dim: '#1b1c52' },
  VERDANT: { name: 'Verdant', color: '#8ccc4c', dim: '#1a4d2a' },
  ASTRAL: { name: 'Astral', color: '#ad7cff', dim: '#231048' },
} as const;
export type School = keyof typeof SCHOOLS;

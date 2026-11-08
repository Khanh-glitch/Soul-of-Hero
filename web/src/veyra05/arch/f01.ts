/**
 * F01 — RESIDENTIAL SETTLEMENTS & LIVELIHOODS: reusable production grammar.
 *
 * This is not a village generator. It captures the repeatable craft decisions
 * that made the bespoke settlements work, while every settlement still authors
 * its own street pattern, building graph, material palette and hidden route:
 *
 *  - a dwelling is one masonry/timber mass with a named room, an entrance on a
 *    chosen side, and a small paved apron outside that entrance;
 *  - entrances face circulation (street, green, yard or shore), never a wall;
 *  - a loft is a separate lighter mass above part of the footprint, reached by
 *    a stair whose ground socket is inside or directly against the building;
 *  - work buildings get their own yard and service door logic;
 *  - cellar access is placed inside a real room (store, hall, smokehouse),
 *    never as a decorative stair icon on open ground.
 *
 * H02/H03 should reuse these decisions and materials, not copy H01 footprints.
 */
import type { Plan, Rect, Mat, RoofStyle, Level } from './plan';

export type DoorSide = 'N' | 'S' | 'E' | 'W';

export function doorPoint(rect: Rect, side: DoorSide): [number, number] {
  const [x, y, w, h] = rect;
  if (side === 'S') return [x + (w >> 1), y + h - 1];
  if (side === 'N') return [x + (w >> 1), y];
  if (side === 'W') return [x, y + (h >> 1)];
  return [x + w - 1, y + (h >> 1)];
}

export function outsideApron(rect: Rect, side: DoorSide): Rect {
  const [x, y, w, h] = rect;
  if (side === 'S') return [x + (w >> 1) - 2, y + h, 5, 2];
  if (side === 'N') return [x + (w >> 1) - 2, y - 2, 5, 2];
  if (side === 'W') return [x - 2, y + (h >> 1) - 2, 2, 5];
  return [x + w, y + (h >> 1) - 2, 2, 5];
}

export interface DwellingSpec {
  id: string;
  name: string;
  rect: Rect;
  mat?: Mat;
  roof?: RoofStyle | null;
  doorSide?: DoorSide;
  doorKind?: 'main' | 'service';
  grounds?: string;
  roomName?: string;
}

/** One believable dwelling/work building: mass, room, entrance and apron. */
export function addDwelling(b: Plan, s: DwellingSpec): [number, number] {
  const side = s.doorSide ?? 'S';
  const [dx, dy] = doorPoint(s.rect, side);
  b.structure(s.id, s.name, 0, { mat: s.mat ?? 'wood', roof: s.roof ?? 'wood' });
  b.room(s.id, s.roomName ?? s.name, 0, s.id, [s.rect]);
  b.door(dx, dy, 0, s.id, `${s.name} Door`, s.doorKind ?? 'main');
  if (s.grounds) b.room(`${s.id}_apron`, `${s.name} Apron`, 0, s.grounds, [outsideApron(s.rect, side)], { open: true });
  return [dx, dy];
}

/** A lighter upper mass over part of a dwelling, with a real stair socket. */
export function addLoft(
  b: Plan,
  id: string,
  name: string,
  rect: Rect,
  groundSocket: [number, number],
  roof: RoofStyle | null = 'wood',
  mat: Mat = 'wood',
) {
  b.structure(id, name, 1, { mat, roof });
  b.room(id, name, 1, id, [rect]);
  b.stair(groundSocket[0], groundSocket[1], 0, 1, rect[0] + 1, rect[1] + 1, `${name} Stair`, 'interior');
}

/** A roof deck / lookout over an upper mass. */
export function addRoofDeck(b: Plan, id: string, name: string, rect: Rect, ladderFrom: [number, number], mat: Mat = 'stone') {
  b.structure(id, name, 2, { mat, roof: null });
  b.room(id, name, 2, id, [rect]);
  b.stair(ladderFrom[0], ladderFrom[1], 1, 2, rect[0] + 1, rect[1] + 1, `${name} Ladder`, 'ladder');
}

/** Open settlement ground: streets, greens, yards and shore paths. */
export function addGround(b: Plan, groundsId: string, id: string, name: string, rects: Rect[]) {
  b.room(id, name, 0, groundsId, rects, { open: true });
}

/** A purposeful boundary segment. Barriers are never given fake doors. */
export function addBarrier(b: Plan, id: string, name: string, rects: Rect[], mat: Mat = 'stone') {
  b.structure(id, name, 0, { mat, roof: null, barrier: true });
  b.room(id, name, 0, id, rects);
}

export const F01_GRAMMAR = {
  family: 'F01 — Residential Settlements & Livelihoods',
  principles: [
    'Start from water, road and work: shore, well/cistern, forge, mine or caravan ground decides the street pattern.',
    'Public ground first: green/common, work yard and service lane are different outdoor rooms, not one paved rectangle.',
    'Each building has a livelihood role, an entrance facing circulation, a paved apron and a distinct roof/material silhouette.',
    'Private space is separated by partitions or level changes; work space stays open to its yard.',
    'Verticality is used only where the livelihood needs it: drying/sleeping lofts, lookout decks, cisterns, smoke and shelter cellars.',
    'A hidden route must join two real rooms and offer a second legitimate exit; it is discovered from a hatch inside a used room.',
    'Boundaries are partial and purposeful: flood/breakwater, windbreak or ash berm, with readable gates where people actually pass.',
  ],
  reusableForLaterTriads: ['doorPoint/outsideApron', 'addDwelling', 'addLoft', 'addRoofDeck', 'addGround', 'addBarrier', 'programme-driven interior detailing in arch/interior.ts'],
} as const;

export type { Level };

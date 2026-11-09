import { ITEMS, RECIPES } from './catalog';

export type LayoutId = 'shipping' | 'dev_delta';
export type TerrainKey = 'grass' | 'hill' | 'cliff';
export type LockKind = 'keycard' | 'power';
export interface LootDef { item: string; quantity: number }
export interface PoiDef {
  id: string; name: string; tx: number; ty: number; width: number; height: number; roof: string;
  horizontalWallY: number; horizontalDoorX: number; verticalWallX: number; powerDoorY: number;
  entry: { x: number; y: number }; keycardDoor: { x: number; y: number }; powerDoor: { x: number; y: number };
  generator: { x: number; y: number }; outerCache: { x: number; y: number }; vaultCache: { x: number; y: number };
  loot: { outer: LootDef[]; vault: LootDef[] };
}
export interface TerrainRect { x: number; y: number; width: number; height: number; terrain: TerrainKey }
export interface MapContentPackV1 {
  schemaVersion: 1; id: LayoutId; title: string; description: string;
  pois: PoiDef[]; terrain: TerrainRect[]; roadLinks: [string, string][];
  /** Authored infrastructure; economy may place suitable exterior salvage nearby. */
  infrastructure: { buildingId: string; kind: 'industrial'; radius: number }[];
}

const relay = (tx: number, ty: number): PoiDef => ({
  id: 'delta_relay', name: 'Delta Relay Station', tx, ty, width: 15, height: 11, roof: 'tin',
  horizontalWallY: 5, horizontalDoorX: 7, verticalWallX: 10, powerDoorY: 3,
  entry: { x: 7, y: 10 }, keycardDoor: { x: 7, y: 5 }, powerDoor: { x: 10, y: 3 },
  generator: { x: 4, y: 2 }, outerCache: { x: 2, y: 8 }, vaultCache: { x: 12, y: 2 },
  loot: {
    outer: [{ item: 'keycard', quantity: 1 }, { item: 'fuel_can', quantity: 1 }, { item: 'bandage', quantity: 1 }],
    vault: [{ item: 'iron_ingot', quantity: 4 }, { item: 'medkit', quantity: 1 }, { item: 'spares', quantity: 6 }],
  },
});

export const MAP_CONTENT_PACKS: Record<LayoutId, MapContentPackV1> = {
  // The shipping island's existing coordinates and features are left alone.
  shipping: {
    schemaVersion: 1, id: 'shipping', title: 'Shipping Island',
    description: 'Canonical production geography; no development terrain overlays.',
    pois: [], terrain: [], roadLinks: [], infrastructure: [{ buildingId: 'b_fa', kind: 'industrial', radius: 8 }],
  },
  dev_delta: {
    schemaVersion: 1, id: 'dev_delta', title: 'Delta Ridge (development)',
    description: 'A test layout with a broken cliff ridge and two traversable passes to a layered relay.',
    pois: [relay(145, 84)],
    terrain: [
      { x: 155, y: 66, width: 1, height: 41, terrain: 'cliff' },
      { x: 155, y: 74, width: 1, height: 3, terrain: 'hill' },
      { x: 155, y: 94, width: 1, height: 3, terrain: 'hill' },
    ],
    roadLinks: [['s1', 'delta_relay'], ['s3', 'delta_relay']], infrastructure: [{ buildingId: 'b_fa', kind: 'industrial', radius: 8 }],
  },
};

function validatePoi(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['POI must be an object'];
  const q = value as PoiDef;
  if (!/^[a-z][a-z0-9_]*$/.test(q.id || '')) errors.push('poi.id must be a stable lowercase id');
  if (typeof q.name !== 'string' || !q.name.trim()) errors.push('poi.name is required');
  if (!Number.isInteger(q.tx) || !Number.isInteger(q.ty) || q.tx < 16 || q.ty < 16 || q.tx > 184 || q.ty > 184) errors.push('poi origin must be an in-bounds integer tile');
  if (!Number.isInteger(q.width) || !Number.isInteger(q.height) || q.width < 5 || q.height < 5) errors.push('poi footprint must be at least 5 by 5 tiles');
  const anchors = ['entry','keycardDoor','powerDoor','generator','outerCache','vaultCache'] as const;
  for (const name of anchors) {
    const a = q[name];
    if (!a || !Number.isInteger(a.x) || !Number.isInteger(a.y) || a.x < 0 || a.y < 0 || a.x >= (q.width || 0) || a.y >= (q.height || 0)) errors.push(`${name} must be an integer point inside the POI footprint`);
  }
  if (q.entry && (q.entry.y !== q.height - 1 || q.entry.x <= 0 || q.entry.x >= q.width - 1)) errors.push('entry must sit on the outer south wall');
  if (!Number.isInteger(q.horizontalWallY) || !Number.isInteger(q.horizontalDoorX) || q.horizontalWallY <= 0 || q.horizontalWallY >= q.height - 1 || q.horizontalDoorX <= 0 || q.horizontalDoorX >= q.width - 1) errors.push('keycard wall/door coordinates are invalid');
  if (!Number.isInteger(q.verticalWallX) || !Number.isInteger(q.powerDoorY) || q.verticalWallX <= 0 || q.verticalWallX >= q.width - 1 || q.powerDoorY <= 0 || q.powerDoorY >= q.horizontalWallY) errors.push('power wall/door coordinates are invalid');
  if (q.keycardDoor && (q.keycardDoor.x !== q.horizontalDoorX || q.keycardDoor.y !== q.horizontalWallY)) errors.push('keycard door must occupy its authored wall opening');
  if (q.powerDoor && (q.powerDoor.x !== q.verticalWallX || q.powerDoor.y !== q.powerDoorY)) errors.push('power door must occupy its authored wall opening');
  if (q.generator && q.powerDoor && q.generator.x === q.powerDoor.x && q.generator.y === q.powerDoor.y) errors.push('generator cannot overlap the power door');
  if (q.outerCache && q.outerCache.y <= q.horizontalWallY) errors.push('outer cache must be reachable before the keycard door');
  if (q.generator && q.generator.x >= q.verticalWallX) errors.push('generator must be on the service side of the power gate');
  if (q.vaultCache && (q.vaultCache.x <= q.verticalWallX || q.vaultCache.y >= q.horizontalWallY)) errors.push('vault cache must be behind the power gate');
  for (const part of [q.loot?.outer || [], q.loot?.vault || []]) for (const item of part) {
    const blueprint = item.item.startsWith('blueprint:') ? item.item.slice('blueprint:'.length) : null;
    if (blueprint ? !RECIPES[blueprint] : !ITEMS[item.item]) errors.push(`unknown loot item: ${item.item}`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) errors.push(`loot quantity must be a positive integer: ${item.item}`);
  }
  if (!q.loot?.outer?.some(i => i.item === 'keycard') || !q.loot.outer.some(i => i.item === 'fuel_can')) errors.push('outer cache must supply both lawful access items');
  if (!q.loot?.vault?.length) errors.push('vault must contain useful loot');
  return errors;
}

export function validateContentPack(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['pack must be an object'];
  const p = value as Partial<MapContentPackV1>;
  if (p.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!p.id || !['shipping', 'dev_delta'].includes(p.id)) errors.push('id is not a supported layout id');
  if (typeof p.title !== 'string' || !p.title.trim()) errors.push('title is required');
  if (!Array.isArray(p.pois)) errors.push('pois must be an array');
  const poiIds = new Set<string>();
  for (const poi of p.pois || []) {
    errors.push(...validatePoi(poi));
    if (poi && typeof poi === 'object' && 'id' in poi) {
      const id = String((poi as PoiDef).id); if (poiIds.has(id)) errors.push(`duplicate POI id: ${id}`); poiIds.add(id);
    }
  }
  if (!Array.isArray(p.terrain)) errors.push('terrain must be an array');
  else for (const r of p.terrain) {
    if (![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.width <= 0 || r.height <= 0) errors.push('terrain rectangles need integer coordinates and positive dimensions');
    if (!['grass', 'hill', 'cliff'].includes(r.terrain)) errors.push(`unsupported terrain: ${r.terrain}`);
    if (r.x < 1 || r.y < 1 || r.x + r.width > 199 || r.y + r.height > 199) errors.push('terrain rectangle is outside the playable map bounds');
  }
  if (!Array.isArray(p.roadLinks)) errors.push('roadLinks must be an array');
  else for (const link of p.roadLinks) {
    if (!Array.isArray(link) || link.length !== 2 || !link.some(id => poiIds.has(id)) || link.some(id => typeof id !== 'string')) errors.push('each road link must connect a declared POI to a map place');
  }
  if (!Array.isArray(p.infrastructure)) errors.push('infrastructure must be an array (empty if none)');
  else for (const site of p.infrastructure) if (!site || typeof site.buildingId !== 'string' || site.kind !== 'industrial' || !Number.isFinite(site.radius) || site.radius < 0 || site.radius > 30) errors.push('invalid infrastructure tag');
  return errors;
}

export function validateAllContentPacks() {
  const errors = Object.values(MAP_CONTENT_PACKS).flatMap(pack => validateContentPack(pack).map(e => `${pack.id}: ${e}`));
  const ids = Object.keys(MAP_CONTENT_PACKS);
  if (new Set(ids).size !== ids.length) errors.push('layout ids must be unique');
  for (const [key, pack] of Object.entries(MAP_CONTENT_PACKS)) if (key !== pack.id) errors.push(`layout key ${key} does not match pack id ${pack.id}`);
  return errors;
}

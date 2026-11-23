// ============================================================================
// SURVIVOR HANDBOOK — the Fieldcraft chapters of the Journey ledger.
//
// Design rules (Creator decision 2026-11-22)
//  · The handbook explains EVERY mechanic of the game but never prescribes one
//    way to play. Chapters are topics, not a chain: all are open from the first
//    minute and can be done in any order.
//  · A step counts whenever the player really does it — before or after the
//    prompt, in any order inside the chapter (Bible C12). The step order shown
//    is only the order the tracker suggests.
//  · Where a mechanic has several valid approaches the step is "any one of":
//    trade OR help OR recruit OR rob; evacuate OR hold the island. The text
//    names every approach; doing one completes the step. Rewards are identical
//    whichever approach was taken.
//  · Each chapter issues ONE physical supply bundle per run. Early bundles
//    (tier 1) hand the newcomer the next chore already done; later bundles
//    (tier 2-3) are the exciting ones.
//  · Creator ruling on build 98ee24ac: the player never has to make everything
//    alone. Every bundle is a SOFT STARTER for a feature the chapter itself did
//    not teach: a ready-made piece the player can place or use at once, which
//    points at something deeper to explore. `opens` says in one line what that
//    is; the ledger prints it under the bundle.
//
// Authority rules
//  · Progress lives in `r.handbook` (run-authoritative, saved with the run).
//    It is folded from committed receipts at commit time inside `receipt()`,
//    so the 250-entry receipt ring can never lose a step.
//  · Only the player's own actions count: intent receipts are player-only by
//    construction; shared kinds are filtered by structure ownership or by the
//    NPC attribution flag (`beginNpcReceipt`).
//  · A reward is issued only by the `handbookClaim` engine intent, once per
//    chapter per run, never in QA-modified runs. Items are run-local physical
//    supplies; no Secured Cash and no profile currency is ever minted here.
// ============================================================================
import { ITEMS, RECIPES } from './catalog';
import { BAL, type HandbookLedger, type RunState } from './core';
import type { Receipt } from './presentation-cues';
import type { L, Lang } from './i18n';

// ---------------------------------------------------------------------------
// Receipt helpers
// ---------------------------------------------------------------------------
export const harvestUnits = (rc: Receipt) => { const m = / -(\d+)$/.exec(rc.detail); return m ? Math.max(1, +m[1]) : 1; };
export const buildType = (rc: Receipt) => rc.detail.split('@')[0];
/** Synthetic observation receipt (never written to the run) for a newly seen place. */
export const OBS_POI = 'obs.poi';

export type AnchorHint =
  | { kind: 'source'; mat: string }
  | { kind: 'struct'; types: string[] }
  | { kind: 'water' }
  | { kind: 'deathbag' };

export interface FieldStep {
  id: string; title: string; target: number;
  /** One-line "how" shown when the tracker opens up. */
  how: string;
  /** Why it matters (shown in the ledger and when blocked). */
  why: string;
  icon: string;
  anchor?: AnchorHint;
  /** Context where the tracker should open up to the informative state. */
  focus?: ('craft' | 'build' | 'station' | 'explore')[];
  /** Every receipt kind this step can count. Indexes the fold and lets a test prove each kind has an emitter. */
  kinds: string[];
  /** `r` is supplied by the authoritative fold; without it the predicate assumes the player acted. */
  count: (rc: Receipt, r?: RunState) => number;
  /** Absent/offline receipts count only when the player set the work in motion. */
  offlineOk?: boolean;
  vi: { title: string; how: string; why: string };
}
export type RewardTier = 1 | 2 | 3;
export interface FieldLesson {
  id: string; title: string; motto: string; icon: string; steps: FieldStep[];
  tier: RewardTier;
  /** One-time run-local supply bundle. */
  reward: [string, number][];
  /** One line: the feature this bundle lets the player start on without building it first. */
  opens: L;
  /** Step ids required before the bundle can be claimed (default: every step). */
  needs?: string[];
  vi: { title: string; motto: string };
}

const SUSTAIN_KINDS = ['drink', 'drink.flask', 'consume', 'barrel.drink', 'rest.eat', 'rest.drink'];
const STUDY_KINDS = ['learn.blueprint', 'research.specimen', 'research.random', 'research.directed', 'research.family.queue'];
const MEND_KINDS = ['item.repair', 'core.repair', 'structure.repair', 'structure.repair.plate', 'territory.repair.batch'];
const REUSE_KINDS = ['recycle.start', 'item.salvage', 'reclaim'];
const WATER_KINDS = ['garden.water', 'barrel.fill', 'barrel.pour'];
const YIELD_KINDS = ['garden.harvest', 'creature.kill', 'husbandry.tame', 'husbandry.butcher'];
const SCAVENGE_KINDS = ['intel.loot', 'airdrop.open', 'cash.view', 'g1b.search', 'g1b.open'];
const CART_KINDS = ['cart.place', 'cart.pack', 'cart.grab'];
const DEAL_KINDS = ['human.exchange', 'human.aid.commit', 'human.repair', 'human.kitchen.contribute', 'human.follow', 'human.order', 'human.threaten', 'human.loot'];
const VENDOR_KINDS = ['vendor.spares', 'vendor.buy', 'vendor.parcel'];
const FUEL_KINDS = ['industrial.install', 'power.fuel', 'vehicle.refuel'];
const RIDE_KINDS = ['vehicle.mount', 'vehicle.deploy', 'cart.place'];
const DEFENCE_TYPES = ['barricade', 'spikes', 'bear_trap', 'arrow_turret'];
const POWER_TYPES = ['base_generator'];
const OIL_TYPES = ['oil_pump', 'refinery'];

const built = (pred: (type: string) => boolean) => (rc: Receipt) => (rc.kind === 'build' && pred(buildType(rc)) ? 1 : 0);
const ach = (key: string) => (rc: Receipt) => (rc.kind === 'achievement' && rc.detail === key ? 1 : 0);
const playerOwned = (e: { kind: string; owner?: string } | undefined) => !!e && e.kind === 'struct' && (!e.owner || e.owner === 'player');
const entityOf = (r: RunState, id: string) => r.entities[id] ?? r.veyraOffscreenEntities?.[id];
/** A station job counts only at the player's own station; residents run their own kitchens and furnaces. */
function stationOf(r: RunState | undefined, eid: string | undefined, types: string[]): boolean {
  if (!r) return true;
  if (!eid) return false;
  const e = entityOf(r, eid);
  return playerOwned(e) && types.includes(e!.type ?? '');
}
/** `move` detail is `<item> <from>-><to>`: true when a pack item went into the player's own storage. */
function storedInChest(r: RunState | undefined, detail: string): boolean {
  const m = / (\S+)->(\S+)$/.exec(detail);
  if (!m || m[1] !== 'inv' || m[2] === 'inv') return false;
  if (!r) return true;
  const holds = (e: { kind: string; owner?: string; c?: string } | undefined) => playerOwned(e) && e!.c === m[2];
  return Object.values(r.entities).some(holds) || Object.values(r.veyraOffscreenEntities ?? {}).some(holds);
}
const isMedicine = (key: string) => { const f = ITEMS[key]?.food as { hp?: number; hunger?: number; thirst?: number } | undefined; return !!f && (f.hp ?? 0) > 0 && !f.hunger && !f.thirst; };
const isWargear = (recipe: string) => { const cat = ITEMS[RECIPES[recipe]?.out ?? '']?.cat; return cat === 'weapon' || cat === 'armor'; };
const isCoreSupply = (recipe: string) => { const out = RECIPES[recipe]?.out ?? ''; return out.startsWith('energy_') || out.startsWith('essence_'); };

// ---------------------------------------------------------------------------
// CHAPTERS — optional, unordered, receipt-backed.
// ---------------------------------------------------------------------------
export const FIELDCRAFT: FieldLesson[] = [
  { id: 'landfall', title: 'Landfall', motto: 'An axe in hand, the island ahead.', icon: 'wood', tier: 1,
    vi: { title: 'Đặt chân', motto: 'Rìu trong tay, hòn đảo trước mặt.' },
    reward: [['wood_club', 1], ['deploy_claim', 1], ['deploy_campfire', 1], ['cooked_meat', 4]],
    opens: { en: 'A club for fights and roadside salvage; a Territory Cabinet and a campfire to start a camp of your own.', vi: 'Gậy gỗ để đánh và đập đồ ven đường; Tủ lãnh thổ và bếp lửa để dựng trại riêng.' },
    steps: [
    { id: 'gather', title: 'Gather with your axe', target: 3, icon: 'wood', how: 'Swing LMB at a tree, boulder or bush. Your Stone Axe works all three.', why: 'Every tool, wall and fire begins as raw timber, stone and fiber.', anchor: { kind: 'source', mat: 'wood' }, focus: ['explore'], kinds: ['harvest'], vi: { title: 'Thu hoạch bằng rìu', how: 'Nhấn chuột trái vào cây, tảng đá hoặc bụi cây. Rìu đá làm được cả ba.', why: 'Mọi công cụ, bức tường và ngọn lửa đều bắt đầu từ gỗ, đá và sợi thô.' },
      count: rc => rc.kind === 'harvest' ? harvestUnits(rc) : 0 },
    { id: 'tool', title: 'Shape a tool', target: 1, icon: 'rope', how: 'Open Survivor [C] and craft anything you can afford.', why: 'Better tools take more with each swing; weapons and kits open new work.', focus: ['craft'], kinds: ['craft.hand'], vi: { title: 'Chế một món đồ', how: 'Mở Survivor [C] và chế bất cứ món nào đủ nguyên liệu.', why: 'Công cụ tốt hơn thu được nhiều hơn mỗi nhát; vũ khí và bộ đồ nghề mở ra việc mới.' },
      count: rc => rc.kind === 'craft.hand' ? 1 : 0 },
    { id: 'sustain', title: 'Drink or eat', target: 1, icon: 'berries', how: 'E beside river water, or use food from Quickbar 1–8.', why: 'Hunger and thirst quietly drain stamina and, at the end, health.', anchor: { kind: 'water' }, kinds: ['drink', 'drink.flask', 'consume', 'barrel.drink', 'rest.eat', 'rest.drink'], vi: { title: 'Uống hoặc ăn', how: 'Nhấn E cạnh nước sông, hoặc dùng thức ăn trên Quickbar 1–8.', why: 'Đói và khát âm thầm rút thể lực, cuối cùng rút cả máu.' },
      count: rc => SUSTAIN_KINDS.includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'shelter', title: 'Hearth & Wall', motto: 'A roof is the first victory.', icon: 'st:wall_wood', tier: 1,
    vi: { title: 'Mái nhà', motto: 'Mái nhà là chiến thắng đầu tiên.' },
    reward: [['deploy_workbench', 1], ['deploy_chest_small', 1], ['deploy_bed_straw', 1], ['torch', 2]],
    opens: { en: 'A Workbench to place at once: repairs and the first real recipes. The bed is where you wake after a fall.', vi: 'Bàn chế tạo đặt được ngay: sửa đồ và những công thức đầu tiên. Giường là nơi bạn tỉnh dậy sau khi gục.' },
    steps: [
    { id: 'floor', title: 'Lay a foundation', target: 1, icon: 'st:floor_wood', how: 'B > Foundation > Wood Floor, then click open ground.', why: 'The cabinet and every roof stand on a foundation tile.', focus: ['build'], kinds: ['build'], vi: { title: 'Đặt nền', how: 'Nhấn B > Foundation > Wood Floor, rồi nhấp vào khoảng đất trống.', why: 'Cabinet và mọi mái nhà đều phải đứng trên ô nền.' },
      count: built(t => t.startsWith('floor')) },
    { id: 'claim', title: 'Raise a Territory Cabinet', target: 1, icon: 'st:claim', how: 'Survivor [C] > Deploy: craft the cabinet. Select the pack on the Quickbar, click LMB, then click your foundation.', why: `Unclaimed structures decay in about ${BAL.territory.unprotectedCollapseHours} hours. The cabinet protects them.`, focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Dựng Territory Cabinet', how: 'Survivor [C] > Deploy: chế cabinet. Chọn gói đó trên Quickbar, nhấn chuột trái, rồi nhấp vào ô nền của bạn.', why: `Công trình không có cabinet bảo vệ sẽ mục sau khoảng ${BAL.territory.unprotectedCollapseHours} giờ. Cabinet giữ chúng lại.` },
      count: built(t => t === 'claim') },
    { id: 'walls', title: 'Raise four walls', target: 4, icon: 'st:wall_wood', how: 'B > Wall > Wood Wall. Each wall needs its own tile.', why: 'Walls keep creatures out and keep the warmth of a fire in.', focus: ['build'], kinds: ['build'], vi: { title: 'Dựng bốn bức tường', how: 'Nhấn B > Wall > Wood Wall. Mỗi bức tường cần một ô riêng.', why: 'Tường chặn quái vật ở ngoài và giữ hơi ấm của lửa ở trong.' },
      count: built(t => t.startsWith('wall')) },
    { id: 'door', title: 'Hang a door', target: 1, icon: 'st:door_wood', how: 'B > Wall > Wood Door (needs Rope). E opens and closes it.', why: 'Creatures cannot open doors. You can.', focus: ['build'], kinds: ['build'], vi: { title: 'Lắp cửa', how: 'Nhấn B > Wall > Wood Door (cần Rope). Nhấn E để mở và đóng.', why: 'Quái vật không mở được cửa. Bạn thì mở được.' },
      count: built(t => t.startsWith('door')) },
    { id: 'home', title: 'Close a home', target: 1, icon: 'st:roof_thatch', how: 'Enclose the walls, then add a roof or a Straw Bed inside.', why: 'A sealed home shelters you from cold and stops warmth loss at night.', focus: ['build'], kinds: ['achievement'], vi: { title: 'Khép kín ngôi nhà', how: 'Quây kín tường, rồi thêm mái hoặc đặt Straw Bed bên trong.', why: 'Nhà kín che bạn khỏi lạnh và giữ ấm suốt đêm.' },
      count: ach('first_home') },
  ] },
  { id: 'industry', title: 'Fire & Iron', motto: 'Stations do the waiting for you.', icon: 'iron_ingot', tier: 1,
    vi: { title: 'Lửa và sắt', motto: 'Trạm chế tạo chờ thay cho bạn.' },
    reward: [['deploy_research', 1], ['iron_ingot', 6], ['charcoal', 10], ['rope', 4]],
    opens: { en: 'A Research Table to place at once: study what you find and learn recipes nobody hands you.', vi: 'Bàn nghiên cứu đặt được ngay: nghiên cứu thứ nhặt được để học công thức không ai cho sẵn.' },
    steps: [
    { id: 'fire', title: 'Light a campfire', target: 1, icon: 'st:campfire', how: 'Craft a Campfire in Survivor [C] > Deploy, select the pack and place it. Feed it wood.', why: 'Fire is warmth at night and the first cooking station.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Nhóm lửa trại', how: 'Chế Campfire trong Survivor [C] > Deploy, chọn gói rồi đặt xuống. Cho gỗ vào làm chất đốt.', why: 'Lửa là hơi ấm ban đêm và là bếp nấu đầu tiên.' },
      count: built(t => t === 'campfire') },
    { id: 'cook', title: 'Cook a meal', target: 1, icon: 'cooked_meat', how: 'E on the Campfire: add fuel, then queue any recipe.', why: 'Cooked food fills far more than raw food and can add warmth.', anchor: { kind: 'struct', types: ['campfire'] }, focus: ['station'], kinds: ['job.queue'], vi: { title: 'Nấu một món', how: 'Nhấn E vào Campfire: thêm chất đốt, rồi xếp một công thức bất kỳ.', why: 'Đồ chín no lâu hơn đồ sống nhiều và còn giúp ấm người.' },
      count: (rc, r) => rc.kind === 'job.queue' && stationOf(r, rc.detail.split('@')[1], ['campfire']) ? 1 : 0 },
    { id: 'bench', title: 'Build a Workbench', target: 1, icon: 'st:workbench', how: 'Craft a Workbench pack in Survivor [C] > Deploy and place it.', why: 'Benches unlock the recipes your hands alone cannot make.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Dựng Workbench', how: 'Chế gói Workbench trong Survivor [C] > Deploy rồi đặt xuống.', why: 'Bàn chế mở ra những công thức tay không làm không nổi.' },
      count: built(t => t === 'workbench') },
    { id: 'furnace', title: 'Build a Furnace', target: 1, icon: 'st:furnace', how: 'Craft a Furnace pack and place it near your shelter.', why: 'Ore is worthless until fire turns it into ingots.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Dựng Furnace', how: 'Chế gói Furnace rồi đặt gần chỗ ở.', why: 'Quặng vô dụng cho tới khi lửa biến nó thành thỏi.' },
      count: built(t => t === 'furnace' || t === 'large_furnace') },
    { id: 'smelt', title: 'Smelt an ingot', target: 1, icon: 'iron_ingot', how: 'E on the Furnace: fuel it, queue Iron Ingot, collect.', why: 'Iron is the gateway to stronger tools, plates and machines.', anchor: { kind: 'struct', types: ['furnace'] }, focus: ['station'], offlineOk: true, kinds: ['job.done', 'achievement'], vi: { title: 'Luyện một thỏi', how: 'Nhấn E vào Furnace: thêm chất đốt, xếp Iron Ingot, rồi lấy ra.', why: 'Sắt là cánh cửa tới công cụ, giáp và máy móc mạnh hơn.' },
      count: (rc, r) => (rc.kind === 'achievement' && rc.detail === 'first_ingot') || (rc.kind === 'job.done' && stationOf(r, rc.detail.split(':')[0], ['furnace', 'large_furnace'])) ? 1 : 0 },
  ] },
  { id: 'knowledge', title: 'Paper & Parts', motto: 'What you learn cannot be looted.', icon: 'blueprint', tier: 2,
    vi: { title: 'Tri thức', motto: 'Điều đã học thì không ai cướp được.' },
    reward: [['deploy_garden', 1], ['seed_sunroot', 4], ['spares', 12], ['electronic_parts', 4]],
    opens: { en: 'A Garden Plot and seeds: food you grow instead of chase. The Parts feed your next study.', vi: 'Luống vườn và hạt giống: thức ăn tự trồng, khỏi phải đi săn. Linh kiện dùng cho lần nghiên cứu tới.' },
    steps: [
    { id: 'table', title: 'Set up a Research Table', target: 1, icon: 'st:research', how: 'Craft the Research Table pack (wood, Parts, an Iron Ingot) and place it.', why: 'The table turns Parts and specimens into new recipes.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Dựng Research Table', how: 'Chế gói Research Table (gỗ, Parts, một Iron Ingot) rồi đặt xuống.', why: 'Bàn nghiên cứu biến Parts và mẫu vật thành công thức mới.' },
      count: built(t => t === 'research') },
    { id: 'study', title: 'Study or learn a recipe', target: 1, icon: 'blueprint', how: 'Any one: spend Parts at the Research Table, dissect a specimen there, or read a Blueprint from your pack.', why: 'Knowledge is permanent for the run — it never breaks or decays.', anchor: { kind: 'struct', types: ['research'] }, focus: ['station', 'craft'], offlineOk: true, kinds: ['learn.blueprint', 'research.specimen', 'research.random', 'research.directed', 'research.family.queue', 'achievement'], vi: { title: 'Nghiên cứu hoặc học một công thức', how: 'Chọn một cách: tiêu Parts ở Research Table, mổ xẻ một mẫu vật tại đó, hoặc đọc Blueprint trong túi.', why: 'Tri thức tồn tại suốt lượt chơi — không hỏng, không mục.' },
      count: rc => STUDY_KINDS.includes(rc.kind) || (rc.kind === 'achievement' && rc.detail === 'first_research') ? 1 : 0 },
    { id: 'mend', title: 'Mend something worn', target: 1, icon: 'mechanical_gear', how: 'Any one: repair a tool at a Workbench, or press V in Build mode and click a damaged structure.', why: 'Repair costs a fraction of making the thing again.', focus: ['station'], kinds: ['item.repair', 'core.repair', 'structure.repair', 'structure.repair.plate', 'territory.repair.batch'], vi: { title: 'Sửa một món đã mòn', how: 'Chọn một cách: sửa công cụ ở Workbench, hoặc nhấn V trong chế độ xây rồi nhấp vào công trình bị hư.', why: 'Sửa chỉ tốn một phần nhỏ so với làm lại từ đầu.' },
      count: rc => MEND_KINDS.includes(rc.kind) ? 1 : 0 },
    { id: 'reuse', title: 'Take something apart', target: 1, icon: 'scrap', how: 'Any one: feed a Recycler, dismantle an item at a Workbench, or reclaim a structure with X in Build mode.', why: 'Nothing on the island is waste; old gear is tomorrow\'s materials.', kinds: ['recycle.start', 'item.salvage', 'reclaim'], vi: { title: 'Tháo dỡ một món', how: 'Chọn một cách: cho đồ vào Recycler, tháo một món ở Workbench, hoặc thu hồi công trình bằng X trong chế độ xây.', why: 'Trên đảo không có gì là rác; đồ cũ là nguyên liệu của ngày mai.' },
      count: rc => REUSE_KINDS.includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'provisions', title: 'Field & Flock', motto: 'A full larder is a quiet mind.', icon: 'crop', tier: 2,
    vi: { title: 'Lương thực', motto: 'Kho đầy thì lòng yên.' },
    reward: [['lead_rope', 2], ['deploy_feed_trough', 1], ['trail_canteen', 1], ['seed_wildberry', 3]],
    opens: { en: 'Taming Leads and a Feed Trough: lead a boar, deer, hare or grouse into a pen and keep a flock.', vi: 'Dây dắt thú và máng ăn: dắt lợn rừng, hươu, thỏ hoặc gà gô vào chuồng để nuôi đàn.' },
    steps: [
    { id: 'plot', title: 'Place a Garden Plot', target: 1, icon: 'st:garden', how: 'Craft a Garden Plot pack (wood, fiber) and place it on open ground.', why: 'A garden feeds you without leaving your walls.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Đặt Garden Plot', how: 'Chế gói Garden Plot (gỗ, sợi) rồi đặt lên đất trống.', why: 'Vườn nuôi bạn mà không cần rời khỏi tường nhà.' },
      count: built(t => t === 'garden') },
    { id: 'plant', title: 'Plant a seed', target: 1, icon: 'seed', how: 'E on the plot with seeds in your pack. Each crop likes a season.', why: 'Seeds come back with the harvest, so one seed can feed a whole run.', anchor: { kind: 'struct', types: ['garden'] }, kinds: ['garden.plant'], vi: { title: 'Gieo một hạt', how: 'Nhấn E vào luống khi trong túi có hạt. Mỗi loại cây hợp một mùa.', why: 'Hạt được trả lại khi thu hoạch, nên một hạt có thể nuôi cả lượt chơi.' },
      count: rc => rc.kind === 'garden.plant' ? 1 : 0 },
    { id: 'water', title: 'Carry water', target: 1, icon: 'water_flask', how: 'Any one: water the plot from a flask or canteen, or fill a Rain Barrel.', why: 'Crops only grow while watered. Rain counts.', kinds: ['garden.water', 'barrel.fill', 'barrel.pour'], vi: { title: 'Lấy nước', how: 'Chọn một cách: tưới luống bằng bình nước, hoặc đổ đầy Rain Barrel.', why: 'Cây chỉ lớn khi được tưới. Mưa cũng tính.' },
      count: rc => WATER_KINDS.includes(rc.kind) ? 1 : 0 },
    { id: 'yield', title: 'Bring in food', target: 1, icon: 'meat', how: 'Any one: harvest a ripe plot, hunt an animal, or tame one with a Taming Lead.', why: 'Farming, hunting and herding all end at the same cooking fire.', kinds: ['garden.harvest', 'creature.kill', 'husbandry.tame', 'husbandry.butcher'], vi: { title: 'Mang thức ăn về', how: 'Chọn một cách: thu hoạch luống đã chín, săn một con thú, hoặc thuần hóa bằng Taming Lead.', why: 'Trồng trọt, săn bắt hay chăn nuôi đều về chung một bếp lửa.' },
      count: rc => YIELD_KINDS.includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'expedition', title: 'Beyond the Treeline', motto: 'The map is earned, step by step.', icon: 'spares', tier: 2,
    vi: { title: 'Khám phá', motto: 'Bản đồ được vẽ bằng từng bước chân.' },
    reward: [['cart_kit', 1], ['trail_pack', 1], ['bandage', 4]],
    opens: { en: 'A packed Hand Cart: place it, load it, pull it with F. Long hauls stop being a weight problem.', vi: 'Xe kéo tay đóng gói: đặt xuống, chất đồ, kéo bằng phím F. Chở xa không còn lo quá nặng.' },
    steps: [
    { id: 'discover', title: 'Discover two places', target: 2, icon: 'spares', how: 'Travel until a place name rises on screen. Field Chart [M] shows where you have been.', why: 'Places hold loot sites, traders, vaults and Elders.', focus: ['explore'], kinds: ['poi.discover'], vi: { title: 'Khám phá hai địa điểm', how: 'Đi cho tới khi tên địa điểm hiện lên màn hình. Field Chart [M] cho biết bạn đã đi qua đâu.', why: 'Các địa điểm chứa chỗ lục đồ, thương nhân, hầm kín và Elder.' },
      count: rc => rc.kind === 'poi.discover' || rc.kind === OBS_POI ? 1 : 0 },
    { id: 'scavenge', title: 'Search a loot site', target: 1, icon: 'scrap', how: 'E on a crate, cache, card room or supply drop.', why: 'Scavenged parts skip hours of crafting.', focus: ['explore'], kinds: ['intel.loot', 'airdrop.open', 'cash.view', 'g1b.search', 'g1b.open'], vi: { title: 'Lục một điểm có đồ', how: 'Nhấn E vào thùng, kho giấu, phòng thẻ hoặc thùng tiếp tế.', why: 'Linh kiện nhặt được giúp bỏ qua hàng giờ chế tạo.' },
      count: rc => SCAVENGE_KINDS.includes(rc.kind) ? 1 : 0 },
    { id: 'carry', title: 'Stash or haul your finds', target: 1, icon: 'st:chest_small', how: 'Any one: move an item from your pack into a chest, or place a Hand Cart and pull it with F.', why: 'What you carry is lost when you fall. What you store is not.', kinds: ['move', 'cart.place', 'cart.pack', 'cart.grab'], vi: { title: 'Cất hoặc chở đồ về', how: 'Chọn một cách: chuyển một món từ túi vào rương, hoặc đặt Hand Cart rồi kéo bằng F.', why: 'Đồ mang trên người sẽ rơi khi bạn gục. Đồ đã cất thì không.' },
      count: (rc, r) => CART_KINDS.includes(rc.kind) || (rc.kind === 'move' && storedInChest(r, rc.detail)) ? 1 : 0 },
  ] },
  { id: 'combat', title: 'Tooth & Steel', motto: 'Learn the tell, then answer it.', icon: 'leather', tier: 2,
    vi: { title: 'Chiến đấu', motto: 'Đọc đòn trước, rồi mới đáp trả.' },
    reward: [['bow', 1], ['arrow', 24], ['medkit', 2]],
    opens: { en: 'A Hunting Bow and arrows: fight from range and hunt what runs from you.', vi: 'Cung săn và tên: đánh từ xa và săn những con hay bỏ chạy.' },
    steps: [
    { id: 'defend', title: 'Defend yourself', target: 1, icon: 'leather', how: 'LMB to strike, Space to dodge-roll away from tells.', why: 'Creatures guard the best ground. Learning their tells keeps you alive.', kinds: ['creature.kill'], vi: { title: 'Tự vệ', how: 'Chuột trái để đánh, Space để lăn né khi quái ra đòn.', why: 'Quái vật canh giữ những vùng đất tốt nhất. Đọc được đòn của chúng là sống sót.' },
      count: rc => rc.kind === 'creature.kill' ? 1 : 0 },
    { id: 'heal', title: 'Dress a wound', target: 1, icon: 'bandage', how: 'Craft a Bandage (4 Plant Fiber) and use it from the Quickbar.', why: 'Health does not come back on its own fast enough to matter in a fight.', focus: ['craft'], kinds: ['consume'], vi: { title: 'Băng bó vết thương', how: 'Chế Bandage (4 Plant Fiber) rồi dùng từ Quickbar.', why: 'Máu không tự hồi đủ nhanh để cứu bạn giữa trận đánh.' },
      count: rc => rc.kind === 'consume' && isMedicine(rc.detail) ? 1 : 0 },
    { id: 'arm', title: 'Make a weapon or armor', target: 1, icon: 'wood_spear', how: 'Survivor [C] or a Workbench: any weapon or any armor piece.', why: 'Reach, damage and armor decide a fight before it starts.', focus: ['craft'], kinds: ['craft.hand', 'job.queue'], vi: { title: 'Làm vũ khí hoặc giáp', how: 'Survivor [C] hoặc Workbench: bất kỳ vũ khí hay mảnh giáp nào.', why: 'Tầm đánh, sát thương và giáp quyết định trận đấu trước khi nó bắt đầu.' },
      count: rc => (rc.kind === 'craft.hand' && isWargear(rc.detail)) || (rc.kind === 'job.queue' && isWargear(rc.detail.split('@')[0])) ? 1 : 0 },
    { id: 'fortify', title: 'Set a defence', target: 1, icon: 'st:barricade', how: 'Any one: place a Barricade, Spike Trap, Bear Trap or Arrow Turret.', why: 'Defences fight while you sleep, craft or run.', focus: ['craft', 'build'], kinds: ['build'], vi: { title: 'Dựng phòng thủ', how: 'Chọn một cách: đặt Barricade, Spike Trap, Bear Trap hoặc Arrow Turret.', why: 'Phòng thủ chiến đấu thay bạn khi bạn ngủ, chế đồ hay bỏ chạy.' },
      count: built(t => DEFENCE_TYPES.includes(t)) },
  ] },
  { id: 'residents', title: 'Neighbours', motto: 'Everyone here is trying to live.', icon: 'cloth', tier: 3,
    vi: { title: 'Cư dân', motto: 'Ở đây ai cũng đang cố sống.' },
    reward: [['medkit', 3], ['canned_meat', 4], ['fruit_wine', 2]],
    opens: { en: 'Things other people need: treat the wounded, feed the hungry, and see who follows you.', vi: 'Những thứ người khác cần: chữa người bị thương, cho người đói ăn, rồi xem ai đi theo bạn.' },
    steps: [
    { id: 'talk', title: 'Talk to a survivor', target: 1, icon: 'cloth', how: 'Walk up to a resident and pick them from the Nearby survivors list at the top of the screen.', why: 'They tell you what they need, what they fear and what they will trade.', kinds: ['human.talk'], vi: { title: 'Nói chuyện với một cư dân', how: 'Lại gần một cư dân rồi chọn họ trong danh sách Nearby survivors ở đầu màn hình.', why: 'Họ cho biết họ cần gì, sợ gì và sẵn sàng đổi gì.' },
      count: rc => rc.kind === 'human.talk' ? 1 : 0 },
    { id: 'deal', title: 'Choose how you deal with them', target: 1, icon: 'rope', how: 'Any one: trade items, give first aid, repair their gear, bring food to their kitchen, recruit a companion — or threaten and rob. The island remembers either way.', why: 'Residents can die, be saved or leave on the boats. Your choices decide how many.', kinds: ['human.exchange', 'human.aid.commit', 'human.repair', 'human.kitchen.contribute', 'human.follow', 'human.order', 'human.threaten', 'human.loot'], vi: { title: 'Chọn cách đối xử với họ', how: 'Chọn một cách: đổi đồ, sơ cứu, sửa đồ cho họ, góp thức ăn cho bếp, chiêu mộ bạn đồng hành — hoặc đe dọa và cướp. Cách nào hòn đảo cũng ghi nhớ.', why: 'Cư dân có thể chết, được cứu hoặc rời đi bằng thuyền. Lựa chọn của bạn quyết định con số đó.' },
      count: rc => DEAL_KINDS.includes(rc.kind) && !(rc.kind === 'human.follow' && rc.detail.endsWith(':off')) ? 1 : 0 },
    { id: 'trader', title: 'Buy from a trader', target: 1, icon: 'spares', how: 'Find a trader at a settlement and pay with Parts.', why: 'Traders sell what the wilds do not grow. Stock is limited each run.', focus: ['explore'], kinds: ['vendor.spares', 'vendor.buy', 'vendor.parcel'], vi: { title: 'Mua của thương nhân', how: 'Tìm thương nhân ở một khu dân cư và trả bằng Parts.', why: 'Thương nhân bán những thứ rừng không mọc ra. Hàng có hạn mỗi lượt chơi.' },
      count: rc => VENDOR_KINDS.includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'machines', title: 'Wheels & Wires', motto: 'Let the machine carry it.', icon: 'mechanical_gear', tier: 3,
    vi: { title: 'Máy móc', motto: 'Hãy để máy móc gánh thay.' },
    reward: [['fuel_can', 3], ['mechanical_gear', 4], ['iron_plate', 4]],
    opens: { en: 'Gears and plates for a Motorbike kit, and fuel to ride it. The frame is yours to build.', vi: 'Bánh răng và tấm sắt cho bộ Xe máy, cùng nhiên liệu để chạy. Khung xe thì bạn tự làm.' },
    steps: [
    { id: 'power', title: 'Bring power to your base', target: 1, icon: 'st:base_generator', how: 'Craft and place a Field Generator, fuel it and switch it on.', why: 'Powered doors, turrets and benches need a generator within reach.', focus: ['craft', 'build'], kinds: ['build', 'power.toggle'], vi: { title: 'Đưa điện về căn cứ', how: 'Chế và đặt Field Generator, đổ nhiên liệu rồi bật lên.', why: 'Cửa điện, tháp bắn và bàn chế chạy điện đều cần máy phát trong tầm.' },
      count: rc => rc.kind === 'power.toggle' || (rc.kind === 'build' && POWER_TYPES.includes(buildType(rc))) ? 1 : 0 },
    { id: 'fuel', title: 'Work with fuel', target: 1, icon: 'fuel_can', how: 'Any one: place an Oil Pump or Oil Refinery, fit a power module to a Workbench, or refuel a generator or motorbike.', why: 'Fuel Canisters come only from refining real oil.', kinds: ['build', 'industrial.install', 'power.fuel', 'vehicle.refuel'], vi: { title: 'Làm việc với nhiên liệu', how: 'Chọn một cách: đặt Oil Pump hoặc Oil Refinery, lắp mô-đun điện cho Workbench, hoặc đổ nhiên liệu cho máy phát hay xe máy.', why: 'Fuel Canister chỉ có được từ việc lọc dầu thật.' },
      // `power.fuel` is written whenever ANY generator burns a unit: only the player's own generator counts.
      count: (rc, r) => (rc.kind === 'power.fuel' ? stationOf(r, rc.detail.split(':')[0], POWER_TYPES) : FUEL_KINDS.includes(rc.kind) || (rc.kind === 'build' && OIL_TYPES.includes(buildType(rc)))) ? 1 : 0 },
    { id: 'ride', title: 'Put wheels under your cargo', target: 1, icon: 'cart_kit', how: 'Any one: place a Hand Cart, or deploy and mount a Utility Motorbike (F).', why: 'The island is larger than one backpack.', kinds: ['vehicle.mount', 'vehicle.deploy', 'cart.place'], vi: { title: 'Chở hàng bằng bánh xe', how: 'Chọn một cách: đặt Hand Cart, hoặc triển khai và leo lên Utility Motorbike (F).', why: 'Hòn đảo rộng hơn một chiếc ba lô nhiều.' },
      count: rc => RIDE_KINDS.includes(rc.kind) ? 1 : 0 },
  ] },
  { id: 'cores', title: 'Old Power', motto: 'Old power answers a steady hand.', icon: 'core_dragon', tier: 3,
    vi: { title: 'Sức mạnh cổ xưa', motto: 'Sức mạnh cổ xưa đáp lời bàn tay vững.' },
    reward: [['energy_refined', 12], ['energy_basic', 40], ['crystal', 3]],
    opens: { en: 'Charged cells for a Creator Core: enough to learn what each cast really costs.', vi: 'Pin đã nạp cho Lõi Sáng Tạo: đủ để biết mỗi lần thi triển tốn bao nhiêu.' },
    steps: [
    { id: 'charge', title: 'Make energy cells', target: 1, icon: 'energy_basic', how: 'Survivor [C]: Basic Energy needs only stone and fiber.', why: 'A Core spends cells from your pack on every cast. There is no reload.', focus: ['craft'], kinds: ['craft.hand', 'job.queue'], vi: { title: 'Chế ô năng lượng', how: 'Survivor [C]: Basic Energy chỉ cần đá và sợi.', why: 'Core tiêu ô năng lượng trong túi cho mỗi lần thi triển. Không có nạp lại.' },
      count: rc => (rc.kind === 'craft.hand' && isCoreSupply(rc.detail)) || (rc.kind === 'job.queue' && isCoreSupply(rc.detail.split('@')[0])) ? 1 : 0 },
    { id: 'cast', title: 'Unleash a Creator Core', target: 1, icon: 'core_dragon', how: 'Select a Core on the Quickbar. LMB fires Basic; hold Q or E for techniques once upgraded.', why: 'Cores turn a hopeless fight around — at a real material price.', kinds: ['core.commit', 'achievement'], vi: { title: 'Giải phóng một Creator Core', how: 'Chọn Core trên Quickbar. Chuột trái bắn đòn cơ bản; giữ Q hoặc E cho chiêu thức khi đã nâng cấp.', why: 'Core lật ngược một trận đánh tưởng thua — với cái giá nguyên liệu thật.' },
      count: rc => rc.kind === 'core.commit' || (rc.kind === 'achievement' && rc.detail === 'first_core') ? 1 : 0 },
    { id: 'tend', title: 'Upgrade or repair a Core', target: 1, icon: 'crystal', how: 'At your Workbench: start a Core upgrade or repair a worn one.', why: 'Level 2 and 3 unlock the Q and E techniques.', focus: ['station'], kinds: ['core.upgrade.start', 'core.repair'], vi: { title: 'Nâng cấp hoặc sửa Core', how: 'Tại Workbench: bắt đầu nâng cấp Core hoặc sửa Core đã mòn.', why: 'Cấp 2 và 3 mở khóa chiêu Q và E.' },
      count: rc => rc.kind === 'core.upgrade.start' || rc.kind === 'core.repair' ? 1 : 0 },
  ] },
  { id: 'ragnarok', title: 'The Last 72 Hours', motto: 'Nobody is coming. Decide how it ends.', icon: 'rcash', tier: 3, needs: ['omen'],
    vi: { title: '72 giờ cuối', motto: 'Không ai đến cứu. Hãy tự chọn kết cục.' },
    reward: [['medkit', 4], ['fuel_can', 2], ['energy_refined', 8], ['canned_meat', 4]],
    opens: { en: 'Supplies for the last three days, whichever ending you choose.', vi: 'Tiếp tế cho ba ngày cuối, dù bạn chọn kết cục nào.' },
    steps: [
    { id: 'omen', title: 'Live to see Ragnarok', target: 1, icon: 'coal', how: 'Stay alive until the final 72 hours begin. The handbook cache opens the moment they do.', why: 'Sealed vaults open and the Elders stir. Everything you built is now tested.', offlineOk: true, kinds: ['achievement'], vi: { title: 'Sống tới Ragnarok', how: 'Sống sót tới khi 72 giờ cuối bắt đầu. Kiện tiếp tế của sổ tay mở ra đúng lúc đó.', why: 'Hầm kín mở ra và các Elder trỗi dậy. Mọi thứ bạn xây giờ bị thử thách.' },
      count: ach('ragnarok') },
    { id: 'secure', title: 'Secure coins to your profile', target: 1, icon: 'rcash', how: 'Buy an Escrow Chest from a trader with Ragnarok Cash, place it and deposit cash.', why: 'Secured coins survive death and the end of the run.', kinds: ['escrow.deposit', 'achievement'], vi: { title: 'Cất tiền vào hồ sơ', how: 'Mua Escrow Chest của thương nhân bằng Ragnarok Cash, đặt xuống rồi gửi tiền vào.', why: 'Tiền đã cất sẽ còn lại sau khi chết và sau khi lượt chơi kết thúc.' },
      count: rc => rc.kind === 'escrow.deposit' || (rc.kind === 'achievement' && rc.detail === 'first_deposit') ? 1 : 0 },
    { id: 'ending', title: 'Choose your ending', target: 1, icon: 'fuel_can', how: 'Any one: board the evacuation vessel at the Beacon, or stand your ground and bring down an Elder.', why: 'Leaving and holding are both victories. Who you bring with you is the real score.', kinds: ['evac.board', 'elder.defeat', 'achievement'], vi: { title: 'Chọn kết cục của bạn', how: 'Chọn một cách: lên tàu sơ tán ở Beacon, hoặc trụ lại và hạ một Elder.', why: 'Rời đi hay trụ lại đều là chiến thắng. Bạn đưa được ai theo mới là điểm số thật.' },
      count: rc => rc.kind === 'evac.board' || rc.kind === 'elder.defeat' || (rc.kind === 'achievement' && (rc.detail === 'evacuated' || rc.detail === 'elder_1')) ? 1 : 0 },
  ] },
];
export const FIELDCRAFT_BY_ID = Object.fromEntries(FIELDCRAFT.map(l => [l.id, l])) as Record<string, FieldLesson>;

export const TIER_LABEL: Record<RewardTier, L> = {
  1: { en: 'Starter kit', vi: 'Gói khởi đầu' },
  2: { en: 'Field cache', vi: 'Kiện tiếp tế' },
  3: { en: 'Rare cache', vi: 'Kho hiếm' },
};
/** Wayfarer Marks granted the first time a chapter is mastered on this profile (no economic value). */
export const TIER_MARKS: Record<RewardTier, number> = { 1: 1, 2: 2, 3: 3 };

export const lessonText = (l: FieldLesson, lang: Lang) => (lang === 'vi' ? l.vi : { title: l.title, motto: l.motto });
export const stepText = (s: FieldStep, lang: Lang) => (lang === 'vi' ? s.vi : { title: s.title, how: s.how, why: s.why });
export const rewardLabel = (l: FieldLesson) => l.reward.map(([k, q]) => `${q}× ${ITEMS[k]?.name ?? k}`).join(' · ');
export const stepKey = (lessonId: string, stepId: string) => `${lessonId}.${stepId}`;

// ---------------------------------------------------------------------------
// AUTHORITATIVE LEDGER (r.handbook)
// ---------------------------------------------------------------------------
interface Indexed { key: string; step: FieldStep }
const BY_KIND = new Map<string, Indexed[]>();
for (const l of FIELDCRAFT) for (const st of l.steps) for (const k of st.kinds) {
  const list = BY_KIND.get(k) ?? []; list.push({ key: stepKey(l.id, st.id), step: st }); BY_KIND.set(k, list);
}

let offlineDepth = 0;
export function beginHandbookOffline(): void { offlineDepth++; }
export function endHandbookOffline(): void { offlineDepth = Math.max(0, offlineDepth - 1); }
/** While a resident (not the player) is the author of a shared receipt kind such as `creature.kill`,
 * neither the handbook nor the Daily Waypoints may credit it to the player. */
let npcDepth = 0;
export function beginNpcReceipt(): void { npcDepth++; }
export function endNpcReceipt(): void { npcDepth = Math.max(0, npcDepth - 1); }
export const isNpcReceipt = (): boolean => npcDepth > 0;

const emptyLedger = (): HandbookLedger => ({ v: 1, lastSeq: 0, steps: {}, done: [], claimed: [] });

function credit(hb: HandbookLedger, key: string, step: FieldStep, inc: number) {
  if (inc <= 0 || hb.done.includes(key)) return;
  const n = Math.min(step.target, (hb.steps[key] ?? 0) + inc);
  hb.steps[key] = n;
  if (n >= step.target) hb.done.push(key);
}

/** Older saves have no ledger. What the run still proves is restored once: achievements and discovered
 * places are durable run state; surviving receipts are folded by the normal path (lastSeq starts at 0). */
function bootstrapLegacy(r: RunState, hb: HandbookLedger) {
  for (const key of r.achievements ?? []) {
    for (const ix of BY_KIND.get('achievement') ?? []) credit(hb, ix.key, ix.step, ix.step.count({ id: 'boot', seq: 0, at: r.startedAt, kind: 'achievement', detail: key } as Receipt, r));
  }
  for (const id of r.poiSeen ?? []) {
    for (const ix of BY_KIND.get('poi.discover') ?? []) credit(hb, ix.key, ix.step, ix.step.count({ id: 'boot', seq: 0, at: r.startedAt, kind: 'poi.discover', detail: id } as Receipt, r));
  }
}

export function ensureHandbook(r: RunState): HandbookLedger {
  if (!r.handbook || r.handbook.v !== 1) {
    const hb = emptyLedger();
    r.handbook = hb;
    if (r.seq > 0 && !r.receipts.some(rc => rc.kind === 'run.start')) bootstrapLegacy(r, hb);
  }
  return r.handbook;
}

function fold(r: RunState, hb: HandbookLedger, rc: Receipt, offline: boolean) {
  if (!rc || !Number.isFinite(rc.seq) || rc.seq <= hb.lastSeq) return;
  hb.lastSeq = rc.seq;
  if (npcDepth > 0) return;
  const list = BY_KIND.get(rc.kind);
  if (!list) return;
  for (const { key, step } of list) {
    if (hb.done.includes(key)) continue;
    if (offline && !step.offlineOk) continue;
    credit(hb, key, step, step.count(rc, r));
  }
}

/** Called from `engine.ts:receipt()` for every committed receipt, before the ring buffer can evict it. */
export function recordHandbookReceipt(r: RunState, rc: Receipt): void {
  const hb = ensureHandbook(r);
  if (hb.lastSeq < rc.seq - 1) for (const prev of r.receipts as Receipt[]) if (prev.seq > hb.lastSeq && prev.seq < rc.seq) fold(r, hb, prev, false);
  fold(r, hb, rc, offlineDepth > 0);
}

/** Fold any surviving receipt the ledger has not seen yet (legacy saves, receipts appended outside `receipt()`). */
export function syncHandbook(r: RunState): HandbookLedger {
  const hb = ensureHandbook(r);
  const last = (r.receipts as Receipt[]).at(-1);
  if (last && last.seq > hb.lastSeq) for (const rc of r.receipts as Receipt[]) if (rc.seq > hb.lastSeq) fold(r, hb, rc, false);
  return hb;
}

export interface ChapterView {
  id: string;
  /** step id -> progress */
  steps: Record<string, number>;
  /** step ids done */
  done: string[];
  complete: boolean;
  /** the steps the reward needs are done and the bundle has not been issued */
  claimable: boolean;
  claimed: boolean;
}
export function chapterView(r: RunState | null, l: FieldLesson): ChapterView {
  const hb = r?.handbook;
  const steps: Record<string, number> = {}; const done: string[] = [];
  for (const st of l.steps) {
    const key = stepKey(l.id, st.id);
    const n = hb?.steps[key] ?? 0; if (n) steps[st.id] = n;
    if (hb?.done.includes(key)) done.push(st.id);
  }
  const claimed = !!hb?.claimed.includes(l.id);
  const needs = l.needs ?? l.steps.map(s => s.id);
  return { id: l.id, steps, done, complete: l.steps.every(s => done.includes(s.id)), claimed, claimable: !claimed && needs.every(id => done.includes(id)) };
}
/** Engine-side claim check (authoritative). */
export function handbookClaimable(r: RunState, lessonId: string): { ok: true; lesson: FieldLesson } | { ok: false; reason: string } {
  const l = FIELDCRAFT_BY_ID[lessonId];
  if (!l || !Object.prototype.hasOwnProperty.call(FIELDCRAFT_BY_ID, lessonId)) return { ok: false, reason: 'Unknown handbook chapter.' };
  syncHandbook(r);
  const v = chapterView(r, l);
  if (v.claimed) return { ok: false, reason: 'This chapter\'s supplies were already issued in this run.' };
  if (!v.claimable) return { ok: false, reason: 'Finish the chapter\'s steps first.' };
  return { ok: true, lesson: l };
}
void BAL;

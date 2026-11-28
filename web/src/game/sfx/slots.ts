// ============================================================================
// SOUL OF HERO — SFX slot catalogue.
//
// One row per sound the game can make. A slot is a named, empty place that one
// or more audio files can be put into (public/sfx/<group>/<slot id>__NN.ext).
// While a slot has no file the game plays the old synthesized cue named in
// `synth` (if any), or stays silent. Nothing here reads or writes game state.
//
// This file has no imports on purpose: Node reads it directly (scripts/sfx.mjs)
// to print the hand-over tables and to sort delivered files into slots.
// ============================================================================

export type SfxBus = 'ui' | 'world' | 'combat' | 'ambience';
/** shot: plays once. loop: repeats while something in the world is running. bed: background layer that fades with the place and the weather. */
export type SfxMode = 'shot' | 'loop' | 'bed';
/** Where the trigger comes from: fx = an effect the simulation already reports; receipt = an action the engine already recorded;
 *  ui = a button or panel; watch = a change the screen notices once a second (weather, time, health); loop = something that keeps running. */
export type SfxSource = 'fx' | 'receipt' | 'ui' | 'watch' | 'loop';

export interface SfxSlot {
  id: string;
  group: string;
  bus: SfxBus;
  mode: SfxMode;
  source: SfxSource;
  /** 1 = the game feels empty without it. 2 = clearly better with it. 3 = polish. */
  prio: 1 | 2 | 3;
  /** How many different takes to supply so repeats do not sound mechanical. */
  n: number;
  /** Recommended length of one take. */
  len: string;
  /** Base loudness 0..1 before the player's volume sliders. */
  vol: number;
  /** Random speed change per play, as a fraction (0.06 = up to 6 % faster or slower). */
  pitch: number;
  /** Shortest time between two plays of this slot, in milliseconds. */
  cd: number;
  /** Most copies of this slot that may sound at once. */
  voices: number;
  /** True: louder when near the middle of the screen, panned left or right by position. */
  spatial: boolean;
  /** Distance in world pixels at which a spatial sound stops being audible. */
  range: number;
  /** Old synthesized cue played while the slot has no file. */
  synth?: string;
  /** Slot whose files are used while this one has none. */
  borrow?: string;
  /** When it plays (Vietnamese, for the hand-over table). */
  when: string;
  /** What it should sound like (Vietnamese). */
  sound: string;
  /** Words looked for in delivered file names. */
  kw: string[];
}

type Opt = Partial<Pick<SfxSlot, 'bus' | 'mode' | 'vol' | 'pitch' | 'cd' | 'voices' | 'spatial' | 'range' | 'synth' | 'borrow'>> & { kw?: string[] };

export const SFX_GROUPS: Record<string, { title: string; bus: SfxBus; spatial: boolean }> = {
  ui: { title: 'Giao diện', bus: 'ui', spatial: false },
  item: { title: 'Cầm, nhặt, xếp đồ', bus: 'ui', spatial: false },
  prog: { title: 'Tiến trình, phần thưởng, biểu ngữ', bus: 'ui', spatial: false },
  step: { title: 'Bước chân', bus: 'world', spatial: true },
  player: { title: 'Cơ thể nhân vật', bus: 'world', spatial: false },
  warn: { title: 'Cảnh báo sinh tồn', bus: 'world', spatial: false },
  swing: { title: 'Vung vũ khí, cung tên', bus: 'combat', spatial: true },
  hit: { title: 'Va chạm khi đánh', bus: 'combat', spatial: true },
  gather: { title: 'Khai thác', bus: 'world', spatial: true },
  cr: { title: 'Sinh vật', bus: 'combat', spatial: true },
  elder: { title: 'Elder và trùm phụ', bus: 'combat', spatial: true },
  haz: { title: 'Đòn diện rộng của trùm', bus: 'combat', spatial: true },
  core: { title: 'Creator Core (phép)', bus: 'combat', spatial: true },
  fire: { title: 'Lửa, nổ, sét', bus: 'combat', spatial: true },
  build: { title: 'Xây dựng và công trình', bus: 'world', spatial: true },
  door: { title: 'Cửa', bus: 'world', spatial: true },
  box: { title: 'Rương, thùng, đồ tiếp tế', bus: 'world', spatial: false },
  station: { title: 'Trạm chế tạo, điện, bẫy', bus: 'world', spatial: true },
  farm: { title: 'Vườn, nước, vật nuôi, nghỉ ngơi', bus: 'world', spatial: false },
  ride: { title: 'Xe kéo, xe máy, tàu sơ tán', bus: 'world', spatial: false },
  npc: { title: 'Người trên đảo', bus: 'world', spatial: false },
  amb: { title: 'Điểm xuyết môi trường (ngẫu nhiên)', bus: 'ambience', spatial: true },
  bed: { title: 'Nền môi trường (lặp)', bus: 'ambience', spatial: false },
  loop: { title: 'Tiếng chạy liên tục (lặp)', bus: 'world', spatial: true },
};

const rows: SfxSlot[] = [];
function s(id: string, source: SfxSource, prio: 1 | 2 | 3, n: number, len: string, o: Opt, when: string, sound: string) {
  const group = id.slice(0, id.indexOf('.'));
  const g = SFX_GROUPS[group];
  if (!g) throw new Error(`sfx slot ${id}: unknown group`);
  const mode = o.mode ?? (group === 'bed' ? 'bed' : group === 'loop' ? 'loop' : 'shot');
  rows.push({
    id, group, source, prio, n, len, when, sound, mode,
    bus: o.bus ?? g.bus,
    vol: o.vol ?? (mode === 'shot' ? 0.8 : 0.6),
    pitch: o.pitch ?? (mode === 'shot' ? 0.05 : 0),
    cd: o.cd ?? (mode === 'shot' ? 60 : 0),
    voices: o.voices ?? (mode === 'shot' ? 3 : 1),
    spatial: o.spatial ?? g.spatial,
    range: o.range ?? 460,
    synth: o.synth, borrow: o.borrow,
    kw: o.kw ?? [],
  });
}

// ---------------------------------------------------------------------------
// GIAO DIỆN
// ---------------------------------------------------------------------------
s('ui.click', 'ui', 1, 2, '30–80 ms', { synth: 'ui', cd: 40, vol: 0.55, kw: ['click', 'tap', 'button', 'select'] },
  'Bấm nút, chọn mục, mọi thao tác thành công không có tiếng riêng.', 'Tiếng tách khô, ngắn, không ngân. Nghe hàng trăm lần mà không mệt.');
s('ui.back', 'ui', 1, 1, '40–100 ms', { synth: 'uiBack', cd: 40, vol: 0.5, kw: ['back', 'cancel', 'close'] },
  'Đóng bảng, hủy đặt công trình, hủy niệm Core.', 'Giống ui.click nhưng trầm hơn và đi xuống.');
s('ui.tab', 'ui', 2, 1, '30–80 ms', { borrow: 'ui.click', cd: 40, vol: 0.5, kw: ['tab', 'switch', 'page'] },
  'Đổi thẻ trong bảng, đổi trang thanh xây.', 'Tách nhẹ, hơi cao hơn ui.click.');
s('ui.panel.open', 'ui', 1, 2, '120–250 ms', { synth: 'ui', cd: 80, vol: 0.6, kw: ['open', 'panel', 'menu', 'bag', 'inventory'] },
  'Mở ba lô, chế tạo, kỹ năng, bảng người, menu.', 'Tiếng mở túi vải hoặc khóa da; mềm, có chất liệu.');
s('ui.panel.close', 'ui', 1, 2, '100–200 ms', { synth: 'uiBack', cd: 80, vol: 0.55, kw: ['close', 'panel', 'menu', 'bag'] },
  'Đóng các bảng trên.', 'Ngược của ui.panel.open, ngắn hơn.');
s('ui.map.open', 'ui', 2, 2, '200–400 ms', { borrow: 'ui.panel.open', cd: 120, kw: ['map', 'paper', 'unfold', 'parchment'] },
  'Mở bản đồ (M).', 'Giấy da mở ra, sột soạt.');
s('ui.map.close', 'ui', 3, 1, '150–300 ms', { borrow: 'ui.panel.close', cd: 120, kw: ['map', 'paper', 'fold'] },
  'Đóng bản đồ.', 'Giấy gấp lại.');
s('ui.book.open', 'ui', 2, 2, '200–400 ms', { borrow: 'ui.panel.open', cd: 120, kw: ['book', 'page', 'journal', 'flip'] },
  'Mở Hành trình (J), Ghi chép (N), sổ tay, bảng nghiên cứu.', 'Mở sổ, lật trang.');
s('ui.build.enter', 'ui', 2, 1, '150–300 ms', { synth: 'ui', cd: 120, kw: ['build', 'blueprint', 'tool', 'hammer'] },
  'Vào chế độ xây (B).', 'Rút búa hoặc trải bản vẽ.');
s('ui.build.exit', 'ui', 3, 1, '100–200 ms', { borrow: 'ui.back', cd: 120, kw: ['build', 'exit', 'holster'] },
  'Thoát chế độ xây.', 'Cất dụng cụ.');
s('ui.hotbar', 'ui', 1, 2, '60–150 ms', { synth: 'ui', cd: 50, vol: 0.5, kw: ['equip', 'hotbar', 'holster', 'draw', 'switch'] },
  'Đổi món đang cầm (phím 1–8, lăn chuột).', 'Tiếng rút hoặc đổi tay cầm, rất ngắn.');
s('ui.deny', 'ui', 1, 1, '120–250 ms', { synth: 'deny', cd: 120, vol: 0.6, kw: ['deny', 'error', 'wrong', 'fail', 'negative'] },
  'Hành động bị từ chối: thiếu nguyên liệu, quá xa, sai công cụ.', 'Hai nốt trầm đi xuống, không chói.');
s('ui.coin', 'ui', 1, 3, '150–350 ms', { synth: 'coin', cd: 80, kw: ['coin', 'cash', 'money', 'gold'] },
  'Cất tiền Ragnarok vào két, mở túi tiền, nhận tiền.', 'Xu kim loại chạm nhau, sáng.');
s('ui.buy', 'ui', 2, 2, '200–400 ms', { borrow: 'ui.coin', cd: 120, kw: ['buy', 'purchase', 'register', 'shop'] },
  'Mua ở thương nhân, trả phí vận chuyển.', 'Xu rơi vào tay người bán, kèm một tiếng chốt.');
s('ui.pin', 'ui', 3, 1, '60–150 ms', { synth: 'jtick', cd: 60, kw: ['pin', 'mark', 'stamp'] },
  'Cắm hoặc gỡ ghim trên bản đồ, theo dõi một mục tiêu.', 'Ghim cắm vào giấy.');
s('ui.title.start', 'ui', 2, 1, '0.6–1.5 s', { synth: 'jmilestone', cd: 500, vol: 0.7, kw: ['start', 'begin', 'confirm', 'title'] },
  'Xác nhận Ván mới hoặc Chơi tiếp ở màn hình chính.', 'Một tiếng trống trầm hoặc tù và ngắn, báo bắt đầu.');

// ---------------------------------------------------------------------------
// CẦM, NHẶT, XẾP ĐỒ — theo chất liệu của món đồ
// ---------------------------------------------------------------------------
s('item.pickup', 'fx', 1, 3, '80–200 ms', { synth: 'pickup', cd: 70, vol: 0.6, kw: ['pickup', 'collect', 'grab', 'take'] },
  'Nhặt đồ dưới đất (E) hoặc khi khai thác rơi ra.', 'Tiếng chộp nhanh, hơi sáng; không phải chuông.');
s('item.move', 'receipt', 1, 3, '60–160 ms', { synth: 'ui', cd: 50, vol: 0.5, kw: ['drop', 'place', 'put', 'item', 'move'] },
  'Chuyển đồ giữa các ô và các thùng, khi không có tiếng theo chất liệu.', 'Đặt một vật xuống mặt gỗ.');
for (const [cls, title, sound, kw] of [
  ['metal', 'kim loại (thỏi, linh kiện, vũ khí sắt)', 'Kim loại chạm nhau, ngắn.', ['metal', 'clink', 'iron']],
  ['wood', 'gỗ (gỗ, ván, cán)', 'Khúc gỗ gõ vào nhau.', ['wood', 'log', 'plank']],
  ['stone', 'đá, quặng, tinh thể', 'Đá lạo xạo.', ['stone', 'rock', 'gravel', 'ore']],
  ['cloth', 'vải, da, sợi, giáp mềm', 'Vải sột soạt.', ['cloth', 'leather', 'fabric', 'rustle']],
  ['food', 'đồ ăn, thảo mộc', 'Túi mềm, giấy gói.', ['food', 'herb', 'soft', 'pouch']],
  ['liquid', 'bình nước, can nhiên liệu, lọ', 'Chất lỏng óc ách trong bình.', ['bottle', 'liquid', 'slosh', 'flask', 'can']],
  ['core', 'Core, năng lượng, tinh chất', 'Tinh thể ngân nhẹ, có hơi phép.', ['crystal', 'magic', 'gem', 'shimmer']],
] as const) {
  s(`item.${cls}`, 'receipt', 3, 2, '60–200 ms', { borrow: 'item.move', cd: 50, vol: 0.5, kw: [...kw] },
    `Nhặt hoặc chuyển món thuộc nhóm ${title}.`, sound);
}
s('item.drop', 'receipt', 2, 2, '100–250 ms', { borrow: 'item.move', cd: 80, kw: ['drop', 'thud', 'ground'] },
  'Vứt đồ ra đất.', 'Vật rơi xuống đất mềm.');
s('item.equip', 'receipt', 2, 2, '200–400 ms', { borrow: 'ui.panel.open', cd: 120, kw: ['equip', 'armor', 'wear', 'cloth', 'belt', 'buckle'] },
  'Mặc giáp, đội mũ, đeo ba lô.', 'Kéo dây da, cài khóa.');
s('item.sort', 'receipt', 3, 1, '200–400 ms', { borrow: 'item.move', cd: 200, kw: ['sort', 'shuffle', 'rummage'] },
  'Sắp xếp thùng, tách chồng đồ.', 'Lục và xếp lại nhiều món.');
s('item.repair', 'receipt', 2, 2, '0.4–0.9 s', { synth: 'craft', cd: 200, kw: ['repair', 'fix', 'hammer', 'anvil'] },
  'Sửa dụng cụ, vũ khí, Core tại trạm.', 'Vài nhát búa nhỏ lên kim loại.');

// ---------------------------------------------------------------------------
// TIẾN TRÌNH, PHẦN THƯỞNG, BIỂU NGỮ — mỗi bậc nghe lớn hơn bậc trước
// ---------------------------------------------------------------------------
s('prog.tick', 'ui', 2, 1, '20–60 ms', { synth: 'jtick', cd: 60, vol: 0.4, kw: ['tick', 'blip'] },
  'Một mục tiêu nhỏ nhích tiến độ.', 'Một tiếng tíc nhỏ, gần như không để ý.');
s('prog.stamp', 'ui', 1, 1, '0.3–0.6 s', { synth: 'jstamp', cd: 300, kw: ['stamp', 'complete', 'check', 'quest'] },
  'Hoàn thành một mục trong Hành trình.', 'Con dấu đóng xuống giấy, rồi hai nốt sáng.');
s('prog.milestone', 'ui', 1, 1, '0.8–1.5 s', { synth: 'jmilestone', cd: 600, kw: ['milestone', 'reward', 'success', 'fanfare'] },
  'Cột mốc hoặc phần thưởng; nhận thưởng sổ tay.', 'Hợp âm chuông ấm, ngân khoảng một giây.');
s('prog.capability', 'ui', 1, 1, '0.5–1 s', { synth: 'jcapability', cd: 600, kw: ['unlock', 'capability', 'new', 'ability'] },
  'Mở được một khả năng mới (công trình, trạm đầu tiên).', 'Ba nốt đi lên dứt khoát, có nền trầm.');
s('prog.relic', 'ui', 1, 1, '1.2–2 s', { synth: 'jrelic', cd: 1000, kw: ['relic', 'artifact', 'legendary', 'mystic'] },
  'Lần đầu cầm một Creator Core.', 'Ngân dài, huyền bí, có ánh lấp lánh ở cuối.');
s('prog.epic', 'ui', 1, 1, '2–3 s', { synth: 'jepic', cd: 2000, vol: 0.9, kw: ['epic', 'victory', 'boss', 'triumph'] },
  'Cảnh lớn: hạ Elder, Ragnarok bắt đầu, các Elder thức giấc.', 'Trống trầm rồi kèn mở dần; tiếng lớn nhất của game.');
s('prog.rare', 'ui', 2, 1, '0.8–1.2 s', { synth: 'rare', cd: 800, kw: ['rare', 'treasure', 'sparkle', 'loot'] },
  'Mở rương ra Core hoặc đồ hiếm.', 'Ba nốt sáng và một vệt lấp lánh.');
s('prog.recipe', 'receipt', 2, 1, '0.5–1 s', { synth: 'fieldcraft', cd: 500, kw: ['learn', 'recipe', 'blueprint', 'scroll'] },
  'Học một bản thiết kế, nghiên cứu xong một nhánh.', 'Lật trang rồi hai nốt mở.');
s('prog.research', 'receipt', 2, 2, '0.4–0.8 s', { borrow: 'ui.book.open', cd: 300, kw: ['research', 'study', 'write', 'quill'] },
  'Bắt đầu nghiên cứu, mổ mẫu vật.', 'Bút viết trên giấy, dụng cụ gõ nhẹ.');
s('prog.achievement', 'receipt', 2, 1, '0.8–1.5 s', { synth: 'capability', cd: 800, kw: ['achievement', 'trophy', 'medal'] },
  'Đạt một thành tích.', 'Chuông ngắn có độ vang.');
s('prog.discover', 'fx', 1, 1, '1–1.6 s', { synth: 'discover', cd: 800, kw: ['discover', 'reveal', 'explore', 'found'] },
  'Khám phá một địa điểm mới (hiện biểu ngữ "Discovered").', 'Bốn nốt đi lên, cảm giác mở ra.');
s('prog.region', 'fx', 2, 1, '0.8–1.5 s', { cd: 2500, vol: 0.5, kw: ['region', 'area', 'enter', 'zone', 'swell'] },
  'Bước sang một vùng khác (hiện tên vùng).', 'Một tiếng đệm nhẹ, gần như hơi thở; không được lấn át.');
s('prog.banner', 'fx', 1, 1, '1–1.6 s', { synth: 'banner', cd: 800, kw: ['banner', 'gong', 'announce'] },
  'Biểu ngữ lớn không có tiếng riêng (tên Elder lần đầu chạm trán).', 'Hai nốt trầm như cồng.');
s('prog.day14', 'fx', 1, 1, '2–3 s', { borrow: 'prog.banner', cd: 3000, vol: 0.9, kw: ['horn', 'awaken', 'doom', 'warhorn'] },
  'Ngày 14: sáu Elder thức giấc.', 'Tù và xa, trầm, kéo dài.');
s('prog.ragnarok', 'fx', 1, 1, '2–4 s', { borrow: 'prog.banner', cd: 3000, vol: 0.95, kw: ['ragnarok', 'apocalypse', 'rumble', 'quake'] },
  '72 giờ cuối bắt đầu.', 'Mặt đất gầm, một hợp âm tối.');
s('prog.runend', 'fx', 2, 1, '2–4 s', { borrow: 'prog.banner', cd: 3000, kw: ['end', 'gameover', 'collapse'] },
  'Ván kết thúc vì Ragnarok.', 'Một tiếng sập xuống rồi im.');
s('prog.season', 'receipt', 3, 1, '1–2 s', { cd: 3000, vol: 0.5, kw: ['season', 'chime', 'wind'] },
  'Sang mùa mới.', 'Chuông gió nhẹ.');

// ---------------------------------------------------------------------------
// BƯỚC CHÂN — theo mặt đất dưới chân; nhịp tối đa khoảng 4 bước mỗi giây
// ---------------------------------------------------------------------------
const STEP: [string, 1 | 2 | 3, string, string, string[], string?][] = [
  ['grass', 1, 'cỏ, đồng cỏ, đất thường', 'Cỏ khô và đất mềm.', ['grass', 'dirt'], undefined],
  ['forest', 2, 'nền rừng', 'Lá khô, cành nhỏ gãy.', ['forest', 'leaves', 'leaf', 'twig'], 'step.grass'],
  ['sand', 1, 'cát', 'Cát lún, sột soạt.', ['sand', 'beach'], 'step.grass'],
  ['snow', 1, 'tuyết', 'Tuyết nén kêu rộp.', ['snow'], 'step.grass'],
  ['ice', 3, 'băng', 'Giày gõ lên băng cứng.', ['ice'], 'step.stone'],
  ['mud', 2, 'đầm lầy', 'Bùn nhão, nhóp nhép.', ['mud', 'swamp', 'marsh', 'squelch'], 'step.water'],
  ['water', 1, 'nước nông, sông', 'Lội nước tới mắt cá.', ['water', 'wade', 'splash'], undefined],
  ['road', 2, 'đường mòn', 'Sỏi và đất nện.', ['gravel', 'road', 'path'], 'step.grass'],
  ['wood', 1, 'cầu, sàn gỗ tự xây', 'Ván gỗ rỗng bên dưới.', ['wood', 'plank', 'floor'], undefined],
  ['stone', 1, 'sàn nhà phế tích, sàn đá, đồi đá', 'Đế giày trên đá hoặc bê tông.', ['stone', 'concrete', 'rock'], undefined],
  ['ash', 2, 'tro, đất cháy, đất độc', 'Tro mịn, khô, hơi lạo xạo.', ['ash', 'cinder', 'dust'], 'step.sand'],
  ['metal', 3, 'thang thép', 'Đế giày trên lưới thép.', ['metal', 'grate', 'ladder'], 'step.stone'],
];
for (const [k, prio, where, sound, kw, borrow] of STEP) {
  s(`step.${k}`, 'fx', prio, 5, '80–180 ms', { synth: 'step', borrow, cd: 240, vol: 0.45, pitch: 0.08, voices: 2, kw: ['footstep', 'step', ...kw] },
    `Nhân vật đi trên ${where}.`, sound);
}

// ---------------------------------------------------------------------------
// CƠ THỂ NHÂN VẬT
// ---------------------------------------------------------------------------
s('player.roll', 'fx', 1, 3, '200–350 ms', { synth: 'roll', cd: 150, spatial: true, kw: ['roll', 'tumble', 'dash', 'cloth'] },
  'Lăn né (Space).', 'Thân người lăn trên đất, vải quệt.');
s('player.dodge', 'fx', 2, 2, '100–200 ms', { synth: 'dodge', cd: 150, spatial: true, kw: ['dodge', 'evade', 'swish', 'whiff'] },
  'Né trúng lúc: đòn đi xuyên qua khi đang lăn.', 'Một vệt gió sắc, cho biết đã né kịp.');
s('player.hurt', 'fx', 1, 4, '150–300 ms', { bus: 'combat', synth: 'phit', cd: 120, vol: 0.9, kw: ['hurt', 'player_hit', 'damage', 'punch'] },
  'Nhân vật trúng đòn.', 'Cú đập đục vào người, có chút trầm; phải nghe rõ giữa lúc hỗn chiến.');
s('player.grunt.m', 'fx', 3, 4, '150–400 ms', { bus: 'combat', cd: 500, vol: 0.6, pitch: 0.04, kw: ['male', 'grunt', 'pain', 'man'] },
  'Nhân vật nam trúng đòn (một nửa số lần).', 'Tiếng hự ngắn của nam.');
s('player.grunt.f', 'fx', 3, 4, '150–400 ms', { bus: 'combat', cd: 500, vol: 0.6, pitch: 0.04, kw: ['female', 'grunt', 'pain', 'woman'] },
  'Nhân vật nữ trúng đòn (một nửa số lần).', 'Tiếng hự ngắn của nữ.');
s('player.fall', 'fx', 1, 1, '0.5–1 s', { bus: 'combat', cd: 1000, kw: ['bodyfall', 'collapse', 'fall'] },
  'Nhân vật gục xuống.', 'Thân người đổ xuống đất.');
s('player.death', 'watch', 1, 1, '1.5–2.5 s', { bus: 'ui', synth: 'death', cd: 2000, vol: 0.9, kw: ['death', 'die', 'gameover', 'defeat'] },
  'Màn tử trận hiện ra.', 'Một nốt trầm rơi xuống rồi tắt dần.');
s('player.respawn', 'receipt', 2, 1, '0.8–1.5 s', { bus: 'ui', cd: 1000, kw: ['respawn', 'revive', 'wake', 'breath'] },
  'Hồi sinh.', 'Hít một hơi sâu, nền sáng dần.');
s('player.eat', 'receipt', 1, 3, '300–600 ms', { synth: 'eat', cd: 200, kw: ['eat', 'chew', 'bite', 'munch'] },
  'Ăn một món.', 'Cắn và nhai, hai ba nhịp.');
s('player.drink', 'receipt', 1, 3, '300–700 ms', { synth: 'eat', cd: 200, kw: ['drink', 'gulp', 'sip', 'swallow'] },
  'Uống ở sông, từ bình, từ thùng nước.', 'Hai ngụm nước.');
s('player.heal', 'receipt', 1, 2, '400–800 ms', { borrow: 'item.cloth', cd: 300, kw: ['bandage', 'heal', 'medkit', 'wrap'] },
  'Dùng băng, thuốc, bộ sơ cứu.', 'Xé và quấn băng vải.');

// ---------------------------------------------------------------------------
// CẢNH BÁO SINH TỒN — đúng các ngưỡng mà HUD báo
// ---------------------------------------------------------------------------
s('warn.hp', 'watch', 1, 1, '0.4–0.8 s', { cd: 8000, kw: ['gasp', 'lowhealth', 'danger', 'breath'] },
  'Máu tụt xuống dưới 28.', 'Một tiếng thở gấp.');
s('warn.hunger', 'watch', 2, 2, '0.6–1.2 s', { cd: 60000, vol: 0.6, kw: ['stomach', 'hunger', 'growl'] },
  'Đói xuống dưới 18; nhắc lại mỗi phút khi còn đói.', 'Bụng sôi.');
s('warn.thirst', 'watch', 2, 2, '0.5–1 s', { cd: 60000, vol: 0.6, kw: ['thirst', 'dry', 'cough', 'throat'] },
  'Khát xuống dưới 18; nhắc lại mỗi phút.', 'Ho khan, nuốt khô.');
s('warn.cold', 'watch', 2, 2, '0.6–1.2 s', { cd: 45000, vol: 0.6, kw: ['shiver', 'cold', 'teeth', 'freeze'] },
  'Thân nhiệt xuống dưới 20; nhắc lại mỗi 45 giây.', 'Run cầm cập, hà hơi.');
s('warn.stamina', 'watch', 2, 2, '0.5–1 s', { cd: 6000, vol: 0.55, kw: ['pant', 'exhausted', 'tired', 'breath'] },
  'Thể lực cạn (dưới 8).', 'Thở dốc.');
s('warn.rad', 'watch', 2, 1, '0.5–1 s', { cd: 20000, vol: 0.6, kw: ['geiger', 'radiation', 'toxic', 'alarm'] },
  'Phóng xạ lên tới 25.', 'Máy đo kêu lách tách dồn dập.');
s('warn.lowfuel', 'watch', 2, 1, '0.3–0.6 s', { bus: 'ui', synth: 'lowFuel', cd: 30000, kw: ['fuel', 'low', 'beep', 'sputter'] },
  'Bình xăng xe máy còn dưới 15 %.', 'Hai tiếng bíp đi xuống, hoặc máy khục khặc.');

// ---------------------------------------------------------------------------
// VUNG VŨ KHÍ, CUNG TÊN — phát đúng lúc lưỡi tới mục tiêu
// ---------------------------------------------------------------------------
s('swing.start', 'fx', 3, 2, '80–150 ms', { synth: 'whoosh', cd: 120, vol: 0.4, kw: ['effort', 'windup', 'cloth'] },
  'Bắt đầu vung (trước khi lưỡi tới).', 'Vải áo và hơi lấy đà, rất khẽ.');
s('swing.heavy', 'fx', 1, 4, '150–300 ms', { cd: 120, pitch: 0.07, kw: ['swing', 'whoosh', 'heavy', 'axe', 'club'] },
  'Vung rìu, cuốc, gậy.', 'Vệt gió dày, trầm.');
s('swing.blade', 'fx', 1, 4, '120–250 ms', { borrow: 'swing.heavy', cd: 120, pitch: 0.07, kw: ['sword', 'blade', 'slash', 'swish', 'knife'] },
  'Vung dao, rựa, kiếm.', 'Vệt gió mảnh, sắc, có ánh kim.');
s('swing.spear', 'fx', 2, 3, '120–250 ms', { borrow: 'swing.blade', cd: 120, pitch: 0.07, kw: ['spear', 'thrust', 'stab', 'lunge'] },
  'Đâm giáo, đinh ba.', 'Một cú xỉa nhanh, gọn.');
s('swing.fist', 'fx', 2, 3, '80–180 ms', { borrow: 'swing.heavy', cd: 120, pitch: 0.08, kw: ['punch', 'fist', 'jab', 'whiff'] },
  'Đấm tay không.', 'Vệt gió ngắn, nhẹ.');
s('swing.torch', 'fx', 3, 3, '150–300 ms', { borrow: 'swing.heavy', cd: 120, kw: ['torch', 'flame', 'fire', 'whoosh'] },
  'Vung đuốc, đèn.', 'Lửa phần phật theo đà vung.');
s('swing.bow.draw', 'fx', 2, 2, '250–450 ms', { cd: 200, vol: 0.6, kw: ['bow', 'draw', 'stretch', 'pull'] },
  'Kéo dây cung.', 'Dây và gỗ căng ra.');
s('swing.bow.shot', 'fx', 1, 3, '120–250 ms', { synth: 'bowshot', cd: 100, kw: ['bow', 'arrow', 'release', 'shoot', 'twang'] },
  'Buông tên.', 'Dây bật, tên xé gió.');

// ---------------------------------------------------------------------------
// VA CHẠM KHI ĐÁNH
// ---------------------------------------------------------------------------
s('hit.flesh', 'fx', 1, 5, '100–220 ms', { synth: 'mhit', cd: 45, vol: 0.9, pitch: 0.08, voices: 4, kw: ['hit', 'flesh', 'impact', 'stab', 'slash'] },
  'Đòn trúng sinh vật.', 'Cú chém vào thịt: đục, ướt, dứt khoát. Tiếng quan trọng nhất của chiến đấu.');
s('hit.big', 'fx', 1, 3, '200–400 ms', { borrow: 'hit.flesh', synth: 'mhit', cd: 60, vol: 1, kw: ['heavy', 'impact', 'boss', 'thud'] },
  'Đòn trúng Elder hoặc trùm phụ.', 'Như hit.flesh nhưng nặng hơn, có tiếng trầm của khối lớn.');
s('hit.kill', 'fx', 2, 2, '200–400 ms', { borrow: 'hit.flesh', cd: 100, kw: ['kill', 'finish', 'crunch', 'final'] },
  'Đòn kết liễu một sinh vật.', 'Một cú chốt gãy gọn, nặng hơn đòn thường.');
s('hit.arrow', 'fx', 2, 3, '80–180 ms', { cd: 60, kw: ['arrow', 'stick', 'thunk', 'impact'] },
  'Tên hoặc đạn bị tường, cây chặn lại.', 'Mũi tên cắm vào gỗ.');
s('hit.rock', 'fx', 3, 2, '100–250 ms', { borrow: 'gather.stone', cd: 80, kw: ['rock', 'boulder', 'crack'] },
  'Đá ném vỡ khi chạm vật cản.', 'Đá vỡ vụn.');
s('hit.stun', 'fx', 2, 2, '250–500 ms', { cd: 300, kw: ['stun', 'daze', 'bonk', 'crash'] },
  'Sinh vật lao hụt, đâm vào vật cản và choáng.', 'Va rầm một cái rồi tiếng choáng váng.');

// ---------------------------------------------------------------------------
// KHAI THÁC
// ---------------------------------------------------------------------------
s('gather.wood', 'fx', 1, 5, '100–220 ms', { synth: 'chip', cd: 60, pitch: 0.07, kw: ['chop', 'wood', 'axe', 'tree'] },
  'Mỗi nhát chặt vào cây.', 'Rìu ăn vào gỗ tươi: cộc, chắc.');
s('gather.stone', 'fx', 1, 5, '100–220 ms', { synth: 'chip', cd: 60, pitch: 0.07, kw: ['mine', 'stone', 'rock', 'pick', 'mining'] },
  'Mỗi nhát đập vào đá.', 'Kim loại gõ đá, có mảnh văng.');
s('gather.ore', 'fx', 2, 4, '100–250 ms', { borrow: 'gather.stone', synth: 'chip', cd: 60, pitch: 0.07, kw: ['ore', 'metal', 'ring', 'crystal'] },
  'Mỗi nhát vào quặng sắt, tinh thể, lưu huỳnh.', 'Như đá nhưng ngân hơn, có ánh kim.');
s('gather.scrap', 'fx', 1, 4, '120–280 ms', { synth: 'chip', cd: 60, pitch: 0.07, kw: ['scrap', 'metal', 'pry', 'junk', 'clang'] },
  'Cạy phế liệu, xác xe, kiện hàng ven đường.', 'Tôn và sắt vụn bị bẩy, loảng xoảng.');
s('gather.plant', 'fx', 1, 4, '80–200 ms', { synth: 'chip', cd: 60, pitch: 0.08, kw: ['bush', 'grass', 'leaves', 'cut', 'rustle'] },
  'Cắt bụi, cỏ, sậy, thảo mộc, nấm.', 'Lá và cành nhỏ bị cắt, xào xạc.');
s('gather.deplete', 'fx', 2, 2, '250–500 ms', { cd: 200, kw: ['break', 'crumble', 'deplete', 'collapse'] },
  'Nhát cuối làm một nguồn cạn hẳn (đá vỡ, bụi trụi).', 'Vỡ rời ra thành mảnh.');
s('gather.fell', 'fx', 1, 3, '0.8–1.5 s', { synth: 'fell', cd: 400, vol: 0.9, range: 700, kw: ['tree', 'fall', 'timber', 'crash'] },
  'Cây đổ.', 'Thân gỗ rắc dài rồi đổ ầm xuống, cành lá quật.');
s('gather.clank', 'fx', 1, 3, '80–180 ms', { synth: 'clank', cd: 120, kw: ['clank', 'bounce', 'ting', 'deflect'] },
  'Sai công cụ, hoặc nguồn đã hết.', 'Dụng cụ nảy ra, tiếng đanh và hụt.');
s('gather.toolbreak', 'fx', 1, 2, '300–600 ms', { synth: 'break', cd: 500, vol: 0.9, spatial: false, kw: ['break', 'snap', 'shatter', 'tool'] },
  'Dụng cụ hoặc vũ khí hỏng hẳn.', 'Cán gãy, lưỡi văng ra.');
s('gather.carcass', 'receipt', 2, 3, '300–700 ms', { cd: 200, spatial: false, kw: ['skin', 'butcher', 'flesh', 'cut', 'gore'] },
  'Xẻ thịt, lột da con mồi; mổ vật nuôi.', 'Dao rạch da ướt.');

// ---------------------------------------------------------------------------
// SINH VẬT — mỗi loài một bộ: báo đòn, kêu đau, chết, kêu vu vơ
// ---------------------------------------------------------------------------
export const CREATURE_FAMILIES: Record<string, { name: string; voice: string; tell: boolean; kw: string[] }> = {
  boar: { name: 'Bristleback Boar', voice: 'lợn rừng: khịt mũi, rống', tell: true, kw: ['boar', 'pig', 'hog'] },
  wolf: { name: 'Greyfang Wolf', voice: 'sói: gầm gừ, sủa ngắn', tell: true, kw: ['wolf', 'dog', 'growl'] },
  toad: { name: 'Mire Toad', voice: 'cóc lớn: ộp trầm', tell: true, kw: ['toad', 'frog', 'croak'] },
  crawler: { name: 'Scrap Crawler', voice: 'máy bò: rè điện, động cơ nhỏ', tell: true, kw: ['robot', 'drone', 'mech', 'servo'] },
  beetle: { name: 'Cinder Beetle', voice: 'bọ lớn: rít, cánh rung', tell: true, kw: ['beetle', 'insect', 'bug', 'chitter'] },
  crab: { name: 'Shore Crab', voice: 'cua: càng gõ lách cách', tell: true, kw: ['crab', 'claw', 'click'] },
  vampire: { name: 'Dusk Stray (3 bậc)', voice: 'ma đêm: rít, thở khàn', tell: true, kw: ['vampire', 'ghoul', 'hiss', 'undead'] },
  orc: { name: 'Orc (3 bậc)', voice: 'orc: gầm, hộc', tell: true, kw: ['orc', 'ogre', 'brute', 'roar'] },
  slime: { name: 'Slime (3 bậc)', voice: 'slime: nhóp nhép, bong bóng', tell: true, kw: ['slime', 'blob', 'goo', 'squish'] },
  fox: { name: 'Fox', voice: 'cáo: ăng ẳng', tell: true, kw: ['fox', 'yip'] },
  deer: { name: 'Deer', voice: 'hươu: kêu khẽ, phì hơi', tell: false, kw: ['deer', 'stag', 'doe'] },
  hare: { name: 'Hare', voice: 'thỏ: chít ngắn', tell: false, kw: ['hare', 'rabbit', 'squeak'] },
  grouse: { name: 'Grouse', voice: 'gà rừng: cục cục, vỗ cánh', tell: false, kw: ['grouse', 'bird', 'chicken', 'cluck', 'flap'] },
  greyback: { name: 'Greyback Shaleheart (trùm phụ)', voice: 'khối đá sống: nghiến đá, gầm trầm', tell: true, kw: ['golem', 'rock', 'stone', 'giant'] },
  ronin: { name: 'Oathless Ronin (trùm phụ)', voice: 'kiếm sĩ: hét ngắn, tuốt kiếm', tell: true, kw: ['samurai', 'ronin', 'kiai', 'warrior'] },
  tidemarshal: { name: 'Saltwick Tidemarshal (trùm phụ)', voice: 'tướng thủy triều: gầm ướt, nước cuộn', tell: true, kw: ['water', 'sea', 'tide', 'gurgle'] },
  custodian: { name: 'Pale Custodian (trùm phụ)', voice: 'người giữ đèn: thì thầm, chuông nhỏ', tell: true, kw: ['ghost', 'maid', 'whisper', 'bell'] },
};
s('cr.tell', 'fx', 1, 2, '100–250 ms', { synth: 'tell', cd: 120, vol: 0.7, kw: ['alert', 'warning', 'exclaim', 'notice'] },
  'Một sinh vật sắp ra đòn (dấu báo trên đầu), khi loài đó chưa có tiếng riêng.', 'Một tiếng báo ngắn, đanh, nghe là biết phải né.');
s('cr.hurt', 'fx', 2, 3, '150–300 ms', { cd: 200, vol: 0.6, pitch: 0.1, kw: ['creature', 'hurt', 'yelp', 'squeal'] },
  'Sinh vật trúng đòn (một nửa số lần), khi loài đó chưa có tiếng riêng.', 'Tiếng kêu đau ngắn của thú.');
s('cr.die', 'fx', 1, 3, '300–700 ms', { synth: 'mdeath', cd: 150, vol: 0.8, pitch: 0.08, kw: ['death', 'die', 'creature', 'monster'] },
  'Sinh vật chết, khi loài đó chưa có tiếng riêng.', 'Tiếng kêu tắt dần rồi thân đổ xuống.');
s('cr.idle', 'watch', 3, 3, '300–800 ms', { cd: 4000, vol: 0.35, pitch: 0.1, range: 320, kw: ['idle', 'creature', 'breath', 'snort'] },
  'Sinh vật ở gần đang đi lại (5–12 giây một lần), khi loài đó chưa có tiếng riêng.', 'Tiếng thở, khịt, cựa mình; nhỏ và xa.');
for (const [fam, f] of Object.entries(CREATURE_FAMILIES)) {
  const boss = ['greyback', 'ronin', 'tidemarshal', 'custodian'].includes(fam);
  const p: 2 | 3 = ['boar', 'wolf', 'toad', 'crawler', 'beetle', 'crab'].includes(fam) || boss ? 2 : 3;
  if (f.tell) s(`cr.${fam}.tell`, 'fx', p, 2, '200–500 ms', { borrow: 'cr.tell', cd: 300, vol: boss ? 0.9 : 0.7, pitch: 0.06, kw: [...f.kw, 'attack', 'growl'] },
    `${f.name} sắp ra đòn.`, `Tiếng dọa của ${f.voice}.`);
  s(`cr.${fam}.hurt`, 'fx', 3, 3, '150–350 ms', { borrow: 'cr.hurt', cd: 250, vol: 0.6, pitch: 0.1, kw: [...f.kw, 'hurt', 'pain'] },
    `${f.name} trúng đòn (một nửa số lần).`, `Tiếng đau của ${f.voice}.`);
  s(`cr.${fam}.die`, 'fx', p, 2, '400–900 ms', { borrow: 'cr.die', cd: 200, vol: boss ? 1 : 0.8, pitch: 0.06, kw: [...f.kw, 'death', 'die'] },
    `${f.name} chết.`, `Tiếng chết của ${f.voice}.`);
  if (!boss) s(`cr.${fam}.idle`, 'watch', 3, 3, '300–900 ms', { borrow: 'cr.idle', cd: 4000, vol: 0.35, pitch: 0.1, range: 320, kw: [...f.kw, 'idle', 'call'] },
    `${f.name} ở gần, đang đi lại hoặc đứng yên.`, `Tiếng kêu vu vơ của ${f.voice}.`);
}
s('cr.sniff', 'fx', 2, 2, '250–500 ms', { synth: 'sniff', cd: 600, vol: 0.5, kw: ['sniff', 'smell', 'snuffle'] },
  'Một con thú bắt được dấu chân và bắt đầu lần theo.', 'Hít ngửi hai ba nhịp.');
s('cr.lost', 'fx', 3, 1, '200–400 ms', { cd: 600, vol: 0.45, kw: ['confused', 'huh', 'lost', 'question'] },
  'Sinh vật mất dấu và bỏ cuộc.', 'Một tiếng hừ thắc mắc, đi xuống.');
s('cr.shoot', 'fx', 1, 3, '100–250 ms', { synth: 'zap', cd: 80, kw: ['zap', 'laser', 'spit', 'shoot', 'bolt'] },
  'Sinh vật bắn đạn (máy bò, slime phun, trùm phụ bắn mảnh).', 'Tiếng phụt hoặc tia điện ngắn.');
s('cr.tongue', 'fx', 2, 2, '150–300 ms', { synth: 'tongue', cd: 150, kw: ['tongue', 'whip', 'lash', 'slurp'] },
  'Cóc phóng lưỡi.', 'Roi ướt quất ra.');
s('cr.snip', 'fx', 2, 2, '80–180 ms', { cd: 150, kw: ['snip', 'pinch', 'claw', 'snap'] },
  'Cua kẹp.', 'Càng bập lại, đanh.');
s('cr.emerge', 'fx', 2, 2, '300–600 ms', { cd: 300, kw: ['emerge', 'burrow', 'dig', 'dirt', 'burst'] },
  'Bọ chui lên khỏi mặt đất.', 'Đất bật tung.');

// ---------------------------------------------------------------------------
// ELDER VÀ TRÙM PHỤ
// ---------------------------------------------------------------------------
s('elder.awaken', 'fx', 1, 1, '2–3.5 s', { synth: 'banner', cd: 3000, vol: 1, spatial: false, kw: ['awaken', 'roar', 'boss', 'intro', 'horn'] },
  'Một Elder thức giấc (biểu ngữ "AWAKENS").', 'Tiếng gầm lớn có vang, mặt đất rung theo.');
s('elder.engage', 'fx', 1, 2, '1.2–2 s', { synth: 'banner', borrow: 'elder.awaken', cd: 3000, vol: 0.95, spatial: false, kw: ['engage', 'growl', 'boss', 'notice', 'snarl'] },
  'Một Elder đang ngủ phát hiện bạn và lao vào đánh (biểu ngữ tên Elder).', 'Tiếng gầm ngắn hơn lúc thức giấc, sát và dữ.');
s('elder.tell', 'fx', 1, 2, '0.5–0.9 s', { synth: 'etell', cd: 300, vol: 0.9, range: 700, kw: ['charge', 'windup', 'boss', 'power'] },
  'Elder chuẩn bị ra một đòn (khoảng 0,8 giây trước khi đòn nổ).', 'Tiếng dồn lực đi lên, nghe là biết phải chạy.');
export const ELDER_KEYS: Record<string, string> = {
  frost: 'băng: gió rít, băng nứt', magma: 'dung nham: gầm trầm, lửa phì', bog: 'đầm lầy: ộp rất trầm, bùn sôi',
  grove: 'rừng già: gỗ nghiến, lá quật', tide: 'thủy triều: sóng cuộn, gầm ướt', rust: 'gỉ sét: kim loại nghiến, điện rè',
  surtur: 'Surtur: lửa và sắt', typhon: 'Typhon: bão và rắn rít', aion: 'Aion: chuông và thời gian méo',
  atlas: 'Atlas: đá khổng lồ nghiến', argus: 'Argus: nhiều giọng thì thầm', anubis: 'Anubis: chó rừng tru, cát chảy',
};
for (const [k, voice] of Object.entries(ELDER_KEYS)) {
  s(`elder.${k}.tell`, 'fx', 3, 2, '0.5–1 s', { borrow: 'elder.tell', cd: 300, vol: 0.9, range: 700, kw: [k, 'boss', 'roar'] },
    `Elder ${k} chuẩn bị ra đòn.`, `Giọng riêng của Elder ${voice}.`);
}
s('elder.emerge', 'fx', 1, 2, '0.6–1.2 s', { cd: 400, vol: 1, range: 700, kw: ['emerge', 'burst', 'erupt', 'surface'] },
  'Elder trồi lên sau khi lặn.', 'Mặt đất hoặc mặt nước vỡ tung, khối lớn trồi lên.');
s('elder.submerge', 'fx', 2, 2, '0.5–1 s', { cd: 400, range: 700, kw: ['submerge', 'dive', 'sink', 'plunge'] },
  'Elder lặn xuống.', 'Khối lớn chìm xuống, nước hoặc bùn khép lại.');
s('elder.brood', 'fx', 2, 2, '0.5–1 s', { cd: 400, kw: ['spawn', 'hatch', 'brood', 'egg'] },
  'Elder đầm lầy sinh ra ba con cóc.', 'Trứng nhớt vỡ, tiếng ộp con.');
s('elder.drain', 'fx', 2, 2, '0.6–1.2 s', { cd: 400, kw: ['drain', 'absorb', 'suck', 'leech'] },
  'Elder hút sức sống từ cây để hồi máu.', 'Tiếng hút ngược, nhựa cây rút đi.');
s('elder.defeat', 'receipt', 1, 1, '2–3 s', { cd: 3000, spatial: false, vol: 1, kw: ['defeat', 'death', 'boss', 'collapse'] },
  'Hạ được một Elder hoặc trùm phụ (lớp dưới của cảnh lớn).', 'Tiếng gầm cuối tắt dần, khối lớn sụp xuống.');
s('elder.phase', 'fx', 1, 1, '0.8–1.5 s', { cd: 1500, vol: 0.95, spatial: false, kw: ['phase', 'enrage', 'transform', 'rage'] },
  'Trùm phụ còn 55 % máu và đổi thế đánh.', 'Tiếng nứt vỡ rồi gầm lên, báo trận đánh khó hơn.');

// đòn diện rộng: tiếng phát lúc đòn NỔ, sau vòng báo trên mặt đất
const HAZ: [string, 1 | 2 | 3, string, string, string[]][] = [
  ['fire', 1, 'lửa, dung nham, thiên thạch nhỏ', 'Lửa bùng lên từ mặt đất.', ['fire', 'flame', 'burst', 'magma']],
  ['quake', 1, 'động đất, nện, phun trào', 'Mặt đất nứt, đá bật lên.', ['quake', 'slam', 'stomp', 'earth']],
  ['frost', 2, 'băng: vòng băng, gai băng, mảnh băng', 'Băng kết lại rồi vỡ, lanh canh.', ['ice', 'frost', 'freeze', 'shard']],
  ['water', 2, 'sóng, thủy triều, vũng độc', 'Nước đập xuống, bọt sôi.', ['wave', 'splash', 'water', 'acid']],
  ['root', 2, 'rễ cây, hạt nổ', 'Rễ đâm lên khỏi đất, gỗ nứt.', ['root', 'vine', 'wood', 'thorn']],
  ['beam', 2, 'tia năng lượng, vòng điện', 'Tia điện rít ngang.', ['beam', 'laser', 'energy', 'ray']],
  ['blade', 3, 'chém gió, lao tới', 'Lưỡi gió xé ngang.', ['slash', 'wind', 'blade', 'cut']],
];
s('haz.hit', 'fx', 1, 3, '300–600 ms', { synth: 'hazfire', cd: 80, vol: 0.9, kw: ['explosion', 'impact', 'blast'] },
  'Một đòn diện rộng nổ, khi loại đó chưa có tiếng riêng.', 'Một tiếng nổ đục vừa phải.');
for (const [k, prio, what, sound, kw] of HAZ) {
  s(`haz.${k}`, 'fx', prio, 3, '300–700 ms', { borrow: 'haz.hit', cd: 80, vol: 0.9, kw },
    `Đòn diện rộng thuộc loại ${what} nổ.`, sound);
}

// ---------------------------------------------------------------------------
// CREATOR CORE
// ---------------------------------------------------------------------------
export const CORE_ELEMENTS: Record<string, { title: string; sound: string; kw: string[] }> = {
  fire: { title: 'lửa', sound: 'lửa phụt, gầm', kw: ['fire', 'flame', 'fireball'] },
  frost: { title: 'băng', sound: 'băng kết, lanh canh', kw: ['ice', 'frost', 'freeze'] },
  storm: { title: 'sấm sét', sound: 'điện nổ, sấm gọn', kw: ['thunder', 'lightning', 'electric', 'shock'] },
  earth: { title: 'đất và cây', sound: 'đất chuyển, gỗ nứt', kw: ['earth', 'nature', 'root', 'rock'] },
  spirit: { title: 'linh hồn', sound: 'hợp xướng mỏng, gió ma', kw: ['spirit', 'soul', 'ghost', 'dark', 'void'] },
};
/** Each Creator Core, its element, and what its three casts are. */
export const CORE_KINDS: Record<string, { name: string; el: string; basic: string; refined: string; signature: string }> = {
  blast: { name: 'Big Bang', el: 'fire', basic: 'tia lửa', refined: 'quả nổ', signature: 'vụ nổ lớn' },
  meteor: { name: 'Meteor', el: 'fire', basic: 'cầu lửa', refined: 'thiên thạch nhắm đích', signature: 'mưa mười thiên thạch' },
  dragon: { name: "Dragon's Breath", el: 'fire', basic: 'phun lửa', refined: 'lốc lửa', signature: 'rồng bổ nhào' },
  elsa: { name: 'Elsa', el: 'frost', basic: 'mảnh băng', refined: 'đóng băng mặt đất', signature: 'bão băng' },
  earthmother: { name: 'Earth Mother', el: 'earth', basic: 'rễ trói', refined: 'mọc rừng', signature: 'đất mẹ trỗi dậy' },
  mjolnir: { name: 'Mjolnir', el: 'storm', basic: 'tia sét', refined: 'sét chuyền', signature: 'búa trời giáng' },
  demon: { name: 'Demon', el: 'spirit', basic: 'đòn linh hồn', refined: 'triệu hồi', signature: 'dịch chuyển linh hồn' },
};
for (const [el, e] of Object.entries(CORE_ELEMENTS)) {
  s(`core.windup.${el}`, 'fx', 1, 2, '0.4–0.6 s', { synth: 'windup', cd: 150, vol: 0.7, kw: [...e.kw, 'charge', 'windup', 'cast'] },
    `Bắt đầu niệm một Core hệ ${e.title}.`, `Năng lượng dồn lại, đi lên: ${e.sound}.`);
  s(`core.cast.${el}`, 'fx', 1, 3, '0.3–0.7 s', { synth: 'cast', cd: 60, vol: 0.9, kw: [...e.kw, 'cast', 'spell', 'release'] },
    `Phép hệ ${e.title} được thả ra, khi Core đó chưa có tiếng riêng.`, `Thả lực: ${e.sound}.`);
}
for (const [ck, c] of Object.entries(CORE_KINDS)) {
  s(`core.${ck}.basic`, 'fx', 2, 3, '0.2–0.5 s', { borrow: `core.cast.${c.el}`, cd: 60, vol: 0.85, pitch: 0.06, kw: [ck, 'basic', 'shot'] },
    `${c.name}: đòn thường (chuột trái) — ${c.basic}.`, 'Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu.');
  s(`core.${ck}.refined`, 'fx', 2, 2, '0.5–1 s', { borrow: `core.cast.${c.el}`, cd: 150, vol: 0.95, kw: [ck, 'skill', 'heavy'] },
    `${c.name}: kỹ thuật Q — ${c.refined}.`, 'Dày và dài hơn đòn thường.');
  s(`core.${ck}.signature`, 'fx', 2, 1, '1–2.5 s', { borrow: `core.cast.${c.el}`, cd: 400, vol: 1, range: 900, kw: [ck, 'ultimate', 'ult', 'signature'] },
    `${c.name}: tuyệt kỹ E — ${c.signature}.`, 'Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi.');
}
s('core.fizzle', 'fx', 1, 2, '200–400 ms', { synth: 'fizzle', cd: 200, vol: 0.6, kw: ['fizzle', 'fail', 'empty', 'sputter'] },
  'Niệm hụt: hết năng lượng, bị ngắt, hoặc lăn khi không đủ thể lực.', 'Lực xì ra, rơi xuống.');
s('core.bolt', 'fx', 1, 3, '150–350 ms', { synth: 'bolt', cd: 50, vol: 0.9, kw: ['bolt', 'arc', 'chain', 'electric', 'zap'] },
  'Một tia sét chuyền từ mục tiêu này sang mục tiêu khác.', 'Tia điện nổ tách, đanh.');
s('core.elsa.shard', 'fx', 3, 3, '150–350 ms', { borrow: 'core.cast.frost', cd: 60, vol: 0.6, kw: ['ice', 'shard', 'shatter', 'tinkle'] },
  'Mảnh băng của Elsa vỡ khi chạm đích và đóng băng mặt đất.', 'Băng vỡ lanh canh.');
s('core.spirit.depart', 'fx', 1, 1, '0.8–1.5 s', { cd: 800, vol: 0.9, spatial: false, kw: ['teleport', 'vanish', 'warp', 'depart'] },
  'Dịch chuyển linh hồn: rời đi.', 'Hút vào một điểm rồi biến mất.');
s('core.spirit.arrive', 'fx', 1, 1, '0.8–1.5 s', { cd: 800, vol: 0.9, spatial: false, kw: ['teleport', 'appear', 'arrive', 'warp'] },
  'Dịch chuyển linh hồn: tới nơi.', 'Bung ra từ một điểm, có dư âm.');
s('core.spirit.hit', 'fx', 2, 3, '200–400 ms', { borrow: 'core.cast.spirit', cd: 60, kw: ['soul', 'spirit', 'hit', 'wail'] },
  'Linh thể được triệu hồi đánh trúng.', 'Một cú đánh có tiếng vọng lạnh.');

// ---------------------------------------------------------------------------
// LỬA, NỔ, SÉT
// ---------------------------------------------------------------------------
s('fire.ignite', 'fx', 1, 3, '300–600 ms', { bus: 'world', synth: 'ignite', cd: 100, kw: ['ignite', 'fire', 'catch', 'whoosh'] },
  'Một ô cỏ hoặc cây bắt lửa.', 'Lửa bùng lên, phừng.');
s('fire.steam', 'fx', 2, 2, '400–800 ms', { bus: 'world', synth: 'steam', cd: 150, kw: ['steam', 'hiss', 'extinguish', 'sizzle'] },
  'Nước hoặc băng dập lửa; tưới tắt đám cháy.', 'Xèo dài, hơi nước.');
s('fire.boom', 'fx', 1, 3, '0.6–1.2 s', { synth: 'boom', cd: 80, vol: 1, range: 900, kw: ['explosion', 'boom', 'blast'] },
  'Vụ nổ lớn: quả nổ, thiên thạch.', 'Nổ có đầu đanh, thân trầm, đuôi rền.');
s('fire.boom.small', 'fx', 1, 3, '300–600 ms', { borrow: 'fire.boom', synth: 'boom', cd: 60, vol: 0.8, kw: ['small', 'explosion', 'pop', 'mine'] },
  'Vụ nổ nhỏ: mìn, mảnh văng.', 'Nổ gọn, ít đuôi.');
s('fire.lightning', 'fx', 1, 3, '0.8–1.6 s', { synth: 'lightning', cd: 150, vol: 1, range: 1400, kw: ['lightning', 'thunder', 'strike', 'crack'] },
  'Sét đánh xuống: trong bão, hoặc từ một đòn sét.', 'Tách chói rồi sấm rền; ở xa vẫn nghe.');

// ---------------------------------------------------------------------------
// XÂY DỰNG VÀ CÔNG TRÌNH
// ---------------------------------------------------------------------------
s('build.wood', 'receipt', 1, 3, '300–600 ms', { synth: 'build', cd: 100, kw: ['build', 'wood', 'hammer', 'place', 'plank'] },
  'Đặt một công trình gỗ: sàn, tường, cửa, rương, giường, thang gỗ.', 'Hai nhát búa đóng ván.');
s('build.stone', 'receipt', 1, 3, '300–600 ms', { borrow: 'build.wood', synth: 'build', cd: 100, kw: ['build', 'stone', 'brick', 'place'] },
  'Đặt công trình đá: sàn đá, tường đá, lò.', 'Đá đặt lên đá, một tiếng cộp nặng.');
s('build.metal', 'receipt', 1, 3, '300–600 ms', { borrow: 'build.wood', synth: 'build', cd: 100, kw: ['build', 'metal', 'wrench', 'bolt', 'ratchet'] },
  'Đặt công trình kim loại: cửa sắt, máy phát, máy lọc, bơm dầu, tháp tên, két.', 'Siết bu lông, kim loại khớp vào nhau.');
s('build.soft', 'receipt', 2, 3, '300–600 ms', { borrow: 'build.wood', synth: 'build', cd: 100, kw: ['thatch', 'straw', 'rope', 'tie'] },
  'Đặt mái tranh, giường rơm, vườn, lửa trại.', 'Buộc dây, rơm sột soạt.');
s('build.wire', 'receipt', 2, 2, '200–400 ms', { borrow: 'build.metal', synth: 'build', cd: 100, kw: ['wire', 'cable', 'click', 'plug', 'electric'] },
  'Đặt dây điện, công tắc, cảm biến.', 'Cắm giắc, một tiếng tách điện.');
s('build.upgrade', 'receipt', 1, 2, '0.6–1.2 s', { synth: 'capability', cd: 300, kw: ['upgrade', 'improve', 'reinforce', 'anvil'] },
  'Nâng cấp công trình, trạm, lò, máy phát, xe kéo.', 'Loạt búa nhanh rồi một tiếng chốt vang.');
s('build.repair', 'receipt', 1, 3, '300–700 ms', { synth: 'craft', cd: 150, kw: ['repair', 'fix', 'hammer', 'patch'] },
  'Sửa công trình, gia cố bằng tấm sắt.', 'Vài nhát búa đều.');
s('build.reclaim', 'receipt', 1, 2, '400–800 ms', { synth: 'structbreak', cd: 150, vol: 0.6, kw: ['dismantle', 'demolish', 'pry', 'break'] },
  'Tháo dỡ một công trình để lấy lại vật liệu.', 'Bẩy ván ra, gỗ rơi lộp cộp.');
s('build.hit', 'fx', 1, 4, '100–250 ms', { bus: 'combat', synth: 'structhit', cd: 80, kw: ['impact', 'wood', 'bash', 'thud'] },
  'Công trình bị đánh trúng.', 'Húc vào tường gỗ, rung.');
s('build.break', 'fx', 1, 3, '0.5–1 s', { bus: 'combat', synth: 'structbreak', cd: 150, vol: 1, kw: ['collapse', 'destroy', 'crash', 'debris'] },
  'Công trình bị phá sập.', 'Gỗ gãy, đổ sập, mảnh văng.');
s('build.collapse', 'receipt', 1, 1, '1–2 s', { bus: 'combat', cd: 1500, vol: 1, spatial: false, kw: ['collapse', 'rumble', 'fall', 'structure'] },
  'Một phần căn cứ sụp vì mất nền hoặc mất trụ đỡ.', 'Sập dây chuyền, nhiều lớp đổ nối nhau.');

// ---------------------------------------------------------------------------
// CỬA
// ---------------------------------------------------------------------------
s('door.wood.open', 'receipt', 1, 2, '250–500 ms', { synth: 'doorWood', cd: 150, kw: ['door', 'open', 'wood', 'creak'] },
  'Mở cửa gỗ.', 'Bản lề kẹt nhẹ, cánh gỗ mở.');
s('door.wood.close', 'receipt', 1, 2, '200–400 ms', { borrow: 'door.wood.open', synth: 'doorWood', cd: 150, kw: ['door', 'close', 'wood', 'shut'] },
  'Đóng cửa gỗ.', 'Cánh gỗ sập vào khung.');
s('door.iron.open', 'receipt', 2, 2, '300–600 ms', { borrow: 'door.wood.open', synth: 'doorWood', cd: 150, kw: ['door', 'metal', 'iron', 'open', 'gate'] },
  'Mở cửa sắt, cửa phế tích.', 'Sắt nặng rít trên bản lề.');
s('door.iron.close', 'receipt', 2, 2, '300–600 ms', { borrow: 'door.iron.open', synth: 'doorWood', cd: 150, kw: ['door', 'metal', 'iron', 'close', 'slam'] },
  'Đóng cửa sắt.', 'Sắt sập, vang.');
s('door.powered', 'receipt', 1, 2, '400–800 ms', { synth: 'doorPowered', cd: 200, kw: ['door', 'electric', 'hydraulic', 'servo', 'scifi'] },
  'Cửa điện mở: có nguồn, quẹt đúng thẻ, hoặc mở từ bên trong.', 'Mô tơ kéo, hơi xì, một tiếng bíp xác nhận.');
s('door.locked', 'ui', 1, 2, '200–400 ms', { synth: 'doorLocked', cd: 300, spatial: false, kw: ['locked', 'rattle', 'handle', 'denied'] },
  'Thử mở cửa bị khóa, thiếu thẻ, hết điện.', 'Tay nắm lắc, chốt không nhả.');
s('door.auto.close', 'receipt', 2, 1, '400–800 ms', { borrow: 'door.powered', synth: 'doorPowered', cd: 300, vol: 0.6, kw: ['door', 'auto', 'close', 'seal'] },
  'Cửa điện tự đóng lại sau một lúc.', 'Mô tơ đẩy ngược rồi khóa sập.');

// ---------------------------------------------------------------------------
// RƯƠNG, THÙNG, ĐỒ TIẾP TẾ
// ---------------------------------------------------------------------------
s('box.chest.open', 'ui', 1, 2, '300–600 ms', { synth: 'ui', cd: 200, kw: ['chest', 'open', 'lid', 'wood'] },
  'Mở rương của mình, tủ đồ, xe kéo.', 'Nắp gỗ nặng mở, bản lề kẹt.');
s('box.chest.close', 'ui', 2, 2, '200–400 ms', { synth: 'uiBack', cd: 200, kw: ['chest', 'close', 'lid', 'shut'] },
  'Đóng rương hoặc thùng (đóng bảng thùng chứa).', 'Nắp sập xuống.');
s('box.loot.open', 'ui', 1, 3, '300–600 ms', { borrow: 'box.chest.open', synth: 'ui', cd: 200, kw: ['crate', 'rummage', 'search', 'loot', 'locker'] },
  'Lục một thùng đồ ngoài đảo, tủ sắt, xác xe.', 'Mở nắp, lục lọi.');
s('box.bag.open', 'ui', 2, 2, '200–400 ms', { borrow: 'ui.panel.open', synth: 'ui', cd: 200, kw: ['bag', 'sack', 'zip', 'cloth'] },
  'Mở túi đồ rơi lại (kể cả túi sau khi chết).', 'Kéo dây túi vải.');
s('box.machine.open', 'ui', 3, 1, '200–400 ms', { borrow: 'box.chest.open', synth: 'ui', cd: 200, kw: ['hatch', 'metal', 'panel', 'latch'] },
  'Mở máy tái chế, thùng xe máy.', 'Chốt kim loại bật, cửa sập mở.');
s('box.rag.open', 'receipt', 1, 1, '0.8–1.5 s', { synth: 'rare', cd: 500, kw: ['treasure', 'chest', 'magic', 'unlock', 'reveal'] },
  'Mở rương Ragnarok hoặc hộp thẻ.', 'Khóa nặng nhả ra, nắp mở có ánh sáng.');
s('box.cash.open', 'receipt', 1, 1, '0.5–1 s', { synth: 'coin', cd: 500, kw: ['strongbox', 'safe', 'cash', 'unlock'] },
  'Mở hộp tiền Ragnarok.', 'Khóa két bật, xu xô vào nhau.');
s('box.airdrop.signal', 'receipt', 1, 1, '1.5–3 s', { cd: 5000, vol: 0.7, kw: ['radio', 'signal', 'beacon', 'transmission', 'flare'] },
  'Có tín hiệu thả đồ tiếp tế.', 'Radio rè rồi ba tiếng bíp; hoặc pháo hiệu.');
s('box.airdrop.descent', 'receipt', 2, 1, '2–4 s', { cd: 5000, vol: 0.7, kw: ['plane', 'flyby', 'whistle', 'falling', 'parachute'] },
  'Thùng tiếp tế bắt đầu rơi.', 'Máy bay ngang qua, tiếng vật rơi rít.');
s('box.airdrop.land', 'fx', 1, 2, '0.5–1 s', { synth: 'airdropImpact', cd: 500, spatial: true, range: 900, vol: 1, kw: ['crate', 'impact', 'land', 'crash', 'thud'] },
  'Thùng tiếp tế chạm đất.', 'Thùng gỗ nặng nện xuống.');
s('box.airdrop.open', 'receipt', 1, 1, '0.5–1 s', { borrow: 'box.loot.open', synth: 'ui', cd: 500, kw: ['crate', 'crowbar', 'pry', 'open'] },
  'Mở thùng tiếp tế.', 'Bẩy nắp thùng bằng xà beng.');

// ---------------------------------------------------------------------------
// TRẠM CHẾ TẠO, ĐIỆN, BẪY
// ---------------------------------------------------------------------------
s('station.craft', 'receipt', 1, 3, '300–700 ms', { synth: 'craft', cd: 150, spatial: false, kw: ['craft', 'assemble', 'make', 'tool'] },
  'Chế tạo bằng tay xong một món.', 'Gọt, buộc, một tiếng chốt.');
s('station.queue', 'receipt', 2, 2, '150–350 ms', { synth: 'ui', cd: 100, spatial: false, kw: ['queue', 'load', 'insert', 'slot'] },
  'Xếp một việc vào trạm; bỏ nguyên liệu vào.', 'Đặt nguyên liệu vào khay.');
s('station.done', 'receipt', 1, 2, '300–700 ms', { synth: 'craft', cd: 200, kw: ['done', 'complete', 'ding', 'finish'] },
  'Một trạm làm xong một việc, khi trạm đó chưa có tiếng riêng.', 'Một tiếng báo xong, rõ nhưng không chói.');
for (const [k, what, sound, kw] of [
  ['furnace', 'Lò nung (cả lò lớn) ra một mẻ', 'Thỏi kim loại nóng rơi ra khay, xèo.', ['ingot', 'smelt', 'forge', 'metal']],
  ['campfire', 'Lửa trại nấu xong', 'Mỡ xèo, một tiếng gõ nồi.', ['cook', 'sizzle', 'pan', 'pot']],
  ['workbench', 'Bàn chế tạo làm xong', 'Búa chốt nhát cuối, đặt món đồ xuống.', ['workbench', 'hammer', 'craft']],
  ['refinery', 'Máy lọc ra nhiên liệu', 'Van xả, chất lỏng chảy vào can.', ['valve', 'pour', 'fuel', 'liquid']],
  ['oil_pump', 'Bơm dầu ra dầu thô', 'Bơm nhả, dầu ọc ra.', ['pump', 'oil', 'glug']],
  ['research', 'Bàn nghiên cứu xong', 'Đóng sổ, một nốt sáng.', ['book', 'research', 'eureka']],
  ['recycler', 'Máy tái chế xong một món', 'Máy nghiền dừng, mảnh rơi ra khay.', ['recycle', 'grind', 'shred']],
] as const) {
  s(`station.done.${k}`, 'receipt', 2, 2, '300–800 ms', { borrow: 'station.done', synth: 'craft', cd: 200, kw: [...kw] }, `${what}.`, sound);
}
s('station.on', 'receipt', 1, 2, '400–800 ms', { synth: 'machineOn', cd: 300, kw: ['start', 'power', 'engine', 'ignite', 'machine'] },
  'Một trạm bắt đầu chạy; bật máy phát; đổ nhiên liệu cho máy phát phế tích.', 'Máy khởi động, tăng dần.');
s('station.off', 'receipt', 1, 2, '400–800 ms', { synth: 'machineOff', cd: 300, kw: ['stop', 'powerdown', 'shutdown', 'die'] },
  'Hết nhiên liệu, lửa sưởi tắt, tắt máy phát.', 'Máy chậm dần rồi tắt.');
s('station.stall', 'receipt', 2, 1, '200–400 ms', { borrow: 'ui.deny', cd: 500, vol: 0.5, kw: ['stall', 'jam', 'clunk', 'stuck'] },
  'Một trạm ở gần đứng máy: khay ra đầy, thiếu nguyên liệu, bị chặn.', 'Máy khựng lại, một tiếng cụp.');
s('station.switch', 'receipt', 1, 2, '80–200 ms', { synth: 'ui', cd: 100, kw: ['switch', 'lever', 'toggle', 'click'] },
  'Gạt công tắc, đổi ưu tiên điện, cấu hình tháp tên hoặc trang trại.', 'Cần gạt cơ khí, tách chắc.');
s('station.recycle.start', 'receipt', 2, 1, '400–800 ms', { borrow: 'station.on', synth: 'machineOn', cd: 300, kw: ['recycle', 'grinder', 'start'] },
  'Bỏ một món vào máy tái chế.', 'Máy nghiền bắt đầu quay.');
s('station.trap.set', 'receipt', 2, 1, '300–600 ms', { cd: 300, kw: ['trap', 'arm', 'spring', 'ratchet'] },
  'Giương bẫy gấu.', 'Lò xo kéo căng, khóa chốt.');
s('station.trap.snap', 'receipt', 1, 2, '200–400 ms', { bus: 'combat', cd: 200, vol: 1, kw: ['trap', 'snap', 'clamp', 'jaw'] },
  'Bẫy gấu sập vào một sinh vật.', 'Hàm sắt bập lại, rất đanh.');
s('station.turret', 'fx', 1, 3, '100–250 ms', { bus: 'combat', synth: 'bowshot', cd: 80, kw: ['turret', 'crossbow', 'shoot', 'bolt'] },
  'Tháp tên bắn.', 'Nỏ cơ khí bật.');
s('station.poi.expire', 'receipt', 2, 1, '0.6–1.2 s', { borrow: 'station.off', synth: 'machineOff', cd: 500, vol: 0.6, kw: ['powerdown', 'lights', 'out'] },
  'Máy phát phế tích hết giờ chạy.', 'Điện sụt, đèn tắt.');

// ---------------------------------------------------------------------------
// VƯỜN, NƯỚC, VẬT NUÔI, NGHỈ NGƠI
// ---------------------------------------------------------------------------
s('farm.plant', 'receipt', 2, 2, '300–600 ms', { cd: 200, kw: ['plant', 'seed', 'dig', 'soil'] },
  'Gieo hạt vào luống.', 'Xới đất, vùi hạt.');
s('farm.water', 'receipt', 2, 2, '400–900 ms', { cd: 200, kw: ['water', 'pour', 'sprinkle'] },
  'Tưới luống; đổ nước vào thùng, máng.', 'Nước rót xuống đất hoặc vào thùng gỗ.');
s('farm.harvest', 'receipt', 2, 3, '300–600 ms', { borrow: 'gather.plant', cd: 200, kw: ['harvest', 'pluck', 'pick', 'crop'] },
  'Thu hoạch luống.', 'Nhổ, bẻ, lá xào xạc.');
s('farm.fill', 'receipt', 2, 2, '0.5–1 s', { borrow: 'farm.water', cd: 300, kw: ['fill', 'bottle', 'flask', 'glug'] },
  'Múc nước đầy bình ở sông hoặc thùng.', 'Bình chìm xuống, ọc ọc đầy dần.');
s('farm.tame', 'receipt', 2, 1, '0.6–1.2 s', { synth: 'capability', cd: 500, kw: ['tame', 'friendly', 'pet', 'success'] },
  'Thuần hóa xong một con vật.', 'Con vật kêu hiền, kèm một nốt ấm.');
s('farm.feed', 'receipt', 3, 2, '300–700 ms', { borrow: 'player.eat', cd: 300, kw: ['feed', 'chew', 'animal', 'munch'] },
  'Cho vật nuôi ăn; đổ thức ăn vào máng.', 'Thú nhai rào rạo.');
s('farm.lead', 'receipt', 3, 1, '200–400 ms', { cd: 300, kw: ['rope', 'lead', 'leash', 'whistle'] },
  'Dắt hoặc thả một con vật.', 'Dây thừng giật nhẹ, tặc lưỡi gọi.');
s('farm.rest.start', 'receipt', 1, 1, '0.8–1.5 s', { cd: 1000, kw: ['bed', 'lie', 'straw', 'sleep', 'sigh'] },
  'Nằm xuống giường nghỉ.', 'Rơm lún, thở ra một hơi.');
s('farm.rest.end', 'receipt', 1, 1, '0.8–1.5 s', { cd: 1000, kw: ['wake', 'yawn', 'rise', 'morning'] },
  'Thức dậy (hết giờ, bị đánh thức, tự dậy).', 'Ngáp, rơm sột soạt khi ngồi dậy.');
s('farm.douse', 'receipt', 2, 2, '400–800 ms', { borrow: 'fire.steam', synth: 'steam', cd: 200, kw: ['douse', 'extinguish', 'splash'] },
  'Dùng bình nước dập một cây đang cháy.', 'Nước hắt vào lửa, xèo.');

// ---------------------------------------------------------------------------
// XE KÉO, XE MÁY, TÀU SƠ TÁN
// ---------------------------------------------------------------------------
s('ride.cart.grab', 'receipt', 2, 2, '200–400 ms', { cd: 200, kw: ['cart', 'handle', 'grab', 'wood', 'creak'] },
  'Nắm càng xe kéo (F).', 'Nhấc càng gỗ, bánh xe kẹt nhẹ.');
s('ride.cart.release', 'receipt', 2, 2, '200–400 ms', { borrow: 'ride.cart.grab', cd: 200, kw: ['cart', 'drop', 'release', 'set'] },
  'Thả xe kéo; đặt hoặc gấp xe.', 'Càng gỗ hạ xuống đất.');
s('ride.bike.mount', 'receipt', 1, 1, '0.8–1.5 s', { synth: 'vehicleStart', cd: 800, kw: ['motorcycle', 'engine', 'start', 'kick', 'ignition'] },
  'Lên xe máy.', 'Đạp nổ, máy bắt lửa.');
s('ride.bike.exit', 'receipt', 1, 1, '0.6–1.2 s', { synth: 'vehicleStop', cd: 800, kw: ['engine', 'stop', 'off', 'shutdown'] },
  'Xuống xe máy.', 'Máy tắt, kim loại nguội lách tách.');
s('ride.bike.refuel', 'receipt', 2, 1, '0.8–1.5 s', { borrow: 'farm.fill', cd: 500, kw: ['fuel', 'pour', 'gas', 'refuel'] },
  'Đổ xăng, tra dầu.', 'Xăng ọc vào bình.');
s('ride.bike.repair', 'receipt', 2, 1, '0.6–1.2 s', { borrow: 'build.repair', synth: 'craft', cd: 500, kw: ['wrench', 'ratchet', 'repair', 'mechanic'] },
  'Sửa xe máy.', 'Cờ lê siết, cạch cạch.');
s('ride.evac.open', 'receipt', 1, 1, '2–4 s', { cd: 5000, vol: 0.8, kw: ['ship', 'horn', 'boat', 'foghorn'] },
  'Tàu sơ tán mở bến; tàu cập bến.', 'Còi tàu xa, một hồi dài.');
s('ride.evac.depart', 'receipt', 1, 1, '2–4 s', { borrow: 'ride.evac.open', cd: 5000, vol: 0.8, kw: ['ship', 'horn', 'depart', 'double'] },
  'Tàu sơ tán rời bến.', 'Hai hồi còi ngắn.');
s('ride.evac.board', 'receipt', 1, 1, '0.8–1.5 s', { cd: 1000, kw: ['board', 'gangway', 'deck', 'footsteps'] },
  'Lên tàu, rời tàu, xếp hàng lên tàu.', 'Bước trên cầu ván, dây neo cọt kẹt.');

// ---------------------------------------------------------------------------
// NGƯỜI TRÊN ĐẢO — chỉ khi chính người chơi tương tác
// ---------------------------------------------------------------------------
s('npc.talk', 'receipt', 1, 4, '200–500 ms', { cd: 300, vol: 0.6, pitch: 0.1, kw: ['talk', 'voice', 'mumble', 'speech', 'hm'] },
  'Bắt chuyện với một người.', 'Một câu lầm bầm không rõ lời; giọng trung tính.');
s('npc.trade', 'receipt', 1, 2, '300–600 ms', { borrow: 'ui.coin', cd: 300, kw: ['trade', 'barter', 'exchange', 'goods'] },
  'Đổi đồ, lấy đồ, giao hàng, góp bếp.', 'Đồ đặt lên bàn, hai bên trao tay.');
s('npc.recruit', 'receipt', 2, 1, '0.8–1.5 s', { synth: 'capability', cd: 800, kw: ['recruit', 'join', 'ally', 'agree'] },
  'Thu nhận được một người.', 'Bắt tay, một nốt ấm.');
s('npc.order', 'receipt', 2, 3, '200–500 ms', { borrow: 'npc.talk', cd: 300, kw: ['yes', 'okay', 'acknowledge', 'nod'] },
  'Giao việc, bảo đi theo, cho nghỉ.', 'Một tiếng ừ ngắn.');
s('npc.threaten', 'receipt', 3, 2, '300–600 ms', { borrow: 'npc.talk', cd: 500, kw: ['threat', 'angry', 'shout', 'hey'] },
  'Đe dọa một người.', 'Quát ngắn, người kia giật mình.');
s('npc.aid', 'receipt', 2, 1, '400–800 ms', { borrow: 'player.heal', cd: 500, kw: ['bandage', 'aid', 'help', 'heal'] },
  'Cứu chữa một người bị thương.', 'Quấn băng, người kia thở ra.');
s('npc.down', 'receipt', 2, 2, '400–800 ms', { bus: 'combat', cd: 1000, spatial: true, kw: ['scream', 'fall', 'cry', 'help'] },
  'Một người ở gần gục xuống hoặc chết.', 'Tiếng kêu ngắn rồi thân đổ.');

// ---------------------------------------------------------------------------
// ĐIỂM XUYẾT MÔI TRƯỜNG — phát ngẫu nhiên, lệch trái phải, 7–20 giây một lần
// ---------------------------------------------------------------------------
const AMB: [string, 1 | 2 | 3, number, string, string, string, string[]][] = [
  ['bird', 1, 6, '0.5–2 s', 'Ban ngày, ngoài trời, ở đồng cỏ hoặc rừng, không mưa.', 'Chim hót từng câu ngắn, nhiều loài khác nhau.', ['bird', 'chirp', 'song', 'tweet']],
  ['owl', 2, 3, '1–2.5 s', 'Ban đêm ở rừng hoặc đồng cỏ.', 'Cú kêu, xa.', ['owl', 'hoot', 'night']],
  ['howl', 2, 2, '2–4 s', 'Ban đêm, ngoài trời; hiếm.', 'Sói tru rất xa.', ['howl', 'wolf', 'distant']],
  ['frog', 2, 4, '0.5–1.5 s', 'Ở đầm lầy, hoặc ban đêm gần nước.', 'Ếch nhái kêu từng chập.', ['frog', 'toad', 'ribbit', 'croak']],
  ['gull', 2, 4, '0.8–2 s', 'Ban ngày, cách biển dưới bốn ô.', 'Mòng biển kêu.', ['gull', 'seagull', 'sea']],
  ['gust', 2, 4, '1.5–3 s', 'Ở vùng núi tuyết, hoặc khi có bão.', 'Một cơn gió giật rít qua.', ['gust', 'wind', 'howl', 'blow']],
  ['creak', 2, 4, '1–2.5 s', 'Ở phế tích, vùng độc, xưởng đúc.', 'Kim loại gỉ kêu cọt kẹt, tôn va.', ['creak', 'metal', 'rust', 'groan']],
  ['house', 3, 4, '0.8–2 s', 'Trong nhà có mái.', 'Gỗ nhà nứt khẽ, mái tranh xào xạc.', ['house', 'wood', 'creak', 'settle']],
  ['thunder', 1, 4, '2–5 s', 'Khi có bão, 15–40 giây một lần.', 'Sấm rền xa, không có tiếng tách.', ['thunder', 'rumble', 'distant', 'storm']],
  ['volcano', 2, 3, '2–4 s', 'Ở vùng tro, gần dung nham.', 'Núi lửa ầm ì, đá lăn xa.', ['volcano', 'rumble', 'lava', 'eruption']],
  ['twig', 3, 4, '0.3–1 s', 'Trong rừng, cả ngày lẫn đêm.', 'Cành gãy, lá rơi, có gì đó động trong bụi.', ['twig', 'branch', 'snap', 'rustle']],
  ['rag', 1, 4, '2–5 s', 'Trong Ragnarok.', 'Đất nứt xa, tiếng sụp đổ vọng về.', ['rumble', 'quake', 'collapse', 'doom']],
];
for (const [k, prio, n, len, when, sound, kw] of AMB) {
  s(`amb.${k}`, 'watch', prio, n, len, { cd: 3000, vol: 0.5, pitch: 0.08, range: 520, kw }, when, sound);
}
s('amb.rain.start', 'fx', 2, 1, '2–4 s', { cd: 20000, spatial: false, vol: 0.5, kw: ['rain', 'start', 'drops', 'begin'] },
  'Trời chuyển mưa.', 'Vài hạt mưa đầu rơi lộp độp, dày dần.');
s('amb.storm.start', 'fx', 1, 1, '3–5 s', { borrow: 'amb.thunder', cd: 20000, spatial: false, vol: 0.8, kw: ['storm', 'thunder', 'clap', 'start'] },
  'Trời chuyển bão.', 'Một tiếng sấm lớn mở đầu cơn bão.');
s('amb.clear', 'fx', 3, 1, '2–4 s', { borrow: 'amb.bird', cd: 20000, spatial: false, vol: 0.4, kw: ['clear', 'after', 'rain', 'drip', 'birds'] },
  'Trời quang lại sau mưa.', 'Nước nhỏ giọt, chim hót lại.');
s('amb.dawn', 'watch', 2, 1, '2–4 s', { cd: 60000, spatial: false, vol: 0.5, kw: ['dawn', 'morning', 'rooster', 'sunrise'] },
  'Trời sáng (đêm sang ngày).', 'Chim sớm hót ran, có thể kèm gà gáy xa.');
s('amb.dusk', 'watch', 2, 1, '2–4 s', { cd: 60000, spatial: false, vol: 0.5, kw: ['dusk', 'evening', 'night', 'crickets'] },
  'Trời tối (ngày sang đêm).', 'Dế bắt đầu kêu, một tiếng cú.');

// ---------------------------------------------------------------------------
// NỀN MÔI TRƯỜNG — lặp liền mạch, tự chuyển theo nơi đứng, giờ và thời tiết
// ---------------------------------------------------------------------------
const BED: [string, 1 | 2 | 3, string, string, string[], string?][] = [
  ['meadow', 1, 'Ban ngày, ngoài trời, ở cỏ, đồng cỏ, đồi, đường.', 'Gió nhẹ qua cỏ, côn trùng xa. Không có chim nổi bật (chim đã có ở amb.bird).', ['meadow', 'field', 'grass', 'day'], undefined],
  ['forest', 1, 'Ban ngày trong rừng.', 'Lá xào xạc trên cao, không khí kín.', ['forest', 'woods', 'leaves', 'day'], undefined],
  ['night', 1, 'Ban đêm, ngoài trời, ở cỏ, rừng, đồi, cát.', 'Dế và côn trùng đêm, đều.', ['night', 'crickets', 'insects'], undefined],
  ['marsh', 2, 'Ở đầm lầy, cả ngày lẫn đêm.', 'Côn trùng dày, bong bóng bùn.', ['swamp', 'marsh', 'bog', 'bugs'], undefined],
  ['snow', 2, 'Ở tuyết và băng.', 'Gió lạnh rỗng, không có sự sống.', ['snow', 'cold', 'arctic', 'wind'], undefined],
  ['ash', 2, 'Ở tro, đất cháy, gần dung nham.', 'Gió khô, than lách tách, ầm ì rất trầm.', ['ash', 'volcanic', 'ember', 'lava'], undefined],
  ['ruins', 2, 'Ở vùng độc và xưởng đúc.', 'Rỗng, có tiếng ù điện xa và gió lùa qua ống.', ['ruins', 'industrial', 'abandoned', 'drone'], undefined],
  ['rain', 1, 'Trời mưa hoặc bão, đứng ngoài trời.', 'Mưa đều trên đất và lá.', ['rain', 'loop'], 'rain'],
  ['rain.roof', 1, 'Trời mưa hoặc bão, đứng dưới mái.', 'Mưa gõ trên mái, nghe từ bên trong.', ['rain', 'roof', 'interior', 'indoor'], undefined],
  ['wind', 1, 'Luôn có ở mức nhẹ; mạnh ở núi tuyết và khi bão; rất nhỏ khi ở trong nhà.', 'Gió thổi đều, không có cơn giật.', ['wind', 'loop', 'breeze'], 'wind'],
  ['surf', 1, 'Cách biển dưới sáu ô; càng gần càng lớn.', 'Sóng vỗ bờ, đều.', ['surf', 'waves', 'ocean', 'shore', 'beach'], 'surf'],
  ['room', 2, 'Đứng trong nhà có mái.', 'Tiếng phòng kín, rất khẽ.', ['room', 'interior', 'tone', 'indoor'], 'room'],
  ['ragnarok', 1, 'Trong Ragnarok; mức nhẹ hơn ở giai đoạn nguy hiểm.', 'Ầm ì rất trầm, liên tục, gây bất an.', ['rumble', 'drone', 'doom', 'dark'], 'rag'],
  ['sea', 2, 'Khi đang ở trên tàu sơ tán ngoài biển.', 'Sóng lớn, thân tàu kẽo kẹt.', ['sea', 'ship', 'boat', 'deck'], undefined],
  ['title', 2, 'Ở màn hình chính, sau lần bấm đầu tiên.', 'Gió và sóng xa, một nền nhạc rất mỏng nếu có.', ['title', 'menu', 'theme', 'intro'], undefined],
];
for (const [k, prio, when, sound, kw, synth] of BED) {
  s(`bed.${k}`, 'watch', prio, 1, '20–40 s, lặp liền', { synth, vol: 0.5, kw: [...kw, 'ambience', 'loop'] }, when, sound);
}

// ---------------------------------------------------------------------------
// TIẾNG CHẠY LIÊN TỤC — gắn với trạng thái thật: hết nhiên liệu thì im
// ---------------------------------------------------------------------------
const LOOP: [string, 1 | 2 | 3, string, string, string[], Opt][] = [
  ['campfire', 1, 'Lửa trại hoặc cột đuốc đang cháy ở gần.', 'Lửa củi lách tách.', ['campfire', 'fire', 'crackle'], {}],
  ['furnace', 1, 'Lò nung (cả lò lớn) đang chạy ở gần.', 'Lửa lò gầm, ống thổi.', ['furnace', 'forge', 'roar'], { synth: 'furnace' }],
  ['refinery', 2, 'Máy lọc đang chạy ở gần.', 'Chất lỏng sôi, van xì.', ['refinery', 'boil', 'bubble', 'steam'], { synth: 'refinery' }],
  ['pump', 2, 'Bơm dầu đang chạy ở gần.', 'Bơm cơ khí nhịp chậm, nặng.', ['pump', 'piston', 'oil'], { synth: 'pump' }],
  ['generator', 1, 'Máy phát điện đang chạy ở gần.', 'Động cơ nổ đều.', ['generator', 'engine', 'motor', 'hum'], { synth: 'generator' }],
  ['recycler', 3, 'Máy tái chế đang chạy ở gần.', 'Máy nghiền quay.', ['grinder', 'shredder', 'recycle'], {}],
  ['wildfire', 2, 'Có cây hoặc cỏ đang cháy trong tầm nhìn.', 'Đám cháy lớn, gầm và nổ lách tách.', ['wildfire', 'blaze', 'burning'], { range: 600 }],
  ['bike.idle', 1, 'Đang ngồi trên xe máy, đứng yên.', 'Máy nổ không tải.', ['motorcycle', 'idle', 'engine'], { spatial: false }],
  ['bike.run', 1, 'Đang chạy xe máy; cao độ tăng theo tốc độ.', 'Máy kéo ga đều.', ['motorcycle', 'drive', 'engine', 'rev'], { spatial: false }],
  ['cart', 2, 'Đang kéo xe và di chuyển.', 'Bánh gỗ lăn, trục kẽo kẹt.', ['cart', 'wheel', 'wagon', 'roll'], { spatial: false }],
  ['heartbeat', 1, 'Máu dưới 28; càng thấp càng lớn.', 'Nhịp tim trầm, đều.', ['heartbeat', 'heart', 'pulse'], { spatial: false, bus: 'ui' }],
  ['geiger', 2, 'Đứng trên đất độc hoặc phóng xạ đang trên 25.', 'Máy đo lách tách.', ['geiger', 'radiation', 'counter'], { spatial: false, bus: 'ui' }],
];
for (const [k, prio, when, sound, kw, o] of LOOP) {
  s(`loop.${k}`, 'loop', prio, 1, '4–12 s, lặp liền', { vol: 0.55, kw: [...kw, 'loop'], ...o }, when, sound);
}

export const SFX_SLOTS: readonly SfxSlot[] = rows;
export const SFX_SLOT: Readonly<Record<string, SfxSlot>> = Object.fromEntries(rows.map(r => [r.id, r]));
export type SfxSlotId = string;

/** Audio file types the game will load. */
export const SFX_EXTENSIONS = ['ogg', 'mp3', 'wav', 'm4a'] as const;
/** Canonical file name of take `take` (1-based) of a slot. */
export const sfxFileName = (id: string, take: number, ext: string) => `${id.slice(0, id.indexOf('.'))}/${id}__${String(take).padStart(2, '0')}.${ext}`;
/** Slot id carried by a file path under public/sfx, or null when the name does not follow the rule. */
export function slotOfFile(path: string): string | null {
  const m = /(?:^|\/)([a-z0-9._]+?)__\d+\.[a-z0-9]+$/i.exec(path.replace(/\\/g, '/'));
  return m ? m[1] : null;
}

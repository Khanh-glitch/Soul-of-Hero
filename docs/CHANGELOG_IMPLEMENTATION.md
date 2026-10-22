# Implementation changelog

## 2026-07-16 — Mouse aim, Archer input buffer và Sword trigger visual

- Gameplay click snapshot tọa độ world sau GUI dispatch; LMB/RMB ưu tiên enemy
  hợp lệ gần con trỏ, giữ line-of-sight/range và fallback về auto-aim theo hướng
  trỏ. Keyboard/controller/remote vẫn dùng facing, không bị con trỏ đứng yên chiếm
  quyền ngắm.
- `aim_assist` trở thành runtime setting thật: slider Settings được mở và điều
  chỉnh vùng bắt mục tiêu quanh con trỏ.
- Archer giữ đúng một LMB trong `bow_attack`, kể cả tọa độ click; khi animation
  kết thúc, phát kế tiếp tự bắt đầu và không làm rơi input.
- Ba melee threat hợp lệ tự materialize Reserve Sword với visual Sword riêng;
  một Q trong lúc visual hiện sẽ Relay dù Archer đang bắn. Takeover theo đúng vị
  trí Soul Interception đang di chuyển.
- Vampire Castellan `blood_lunge` phát melee threat độc nhất; `disc_fan` không
  được tính nhầm.
- Verification: Archer runtime **86/86**, Soul Relay **50/50**, Weapon Manager
  **51/51**, Level 10 vertical/live/fresh **41/41 + 53/53 + 76/76**.

## 2026-07-16 — Core Balance V1: một lõi cho combat, progression, encounter và loot

- Hợp nhất sát thương Hero, Hero Soul, enemy contact và projectile vào một pipeline có
  named buckets, giữ full precision và chỉ round ở kết quả cuối; UI preview và runtime
  đọc cùng projection thay vì duy trì hai bộ số.
- Thay các tier/surge stat cưỡng ép bằng hai curve chung có marginal dương, giảm trơn:
  level dùng geometric decay `0.99`, stat point dùng hyperbolic decay đến đúng nửa
  hiệu lực tại point 200. Save shape, allocation, skill rank và equipment UUID giữ nguyên.
- Chuyển encounter 1–100 thành population profile có gate bất biến, mở Skeleton →
  Reaper → mutant → Vampire theo bài học; XP kill dùng budget theo canonical Easy
  population và tích lũy phần lẻ, không round-up từng quái.
- Family roll dùng ordered catalog/category metadata; test family thứ tư không cần
  branch thuật toán. Boss XP dùng role tag/metadata/group, không liệt kê boss ID.
- Thêm complexity policy cho loot xuyên suốt stage 1–100. Rarity, slot, Hero Soul và
  affix chỉ được mở khi vừa đạt lesson stage vừa có runtime consumer/entitlement; content
  mới đăng ký dữ liệu vào policy thay vì thêm nhánh riêng trong drop code.
- Arsenal hiển thị projection thật và delta “what-if” bằng cách clone save rồi chạy lại
  cùng core. Tutorial chỉ ghi nhận hành động gây damage đã xác nhận, không tính button
  press hoặc animation cue là đã học.
- Thêm invariant tests, Chapter 1 breakpoint matrix và audit keeptrack tại
  `docs/AUDIT_CORE_BALANCE_V1_2026_07_16.md`; fixture JSON từ save shape trước đợt
  balance xác nhận allocation, skill rank, equipment UUID và selected Soul roundtrip.
- Final gate: 63 configured non-MCP gates PASS; Chapter 1 matrix 536/536; canonical
  runtime/test manifest gồm 36 SHA-256 entries và 0 mismatch.

## 2026-07-16 — Continuous progression, physical loot và BookLite field UI

- Thay Results route bằng continuation chooser ngay trên gameplay: Next,
  replay/level picker để farm và Home; reward vẫn commit trước khi hiện lựa chọn.
- Thêm XP theo từng enemy với receipt idempotent, thanh XP realtime, `+XP`,
  level-up SFX và asset VFX gắn vào nhân vật. Stat/skill/Soul/gear commit trong
  Field Codex được Knight áp lại ngay trong trận.
- Thêm Easy/Medium/Hard theo từng level, stage scaling, density bonus, mutant
  deterministic và phần bù luck/rare chest/drop tương ứng.
- Thêm tám rarity dùng chung cho enemy/chest/item, jackpot boss/chest, ground
  loot có toss/land/glow và `E` pickup trước khi vào inventory.
- Dùng TravelBookLite/Free Inventory cho XP strip, Field Codex và completion.
  Codex chỉ còn hai khu: Tủ đồ & Trang bị (Hero Soul chung sáu ô, click/kéo thả)
  và Nâng cấp (stat + skill). Icon item là cutout trong suốt, tên/chức năng khớp
  hình; stack vật lý giữ name/icon/rarity/item-level trong save.
- Target và `+XP` bỏ paper/card: chữ raw theo rarity, enemy có `Tên (Lv X)` và
  máu bên dưới. Damage/combo giữ đúng glyph 3×5 cũ bằng atlas asset; chỉ tween
  vào/ra được đổi thành overscale + snap nhanh.
- Tắt CanvasModulate che tối mặc định, tăng tốc di chuyển/awareness và mật độ
  để giảm khoảng chạy trống nhưng giữ boss/objective marker không bị clone.
- Contract và balance chi tiết: `docs/CONTINUOUS_RUN_LOOT_LOOP_2026_07_16.md`.

## 2026-07-15 — Chapter 1 Level 10 Vampire Castellan vertical slice

- Promoted Level 10 to `CAMPAIGN_READY` with a dedicated 100x76 throne map and
  one distinct `vampire_castellan` runtime identity instead of two ordinary
  Vampire proxies.
- Implemented one continuous 720-HP, two-phase duel. Phase 2 begins at 55% HP
  on the same actor and adds readable Blink Lanes and a three-disc fan alongside
  Blood Lunge; lane damage is bounded and diagonal safe space is verified.
- Added persistent compact boss name/HP/phase/pattern telemetry in the existing
  center HUD slot, removed duplicate intro/phase toasts, moved ordinary toasts
  below it, and verified OpenGL captures at 847x437 and 1280x720.
- Bound the north exit to both the exact phase-transition event and the exact
  Castellan death. Player failure/retry restores full Phase 1 and deterministically
  removes every boss-owned projectile.
- Added the atomic first-clear reward: +1 Player Level, one deterministic Epic
  Sword Hero Soul Lv10, and `hero_soul_fusion`, `chapter_2_access`, plus
  `hunt_replay`. A new completed replay run receives only the smaller 120 Gold,
  2 Hero Materials, 1 Monster Fragment bounty; per-run receipts prevent callback
  or crash duplication of either reward class.
- Added the Level 10 generator, focused runner and full-regression hook. Current
  gates pass: static 41/41, live runtime 34/34, fresh AppRoot Level 1→10 route
  79/79, already-playable QA 40/40, and shared content contracts 206/206.

## 2026-07-15 — Chapter 1 Level 9 Crimson Gate vertical slice

- Promoted Level 9 to `CAMPAIGN_READY` with a dedicated reachable three-wing
  map and exactly three physical, one-use Gate Seal interactions.
- Replaced the draft Bone Reaper proxy with a production `crimson_reaper`
  EnemyDefinition, dedicated scene/runtime class, in-world nameplate, crimson
  aura, and the then-current uniform Elite projection (superseded by the
  explicit pressure-axis model on 2026-07-16).
- Deferred the named Elite until all three seals are committed. The north exit
  now requires both the counted seal objective and the exact Crimson Reaper
  death; neither seals alone nor boss death alone can complete the encounter.
- Added a deterministic first-clear Rare Sword Hero Soul Lv9 duplicate, one
  Player Level, existing economy rewards, and the `chapter_1_boss_gate` feature
  in the same idempotent campaign completion transaction. Its fixed roll uses
  two implemented combat affixes (`defense_while_attacking`, `active_power`),
  both listed on the Results screen rather than promising inactive stats.
- Added generator/schema coverage, static and live objective gates, a fresh
  AppRoot Level 1→9 route, rendered Results reward assertions, replay
  idempotency, and the Level 9 runner to the isolated full regression suite.

## 2026-07-15 — V0.4 progression, Souls, equipment and Level 6 integration

- Locked the V0.4 implementation brief for player stats/skills, eight Hero Soul
  rarities, affix/variant rules, duplicate sale/fusion and the Chapter 1 route.
- Integrated level 1–100 player progression and Hero Soul inventory/migration
  into SaveService without silently reinterpreting current saves as legacy data.
- Added auxiliary equipment inventory and Arsenal actions; equipped flat/percent
  HP, damage and mana now affect Active and Reserve Heroes in live combat.
- Added the Axe Hero production identity/data/combat implementation while keeping
  its campaign recruitment and visual provenance honestly gated.
- Authored a deterministic Level 6 vertical slice with live encounter/objective
  coverage. It remains `CAMPAIGN_DRAFT` because Level 5 cannot yet award the Axe
  Hero Soul atomically and five asset-manifest entries remain placeholder-only.
- Added a Monster Soul Level-50 rules foundation (Reaper profile, ranks, Essence,
  bonding and Severance); no save/UI/loot/combat-runtime completion is claimed.
- Added save compatibility, already-playable QA, asset validation, meta UI,
  auxiliary combat, Level 6 and Monster Soul suites to the shared regression
  runner. See `docs/IMPLEMENTATION_STATUS_V0_4.md` for the current product gate.
- Verified the final configured non-MCP aggregate gate: **PASS** in 153.9 seconds.

## 2026-07-15 — Chapter 1 roster and Hero recruitment contracts

- Locked exact, map-independent enemy rosters for campaign Levels 1-5, including
  deterministic 20%/40% camp rolls and per-archetype elite guarantees.
- Added reusable Elite gameplay/presentation data and runtime application for
  Skeleton Swordsman and Bone Reaper without enlarging their collision shapes.
- Replaced Bone Reaper's blue spectral-disc body with the four-frame Floating
  Skull asset while preserving its outbound/return damage behavior.
- Locked the Level 5 Axe miniboss recruitment, Levels 5-10 Sword+Axe escape phase,
  Soul Hero/Soul Relay unlock transaction, and Level 15 Hooded Archer recruitment.
- Added roster, progression and VFX suites to the shared non-MCP regression gate.

## 2026-07-14 — SOUL OF HERO Sword production pass

- Pivoted production identity/data/UI/save/MCP state from Hand/Weapon Spirit to
  Hero/Soul Relay; Sword is the only approved production Hero.
- Added the approved four-hit Sword combo and Soul Echo Active Skill, including
  Relay summon/takeover/departure ownership and debug-only test reserve.
- Fixed combo animation stability with dedicated 4/6/10/10-frame strips,
  restart-at-frame-zero semantics, locked authored facing and identical local /
  MCP input buffering.
- Added the real 150 px Crescent Recoil wave, 48 px recoil and distance-aware
  Pursuit Execution so Combo 4 can cross a living target at the far wave range.
- Soul Echo now queues when activated during an already-running combo attack and
  synchronizes its Combo 4 X-hit to Sword's distance-aware crossing.
- Temporarily disabled all audio playback, including a muted Master bus, while
  retaining cue contracts and settings for a later licensed audio pass.
- Current release gate: 662 numbered non-MCP checks plus MCP lifecycle,
  bidirectional and reconnect smoke tests.

## 2026-07-14 — AppRoot full-game shell + Training enemy roster

### Implemented

- Replaced the normal direct-to-sandbox entry with `AppRoot` and an `AppFlow`
  route: Boot → Title → Hub → Training Details → Gameplay → Training Results.
  Test arguments and authenticated MCP sessions still direct-load gameplay so
  existing automation remains deterministic.
- Added a five-tab Hub: Campaign, Arsenal, Modes, Bestiary and Settings.
  Campaign explicitly reports **0/20**, renders missing campaign content as
  unavailable, and keeps the playable dungeon labeled Training/Test Build.
- Added functional loadout editing in Arsenal, locked-state explanations in
  Modes, a static three-entry Training Bestiary, Settings and Credits.
  Training Results exposes Retry, Arsenal and Hub routes without pretending to
  commit campaign rewards or unlock a next level.
- Added a debug/editor-only `MỞ RÌU SÂN TẬP` action so Axe full-character swap
  can be tested before a real campaign Level 5 exists. The control is hidden in
  release builds and is not recorded as a campaign reward.
- Localized the player-facing shell, loadout details, weapon descriptions,
  Training/Results copy, HUD controls and combat toasts to Vietnamese while
  preserving stable internal IDs and MCP payloads.
- Fixed Axe run→attack scale perception: charge now holds the upright authored
  `AttackNoMovement` wind-up and release restarts that same four-frame strip at
  the stable 75% character-form scale. The low 28 px Attack2 anticipation no
  longer appears as an accidental shrink.
- Integrated the user-approved Training roster: Skeleton Swordsman as melee
  chaser, Skeleton Reaper as a ranged/mobile returning-disc controller, and
  Blood Vampire as a telegraphed lunge/leech/Spirit disruptor. All three use
  authored lateral L/R presentation plus `flip_h`; gameplay targeting remains
  top-down 360 degrees.
- Reaper discs now commit to the direction shown by the telegraph instead of
  retargeting at cast time. Vampire leech and one-step Spirit drain now require
  confirmed player damage, so Dash/i-frame avoidance cannot feed the Vampire.
- Training victory has one route authority: gameplay pauses on the victory
  overlay and enters Results only after the HUD Continue action. Product-run
  defeat likewise remains on the decision overlay instead of auto-respawning.
- Isolated smoke and Axe suites onto dedicated `user://tests/` save paths so QA
  and visual capture no longer mutate the player's real local profile.
- Expanded validated/persisted settings and progression reset that preserves
  settings. The panel applies Master/Music/SFX volume and fullscreen (the UI
  bus currently has no separate slider);
  gameplay load applies joystick opacity/size, button scale and left-handed
  layout; enemies apply telegraph palette and high contrast.
- Added `default_bus_layout.tres` with Master, Music, SFX and UI buses as a
  routing foundation. No shippable music/SFX clips or gameplay cue wiring are
  claimed.
- Audited all 31 ZIP archives in Downloads for enemy/HUD/VFX candidates. The
  existing Shikashi atlas remains the primary HUD/app-shell icon source; the
  Pixel_Poem Swordsman/Reaper/Vampire sheets form the Training roster.

### Verification

- Save/Unlock/settings contract: **72/72 passed**.
- Axe/Knight integration contract: **33/33 passed**.
- Enemy roster contract: **56/56 passed**.
- UI shell contract: **53/53 passed**.
- Full numbered non-MCP regression after AppRoot: **563/563 passed**.
- MCP lifecycle/auth/schema/subscription/bidirectional/reconnect suites: passed.

### Deliberately not claimed as complete

- Campaign remains **0/20**. Training is not Chapter 1 Level 1, and the 20
  missing cards are not implemented levels.
- The UI is a functional full-game-shaped shell, not proof that Forge, Parts,
  Mastery, Hunt, Challenge, Depth, campaign Bestiary/discovery or campaign
  Results/rewards exist.
- Audio routing exists, but audio content and gameplay/UI cue wiring are still
  absent. Shake, vibration, damage numbers, aim assist, UI scale and reduced
  effects/motion are disabled and visibly marked `SẮP CÓ`; production font,
  string-table localization and device accessibility QA remain gaps.
- Enemy behavior remains prototype content: no runtime encounter runner,
  production Elite/Boss, data-resource profiles for every enemy, final VFX/SFX,
  drops or campaign balance pass.

## 2026-07-14 — Phase 3 / Axe vertical slice + typed content foundation

### Implemented

- Added the data-driven Axe definition and a tested Hand loop: hold/release
  Heavy Cleave, reduced movement while charging, charge-scaled damage/arc/
  stagger, and a quick-release branch.
- Added Throw & Recall with outbound/return travel, manual and automatic
  recall, moving return target, world collision handling, Cross Cut stagger,
  and normal Attack lock while the Axe is away. Movement and Dash remain
  available during the throw.
- Added the Axe Spirit Follow-through trigger from confirmed Hand-skill
  resolution. It requires a meaningful endpoint and deduplicates by source
  weapon plus skill-instance receipt instead of responding to raw input.
- Integrated the selected `AxeWarriorRPG` Colour1/Outline character form as
  30 canonical animation sheets with 149 source frames. Source-manifest
  timing/loop metadata drives its `SpriteFrames` library instead of duplicating
  animation timing constants in gameplay code.
- Equipping Axe in Hand now swaps the full player presentation to
  `axe_warrior_rpg`; moving Sword or Bow back to Hand restores `free_knight`.
  The swap preserves the existing `CharacterBody2D`, collider, camera, world
  position and facing, and hides the separate Hand weapon visual while Axe is
  baked into the active character raster.
- Normalized the wider Axe source form to a 75% presentation scale with its
  own rest anchor, preserving the same foot baseline while leaving physics and
  world transforms unchanged. Returning to FreeKnight restores scale 1.0.
- Exposed the active `character_form` ID, animation library, animation/frame
  and baked-Hand-weapon flag through realtime player state so local MCP/Live
  Sync consumers observe the same form as the running game.
- Integrated Axe save/unlock/loadout validation, HUD fallback and a
  campaign-level-5-gated reward authority. This is an unlock contract only;
  no campaign Level 5 scene or reward flow is claimed.
- Added typed `EnemyDefinition`, encounter spawn/group/wave/warning/objective/
  completion contracts, `LevelDefinition` and `LevelRegistry`, with strict ID,
  dependency, campaign-index and SANDBOX isolation validation.
- Added representative Skeleton/Crypt resources marked development-only,
  `SANDBOX` and campaign slot `0`; they are authoring/test fixtures, not
  completed campaign content.
- Added game-flow, UI/UX, feature-unlock, balance, content-pipeline,
  generated-asset-prompt and asset-audit documentation for the next production
  plan.

### Verification

- Gameplay/map regression: **75/75 passed**.
- Input Map contract: **40/40 passed**.
- WeaponManager contract: **51/51 passed**.
- Weapon effect contract: **25/25 passed**.
- AxeWarriorRPG character-form asset contract: **68/68 passed**.
- Save/Unlock smoke: **40/40 passed**.
- Integrated Living Arsenal runtime: **23/23 passed**.
- Axe/Knight integration: **31/31 passed**.
- Axe combat/resource contract: **19/19 passed**.
- Typed content contract: **48/48 passed**.
- Total deterministic non-MCP checks: **420/420 passed**.
- MCP lifecycle/auth/schema/subscription, semantic action, bidirectional map
  sync and reconnect suites: passed.
- Headless editor/project parse: exit code `0`.

### Deliberately not claimed as complete

- The project remains at **0/20 completed campaign levels**. The current map
  is a development sandbox, not an accepted Chapter 1 level.
- There is no runtime encounter runner or complete Boot/Title/Hub/Loadout/
  Results shell yet. Typed content resources do not by themselves constitute
  playable campaign content.
- AxeWarriorRPG now supplies the Axe character/action raster, but it is a
  side-view two-direction source used inside a top-down game. Production still
  needs scale/readability acceptance, top-down directional coverage or an
  explicit two-direction art decision, and weaponless throw/recall/catch frames
  so the baked Axe does not duplicate while the projectile is away. Axe
  Spirit/projectile/reward VFX and audio remain code-native or placeholder.
- The wider Forge, Parts, mastery, rarity/affixes, modes, accessibility and
  Android release work remains on the roadmap.

## 2026-07-14 — Phase 1–2 / Living Arsenal Sword + Bow vertical slice

### Implemented

- Migrated player-facing input to semantic `attack`, `skill`, `dash`,
  `spirit_swap_1`, `spirit_swap_2`, `interact` and `pause` actions for
  keyboard, mouse, joypad, touch controls and MCP action dispatch. Legacy
  action names remain as unbound compatibility aliases.
- Added explicit player states for idle, movement, attack, skill, dash, hurt,
  swap, interact and death without removing the existing top-down physics,
  health, animation and checkpoint behavior.
- Added data-driven `WeaponDefinition`, attack/skill/trigger/action profiles,
  target rules and `WeaponManager` with one Hand slot, gated Spirit slots,
  queued direct swap, a 0.25-second transition and 1.5-second shared cooldown.
- Authored Sword and Bow resources. Sword now has a three-hit 18/20/32 combo,
  Dash Slash and the three-confirmed-attack Flying Sword Spirit. Bow now has
  delayed Falling Arrow, Triple Piercing Volley and the reverse-Dash Piercing
  Shot Spirit.
- Added shared targeting/damage helpers and independent Falling Arrow,
  Piercing Arrow and Flying Sword effect scenes. Spirit progress is driven by
  confirmed gameplay instances/events instead of button presses.
- Added code-native Hand/Spirit weapon visuals, a tutorial-gated Bow reward in
  the east corridor and durable reward handling that unlocks and equips Bow once.
- Added save schema v1 with atomic temp/backup writes, corruption recovery,
  v0→v1 migration and idempotent transactions. Added `UnlockService` and
  validated ID-only loadout persistence.
- Added event-driven Level 1 onboarding for movement, Sword Attack, Dash
  Slash, Dash, Bow reward, Bow Spirit and Hand/Spirit swap. Completed steps
  persist and do not replay.
- Added compact weapon HUD state for Hand attack/skill, Spirit trigger/action
  cooldown and swap cooldown; remapped the mobile surface to
  Attack/Skill/Dash/Spirit.
- Extended `GameEvents`, realtime player state and authenticated MCP
  `trigger_action` support for the semantic weapon loop.
- Registered `bow_reward` in the level schema/runtime entity registry and
  regenerated the canonical map to 30 entities without changing its 3,136 /
  756 / 24 Backdrop/Geometry/Decor cell counts.

### Verification

- Input Map contract: **40/40 passed**.
- WeaponManager contract: **41/41 passed**.
- Weapon effect contract: **8/8 passed**.
- Save/Unlock smoke: **35/35 passed**.
- Integrated Living Arsenal runtime: **19/19 passed**.
- Existing gameplay/map regression: **75/75 passed**.
- MCP lifecycle, authentication, semantic action, bidirectional map sync and
  reconnect suites: passed.
- Headless editor/project parse: exit code `0` after integration.

### Deliberately not claimed as complete

- At the end of Phase 1–2, Sword and Bow formed a tested vertical slice, not
  the complete game. Axe and typed content contracts were added later in the
  Phase 3 slice above.
- The full Boot/Title/Hub/Loadout/Results flow, runtime encounter execution and
  all 20 Chapter 1–2 campaign levels remain unimplemented.
- Monster Forge, Parts, mastery, rarity/affixes, crafting, Hunt, Challenge,
  Depth, Bestiary, production audio/VFX, accessibility and Android export
  remain roadmap work.

## 2026-07-14 — Phase 0 / true top-down dungeon rebuild

### Implemented

- Replaced the filled 100×56 backdrop and long platform-like wall strips with
  a connected room/corridor footprint and three inner pits.
- Canonical level now contains 3,136 floor cells, 756 perimeter collision
  cells, 24 decor cells and 29 configured entities; all cells serialize in a
  deterministic order.
- Added 0x72 DungeonTileset II v1.7 under CC0 with an auditable third-party
  notice. Runtime TileSet source `0` is the 32×32 full atlas; source `1` is the
  12×4 low-wall atlas.
- Updated level validation and runtime loading for multiple atlas sources.
- Extended authenticated local realtime editing and MCP `set_tile` /
  `save_runtime_map` to `Backdrop`, `Geometry` and `Decor`, while retaining
  `Geometry` as the backward-compatible default.
- Extended the Godot Live Sync dock with a three-layer selector; Pull, Push and
  auto-watch follow the selected layer and preserve the rest of the document.
- Kept authored JSON key order, added short Windows `EBUSY` rename retries and
  verified conflict-safe write/restore behavior.
- Replaced the prototype touch D-pad with an analog virtual joystick, kept the
  semantic Attack/Skill/Dash/Spirit buttons, hid them on desktop, and added
  `GODOT_FORCE_TOUCH_CONTROLS=1` for desktop touch testing.
- Reduced desktop sync HUD height, made floor cracks sparse, and added grounded
  shadows beneath Knight and skeleton actors.
- Added `tools/map_overview.tscn` for a HUD-free full-map composition preview.
- Imported the Living Arsenal master specification and added an evidence-based
  project audit plus phased product roadmap.

### Verification

- Godot gameplay smoke: **75/75 passed**, including floor connectivity and
  validation that every configured entity is on walkable floor.
- MCP lifecycle, authentication, schema failures and subscriptions: passed.
- Three-layer runtime ↔ JSON bidirectional sync and reconnect: passed.
- Canonical level SHA-256 remained unchanged across the final MCP test round.
- Godot headless editor/plugin parse: exit code `0`.
- Final gameplay and map-overview captures completed without script errors.

### Deliberately not claimed as complete

- This sandbox is not campaign Level 1 and the project remains at 0/20 complete
  campaign levels under the Living Arsenal acceptance definition.
- High back walls, authored doorway modules and foreground occlusion/y-sort are
  the remaining visual debt for this map milestone.
- At the end of Phase 0, Hand/Spirit weapons, campaign flow, save progression,
  Hub, Forge, Hunt, Challenge and Depth remained future roadmap work. Sword,
  Bow and the save/unlock foundation were added later in Phase 1–2; the Axe
  slice and typed content foundation were added in Phase 3. The remaining
  product systems are still outstanding.
# 2026-07-15 — Chapter 1 Level 7 playable Beacon defense

- Added the dedicated `The Failing Beacon` four-lane crypt arena using only
  existing project assets.
- Added a real 900-HP Soul Beacon, compact health/wave HUD, three timed mixed
  waves (12 Skeleton Swordsmen + 4 Bone Reapers), objective-targeting AI, a
  visible defeat/retry route and an encounter-locked north exit.
- Kept `EncounterRuntimeState` as the gate authority: all sixteen enemies must
  die and the controller must report `soul_beacon_survived`; Beacon death grants
  no core, completion or campaign reward.
- Promoted Level 7 to `CAMPAIGN_READY` only after focused map/runtime gates and a
  fresh Level 1→7 route through real AppRoot, live gate, HUD Continue and Results.
- Campaign completion now applies each LevelDefinition feature grant inside the
  same atomic reward transaction. Reconciliation v4 repairs declared Level 6/7
  features for already-completed profiles without replaying currencies.
- Verification: Level 7 static **74/74**, live success/failure, both enemy
  threats and compact/desktop HUD **41/41**, fresh AppRoot defeat/retry/success
  promotion route **66/66**, campaign entry
  exact-once smoke **357/357**.

# 2026-07-15 — Chapter 1 Level 8 playable Divided Reliquary

- Added a deterministic forked Reliquary map using only existing project assets:
  two physical branch seals, separate Reaper/Vampire halls, one Elite vault, one
  manually opened chest and one encounter-controlled exit.
- Deferred all nine branch actors until the player chooses. Reaper spawns exactly
  six Bone Reapers; Vampire spawns exactly three Blood Vampires; the other branch
  is physically sealed and never instantiated or counted as defeated.
- Applied the existing `triple_stat_elite` compatibility ID to exactly one
  selected guardian. Its current runtime behavior is the explicit pressure-axis
  projection, not the original uniform scalar.
- Branch clear only unseals the chest. The chest's real `opened` signal grants the
  in-run sigil and records `elite_chest_claimed`; no kill-only or auto-loot path
  can open the north exit.
- Added one deterministic first-clear Epic auxiliary item at Level 8. The
  current reward contract resolves that item as a Soul Vessel. Results renders its
  rarity, slot, level, primary and affixes; it is not auto-equipped over the
  player's current Trace. Replay grants no duplicate level, currencies or UUID.
- Promoted Level 8 to `CAMPAIGN_READY` after static **62/62**, both-branch live
  runtime **70/70**, fresh Level 1→8 AppRoot/Results/replay **59/59**, campaign
  entry smoke **402/402**, and retained Level 7 static/live/route gates
  **74/74 + 41/41 + 66/66**.

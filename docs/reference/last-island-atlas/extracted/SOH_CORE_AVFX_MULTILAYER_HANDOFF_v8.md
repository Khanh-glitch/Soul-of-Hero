# SOH CORE × AVFX — Corrected multiscale visual/gameplay binding (v8)

## Source correction and status
- **Current VFX reference:** [`arena/3337c864-soul-of-hero`](https://github.com/Khanh-glitch/Soul-of-Hero/tree/arena%2F3337c864-soul-of-hero), pinned SHA `3158f0c427570794e6d69fe72c1f701b26ceb384` (2026-11-04). Not old AVFX PR28/30.
- Branch contains index for 244 PixelFX, 20 registered ARCANA Gold presenters, Web unified compositor/FX Lab, 6 authored redesign studies, fusion recipes, QA. Latest commit explicitly addresses playback frame-jank with 1 sim-step cap and throttled real world region readback. Read true current source and CI, not old PR handoff to declare status.
- 244 PixelFX is a *library inventory*, 20 ARCANA slots are *high-end presentation packages*, 21 is *input actions described by Creator* (7 Cores×3 actions). **None equals the total number of actual visual/game-state effect instances.** A single input can trigger arbitrarily many child instances, statuses, terrain changes and loot grants. No magic target number is established.
- Confirm per-ARCANA latest art acceptance separately from working runtime: `ARCANA20_BATCH_STATUS.md` has historical labels SOURCE_PREVIEW/FUSION_PREVIEW/REDESIGN_STUDY, and later technical QA notes. Do not infer unfinished branch from old labels alone, nor claim user-approved Gold solely from technical green.

## Proper architecture: one action → typed event graph, not one sprite

Input (LMB/Q/E) → aim preview/commit → **gameplay transaction** (debit appropriate energy; authorize cast) → spawn durable event ID(s) → VFX compositor reads events and materials on world → gameplay spatial/hit/status/AI/terrain systems update independently → world/visual aftermath lifecycle → drops and save/relaunch.

**VFX's scope:** anticipation, tracers, lines/ribbons, trails, impact geometry, shock/flash, on-character frost/burning marks, terrain material-linked lighting, summoned object sprites, post impact smoke/fissure/thaw, floor deformation/real-world sampling, occlusion, clipping, OUT. **Gameplay's scope:** collision/damage, target selection, knockback, invulnerability, map tile material, pickups, enemy movement, UID, loot, timers, seed, rollback and save. Separate clocks when visual timeline differs from physical status duration.

## 7 Core identities / 21 input actions / open effect cardinality

| Family | Core | Rarity per user | LMB | Q | E |
|---|---|---|---|---|---|
| Fire | Vụ nổ lớn | Thường | Ria tiểu liên | Bom hẹn giờ + mảnh lửa | Đạn lửa xuyên rạn + nổ rộng |
| Fire | Thiên thạch | Hiếm | Hỏa cầu | Thiên thạch đơn + cháy dai | Mười thiên thạch toàn màn, nhiều đợt |
| Fire | Hơi thở của rồng | Cực phẩm | Đứng yên phun lửa | Lốc xoáy lửa hút/quét | Rồng xuyên quái, gom và bổ nhào gây 20% tổng HP còn lại |
| Nature | Hơi thở đất mẹ | Thường | Chọi đá đẩy lùi | 10 cây thật giam quái rồi thành gỗ | Vòng đất→cỏ 10s, rễ trồi trói/đánh |
| Nature | Lõi búa Mjolnir | Hiếm | Quyền sét lan | 5 đợt sét trong vùng chọn | Lõi điện hút + sét AOE |
| Water | Gươm Elsa | Hiếm | Phi tiêu băng nổ trên điểm dừng | Bất tử đóng băng bản thân 1s, đóng băng quái tiếp cận | Đóng băng toàn vùng màn hình và địa hình |
| Spirit | Lõi quỷ | Hiếm | Tia năng lượng | Đứng yên chưởng tia theo hướng | Biến mất và dịch chuyển đến điểm chọn |

**User's 7 Core ≠ old 4 core compatibility.** Do not hard-delete/rename old Ember, Quake, Storm, Rime UID. Map to new variants only with migration evidence, visual equivalence and explicit decision; otherwise keep old as legacy while testing new.

## 13 audit channels per action

- Aim: valid aim geometry and selected target; Q/E hold preview and release behavior.
- Telegraph: onset, delay, readable dangerous area, per-meteor/per-strike warning.
- Caster: pose/locked movement, channel or self-shield.
- Travel: spawned projectile/object movement, angle and spatial extent.
- Hit: collision, damage, impact shape, hit-stop not preceding actual hit.
- Status: burn/freeze/slow/chain/pull/invulnerability/stealth with distinct timers and immunity.
- Terrain: water→ice, soil→grass, flames and fissures all alter actual material/physics, not a dark floor image.
- Object: real trees/bomb/meteors/vortex/dragon/shard/ice shell with collision and unique identity where applicable.
- Ambient: real terrain response at day/night, not ambient dark rectangle imported from AVFX lab.
- Audio: cue matches phase and enemy status, no 10 impacts compressed into one fake sound.
- Aftermath: char, slow thaw, temporary scar, root fading, pickup handoff; potentially lasts beyond the source VFX clip.
- Cleanup: every child instance ends correctly, no leftover after OFF/cancel/save/replay.
- Overlap: two active skills interact with rain/ice/fire/electricity without nondeterministic duplicate awards or duplicated damage.

## Key special cases requiring full semantic design

**Ten trees:** create 10 real, temporary, authorized tree entities; each becomes one legal wood pickup at t=3s, once only. If chopping trees before expiry is supported, consumption and conversion share source custody so no duplication. Compare wood gain to refined energy cost to avoid free forestry. Tree collision and pathfinding must be real.

**Dragon:** user requests a second hit carrying exactly 20% of sum of remaining HP of the included enemy population. Define population snapshot (visible valid targets at commitment) and allocation: recommendation `secondaryDamage_i = 0.20 * remainingHP_i` for each included enemy, so `Σdamage = 0.20 ΣremainingHP` before target resistance; separate boss mitigation requires Creator approval because it could contradict the user formula. Never let one stray enemy inherit the combined HP damage of all enemies.

**Ice screen:** "toàn màn hình" is a caster-time camera rectangle anchored in world, not an infinite field that follows the camera. Freeze live water navigation/actors/physics and restore deterministically. A newly panned viewport must not freeze the world for free.

**Meteor rain:** exactly 10 cast-owned meteor objects with individually seeded positions, variable staggered groups, legal target placement and telegraph, independent damage/afterburn receipts. Timing randomness must replay identically on same world-seed/cast-id.

**Spirit blink:** target validation against world colliders/locked POI gates, no unauthorized teleport into Blue/Purple rooms or beyond loaded world. AI reacquisition based on actual stealth state and LOS. Do not use only disappearance alpha on player sprite.

**Fire vortex / thunder attractor:** pull is a real applied force/displacement with collision; never pull fixed structures or trigger infinite oscillation. Targeting updates in world coordinates independent of visuals.

**Q/E controls:** E presently has interaction role in Web, F has cart role (verify latest). Proposed control contract: `LMB` basic, `Q hold→aim→release` skill1, `E hold→aim→release` skill2, with a remapped INTERACT key and UI prompts; do not silently remove interaction or cart. Hold previews cost and target; canceled/wrong/blocked aim does not consume energy. Commit/debit has one invariant time relative to authoritative action.

## Actual asset sourcing, NOT loose name matching

PixelFX confirmed identifiers from `web/src/game/pixelfxMap.ts` and `web/README_PIXELFX.md`: `arcane/spell-charge`, `fire/fireball`, `explosions/small-explosion`, `nature/quake`, `lightning/chain-lightning`, `ice/frost-nova`, `ice/ice-lance`, `moves/ice-lance-throw`, `impacts/impact-frame`, `arcane/arcane-orb`, `shadow/black-hole`.

ARCANA motif candidates by semantic families (not an assertion exact effect matches user request): Meteor Loom #03 for meteor, Furnace Wyrm #02 for dragon, Rootwake #13/Worldseed #16 for trees, Thunderloom #10/Chain Verdict #09 for lightning, Mirrorfrost Basilica #07 for ice, Event Horizon #17/Reality Ripper #20 for spirit. Compare actual approved frames/timeline, do not merely substitute whole ARCANA lead for a different action. Some candidates may only supply a primitive like ring or arc, not a full skill.

**Binding must be keyed by** skill, action, phase, source-ID, geometry, coordinate system, original palette/alpha, scale factor, onset, peak, duration, fade/OUT, lighting, occlusion, world-state linked material response, night/day and FPS budget. Every source port must preserve source draw order and world sampling. Never copy the dark lab floor or a large opaque backdrop into real SOH terrain.

## Integration and acceptance

1. Re-index `assets/pixelfx_foundry/index.json`/`web/pixelfx-assets/index.json` (244) at current SHA with verified IDs, content hash, source license, family/time/frame shape and sample thumbnails. The index file is large; not every frame was fetched for this external audit. Don't claim an ID was personally reviewed if not.
2. Read existing ARCANA source, semantic/fusion recipes, compositor and latest branch tests. Identify which of 20 Gold leads/candidates is approved for each new Core signature, with Creator review when it changes gameplay/art from an established Gold.
3. Author event→VFX binding tables with 13 audit layers for each action, every dynamic instance typed and linked to actual gameplay/event receipts; use `CORE_21_ACTION_LAYER_QA.csv` as checklist, NOT a count of guaranteed effect instances.
4. Current game visual QA: 640×360 and 1280×720, exact camera + world materials (grass/water/roof/creatures), day/night, 1/3/10 overlapping events, pause/backward-seek/replay, OFF, screenshot matched onset/impact/aftermath. `0 page errors` and CI green do not alone establish interaction or art acceptance.
5. Gameplay QA: each Core body, six-energy material cost, charges/consumption, route, aim invalid/valid, AI state, environmental reversibility vs lasting damage, loot items, persistence/offline, death bag UID, economic anti-farm; no standalone art test substitutes for this.

**Audit outcome right now:** the right VFX repository and actual source found; 7 Cores and 21 actions indexed at behavioral level. VFX assignments are provisional candidates; the actual 244-manifest-wide frame-by-frame audit and full 21-action implementation have NOT been performed in SOH in this dossier. Preserve that honesty for the next Agent.

# Last Humanity takeover — NOT a production-completion handoff

**Overall: PARTIAL. Release criterion NOT met. No unavoidable external blocker established.**
This is implementation evidence, not another NPC rulebook. Bible and Survivor Contract remain authoritative.
No production PR was merged. Creator visual acceptance is still required and is not asserted.

## Source custody

- Session branch: `arena/9025bfde-soul-of-hero` (fixed Arena branch).
- Checkout initially: `82089fea0b28ad1662f9f04496271b92c74c03a7`, clean.
- Requested development branch exists remotely at audited `9c73c8d652c204e3e5b1e01d46c61c626bffe310`.
- Fetched that exact commit and fast-forwarded **this** branch to inherit existing implementation, assets and source contracts. No reset/rebuild; no branch switch.
- Source/test revision for the final focused checks and production build: **`d85354097b9bf6ce117f11c20a34d5a355d5f6c9`**. Subsequent handoff commit adds evidence only.
- GitHub lookup during takeover found PR #61 and #64 OPEN, not merged to main. Their content is in the inherited development history; PR status is not evidence of production acceptance.

## Implemented corrections in this takeover

| Source | Correction and rationale |
|---|---|
| `humanworld.ts::humanConsume` | One consumed food item grants one serving, not the whole stack. Charged water debits one charge and retains the empty vessel UID; non-vessel hydration debits one item. Dead/downed/evacuated cannot self-consume. |
| `reachableHumanStores` / `treatHuman` | Community permission is separate from access: require actual loaded object, same floor, distance and physical line. No remote community medicine/food/water. This is NOT a global logistics implementation. |
| `planAutonomousWork` | Hungry/thirsty active residents can choose an authorized stocked community store and physically route to it before ordinary harvesting. No food is granted in transit. |
| `usingHumanBed` / `tickNeeds` | A generic custody chest/shared bed ID no longer removes rest debt. Actual bed entity, single living assignment, same floor, distance and access are necessary. This intentionally exposes missing authored sleeping capacity rather than claiming it exists. Corrected starvation expression so simultaneous hunger/thirst both contribute; body needs damage uses the body's floor. |
| `humanHarvest` | Mutation-time same-floor, reach, access, tool condition, stamina and capacity checks precede source damage/output. Blocking target cell may be the source itself, but intervening collision is not bypassed. Tool wear and stamina are paid on actual strikes. Existing player-cache protection retained. |
| `depositHumanOutputs` | Physical store access revalidated at mutation. Custody detached before admission and restored if admission fails. No output grant from a remote work flag. |
| `sim.ts` | Removed duplicate `tickHumanHostility` and combat invocation in `advanceWorld`; live combat contacts have one main-tick caller. Offline no longer runs a second speculative live attack path. Offline combat remains incomplete, not silently resolved. |
| `stepHumanCombat` | Chasing is not damage. Creature attacks retain contacted actor IDs in the attack payload, reset on a genuine new attack and retained across JSON reload. Explicit human creature-target selection, facing, weapon cadence and costs retained. |
| `stepHumans` | Hostile approach uses existing legal cardinal executor, occupancy, bounded searches, LOS and one-step replanning. Wrong-floor route steps rejected. Player/live-creature occupancy checked at step admission. This is local approach, NOT full tactical combat AI or floor navigation. |
| `applyDamage` / `downHuman` / `killHuman` | Invalid/nonpositive damage rejected. Downing cancels stale motion/intent. Subsequent lethal damage kills a downed body rather than leaving an immortal negative-HP actor. Corpse receives actor floor rather than current camera floor. |
| `npc-art.ts` / `render.ts` | Persistent bleeding no longer permanently overrides locomotion with a hurt pose. Hit reaction and attack cue tied to recent committed damage/attack timestamps, not indefinite FIGHTING/blinking wall time. Renderer supplies matching absolute time. All six atlas bodies preserved. Full windup/contact/recovery art still incomplete. |
| `advanceElderPressure` / `finalizeHumanOutcomes` | Awakening no longer stamps a fabricated attack timestamp. Absence of assault is not proof of survival. Unproven living outcomes stay UNRESOLVED, not SURVIVED. This does NOT implement the missing assault authority. |
| `core.ts` | Optional typed Entity floor provenance, previously accessed through casts. |
| Tests | Ten focused physical-authority tests, one animation regression, and physical placement in the old capacity fixture. No tests skipped or disabled by this patch. |

## Verification actually executed

| Check | Result / boundary |
|---|---|
| Application TypeScript | PASS at source revision above; `logs/typecheck-final.txt`. |
| Focused NPC suite | **48/48 pass**, four files, 11.28 s. `logs/npc-final.txt`. |
| Test TypeScript | FAIL: **58** inherited diagnostics. Exact before/after file/code/message fingerprints in `test-typescript-fingerprints.json`; no new messages, five-line location shifts in one modified fixture. Not described as a pass. |
| Full default suite | Completed in **2107.41 s**: 141 files pass, 43 fail, 7 skipped; 1113 tests pass, 176 fail, 58 skipped. `logs/full-suite.txt`. Existing skips remained visible. **Diagnostic run started before final edits; not certification of final HEAD.** |
| Baseline failure reproduction | Exact audited source archived without switching branches. Trap, sensor, calendar, Control Tower audit: **25 fail / 36 pass**, four files. `logs/audited-failing-seams.txt`. Source/tests came from audited SHA; unchanged evidence/public/dependencies shared. Initial attempt lacked a required contract import; fixed archive inputs and reran. |
| Failure classification | Trap/sensor examples expect obsolete raw-material placement/cost lists, while approved current source requires packed devices. Calendar examples also fail paid build prerequisites on audited source. These 25 reproduced failures are inherited; **the other failures have not all been classified/fixed**. Do not change Creator laws merely to match obsolete fixtures. |
| Production build | **PASS**, 265 modules, **14.93 s**, 84,872.40 kB single HTML (gzip 59,744.00 kB). `logs/build-final-retry.txt`. |
| Build kill investigation | A prior attempt was killed with three memory-resident Vite servers. Stopped servers and reran successfully. Not an unavoidable blocker and not called a completed build. Failed attempt preserved in `logs/build-final.txt`. |
| Browser environment | Installed Sparticuz Chromium 138.0.2 in ignored `tmp/browser`; extracted bundled `al2023.tar.br` to `/tmp/al2023`; LD_LIBRARY_PATH includes its lib directory. Browser subsequently launched successfully. Initial npm no-save installation failed; isolated-prefix installation worked. |
| Final production browser | Ordinary New run → Veyra → Begin. Actual 640×360 canvas, no mutable QA global, **zero page errors**. `production-smoke.json`, `production-640x360.png`. Not a living-settlement/combat/endgame walkthrough. |
| Visual acceptance | **CREATOR VISUAL ACCEPTANCE REQUIRED**, not bot PASS. |

### Performance evidence — target not met/verified

The final production smoke sampled 300 rAF intervals in headless Chromium/SwiftShader: mean **97.16 ms**, P95 **133.4 ms**, P99 **166.7 ms**. Random fresh scene, no claim this represents Creator hardware or a full GPU benchmark. These are poor absolute frame intervals, not a smoothness claim.

An attempted audited-NPC vs modified-source comparison is retained in `controlled-comparison.json` **marked INVALID**: after capture the baseline server log revealed font requests rejected by Vite fs.allow because dependencies were symlinked. It therefore does NOT establish equivalent graphics conditions or <=10% regression. Both sampled scenes also had 286 IDLE actors and are not active-settlement/combat benchmarks. Main and G1B comparative benchmarks, long tasks, save stalls, GPU uploads, memory breakdown and distant-work costs remain unverified. No pixels, people, POIs or VFX were removed to improve FPS.

## Mandatory subsystem status (no inferred DONE)

| Acceptance area | Status | Remaining concrete gap |
|---|---|---|
| Finite identity / custody | PARTIAL, source + focused engine checks | Complete global multi-floor/window contacts and all cargo/death permutations not verified. |
| Population / 81 POIs | PARTIAL | Existing 286 seed still archetype/room derived. Seed CSV remains geometry, NOT authored sleeping/water/336h capacity proof. No complete 81-POI capacity/source audit delivered. |
| Survival | PARTIAL | Remote consumption repaired; physical beds/water services, supply production and distant access not complete. |
| Navigation | PARTIAL | Local cardinal routes only; global road certificates, floor portals, discovery, PPE/access invalidation absent. |
| Occupations | PARTIAL | See matrix below; fail-closed recipe stub not replaced with fake output. |
| Trust / Talk / Trade / Threat | PARTIAL inherited integration | Complete multi-item barter UX, non-exploitable help economy and naturally demonstrated recruitment not closed. |
| Companions | PARTIAL | Local follow and decisions inherited; all seven physical commands/floors/carry/home/independent judgment not closed. Hash-based refusal remains in `resolveOrder`. |
| Crime / revenge / base theft | PARTIAL | Incident memory is not a complete witnessed logistics/pursuit system. |
| Combat | PARTIAL | Local approach and duplicate contacts repaired; shared complete K5 Core/ammo/projectile/explosion/human-human, telegraph/recovery, tactical retreat not closed. |
| Downed / rescue / death | PARTIAL | Focused death/custody fixes; genuine medic/player treatment agency and all corpse/cart/floor cases not closed. |
| Global offline / 336h | PARTIAL | No complete causal global scheduler/travel/production. Local action laws cannot stand in for distant progress. |
| Six world situations | PARTIAL | Six regions do not yet have proven common complete supply/defense systems. |
| Six Elders | PARTIAL | `advanceElderPressure` still awakening/defeat bookkeeping; global reachable assaults missing. No fabricated attack evidence retained. |
| Evacuation | PARTIAL | Existing boarding/depart functions do not establish real visible vehicle/service/route/departure architecture. |
| Endgame / K8 | PARTIAL | False survivor inference fixed; proven island survival needs missing assault interval authority. |
| UI / art | PARTIAL | HumanPanel redesign, genuine four-direction runtime sequences and coherent full combat/body motion not delivered. |
| Performance | PARTIAL | Absolute smoke numbers collected, comparative acceptance not established. |
| Full production release | **PARTIAL / DO NOT MERGE AS COMPLETE** | Mandatory causal loops and final full validation remain open. |

### Eight-occupation matrix

| Occupation | Existing permitted runtime | Missing mandatory outcome |
|---|---|---|
| Salvager | Shared salvage harvesting; physical custody/store checks | Real recycler job, paid inputs/time/interruption/offline parity. |
| Mechanic | Role-filtered material gathering | Paid damaged-UID repair at real usable station. |
| Cook | Role-filtered ingredient gathering | Actual canonical recipe + ingredients/fuel/water/time + output. |
| Gardener | Role-filtered plant harvesting | Owned plots, seed/water/growth/replant work agency. |
| Medic | Treatment helper and medicine debit | Patient selection, route, actual medic work/time and interruption. |
| Guard | Equipment + limited combat integration | Meaningful posts/patrol/perception/rest/defense/ammunition. |
| Engineer | Role-filtered material gathering | Paid power/network/device operation/maintenance. |
| Builder | Shared wood/stone work | Paid authorized accessible structure repair/construction. |

`humanworld.ts::humanWorkTick` remains a fail-closed physical-recipe stub. No occupation is labeled complete merely because it gathers materials.

## Chạy build / điều khiển / phạm vi walkthrough

- Production preview trong Arena: **Soul of Hero — production build (NPC incomplete)**, cổng 5200.
- Local: `cd web && npm ci && npm run build && npm run preview -- --host 0.0.0.0 --port 5200`.
- Chọn **New run → VEYRA · Unified World → Begin the 14 days**.
- WASD/phím mũi tên: di chuyển; **F** tương tác theo ngữ cảnh; **I** túi đồ; **LMB/Q/E** kỹ năng Core khi đủ điều kiện.
- Giữ nguyên hướng dẫn kế thừa `../HUONG-DAN-VI.md` để tham khảo vị trí; tài liệu đó không phải bằng chứng tất cả scenario A–F đã hoạt động ở revision này.
- Ảnh production là ảnh chụp game thật, không tổng hợp/chỉnh sửa. Không tuyên bố trong ảnh có người đang làm nghề hoặc Elder tấn công.
- Chưa có walkthrough tự nhiên A–F hoàn chỉnh. Không dùng QA sửa Trust hay menu gắn cờ EVACUATED làm bằng chứng thay thế.

## Release decision

Không hoàn thành toàn bộ lệnh production completion. Các phần thiếu là công việc triển khai còn lại, **không phải blocker không thể vượt qua**. Không xin đổi luật, không tự merge, không gọi source helper/unit test là feature hoàn chỉnh.

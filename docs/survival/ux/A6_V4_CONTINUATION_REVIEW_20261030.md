# A6 V4 continuation review — 2026-10-30

**Decision: continue engineering; PR #24 stays Draft/HOLD.** This is a continuation of V3/V4 on A6, not a redesign. No production A6 mount, native grade-zero playback, human input/readability test, or Gold-context acceptance is claimed; the source is legally game-use compatible and locally staged only.

## Exact sources rechecked

| Source | Current exact ref | Review performed |
|---|---|---|
| A6 working branch | `arena/443f004f-soul-of-hero`, tracked head `08ccb8348f2e7a75e09af47a1741c158fc46e794` before this continuation's uncommitted changes | Existing planner, adapters, HUD, source gate and workflows; no V3/V4 rebuild |
| A0 PR #21 | `5387bed6260cb7b9bd4d8229ee759dee08a0d918` | Re-read the complete current `chest_inventory_panel.gd`; reviewed `SurvivalService` transfer transaction and `SaveService.transact_once` receipt/dedupe semantics; checked the production overworld mounts the existing A0 chest panel and owns its reach/input path |
| A1 PR #20 | `2f6edd3f1c45916fb1fd85b167c3f635bf11cc3b` | Rechecked the current slice/handoff contracts: A1 authors discovery/action data; it does not grant A6 reward or persistence authority |
| A3 PR #19 | `2b18bb25dd3b0425c6b5d5ed1617a545e5e1bca0` | Rechecked the current head and confirmed the V4-audited item catalog, recipe and research data are unchanged; a physical Core is not learned knowledge and does not imply A4 readiness |
| CT decision/contract branch | `575ae0608b8f35deee9c1a96b8af9a225d71f622` | Read D051–D054, CT contracts and A6 work order |
| Original Atlas + coverage trace | `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7` | Reopened the relevant 2019–2020 identity, resource/knowledge graph, POI, building/storage, survival/death, combat, 14-day replay and acceptance sections. The trace's SYS/POI/DEP/JOURNEY IDs are not R0–R5. |
| Review protocol | CT branch above | Read `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md` and its R0–R5 requirements |
| Acceptance | A0 PR #21 at the current ref above | Re-read the fresh-save/normal-input/native/Web, persistence, death/recovery, license, screenshot and human-review gates |

A0 advanced to `5387bed6…` and A3 to `2b18bb25…` while this continuation was underway. The A0 diff from `51f2cce8…` is empty; the earlier diff from `2faf005b…` shows the chest panel, SurvivalService and production overworld unchanged while SaveService added float round-trip JSON precision. A3's latest diffs include world-source/economy work and an economy-restart test, but the exact V4-audited item catalog, recipes and research data are unchanged. Both A6 workflow owner pins and the V4 source-audit constants now use the latest A0/A1/A3 heads.

## Avatar bytes, visual check and legal boundary

The enabled Drive connector retrieved both actual ZIPs again. New byte sizes and MD5s match the prior reviewed copies:

| Selected source | Bytes | MD5 | SHA-256 | PNG files | CRC errors |
|---|---:|---|---|---:|---:|
| Male Craftpix 555940 | 6,439,805 | `b4910c4dd86a5193e5e0640751a20abd` | `b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795` | 350 | 0 |
| Female Craftpix 419402 | 6,419,098 | `cf6ffa60ef922e4703dc6b27c3b5bac2` | `f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad` | 316 | 0 |

The exact product/license URLs were reviewed 2026-10-30 (see `CRAFTPIX_AVATAR_LICENSE_AND_PRIVATE_STAGING_20261030.md`). CraftPix Freebie terms §§2.1.1–2.1.3 support personal/commercial game use, while §2.2.1 prohibits raw/slightly modified art redistribution and art-export apps; §3.1.1 prohibits AI/ML use. Both exact source ZIP hashes match their Drive copies. The eight selected male/female action sheets are staged only under ignored `private_art/a6_avatar/`; the raw ZIPs stay outside Git. Sheet dimensions, directional alpha-row populations, feet baseline and Tiled 150 ms/terminal Death timing now pass the private staging validator. This supports private local game composition, not public raw source release or production mount. A source-backed gender-matched grade 1/2 visual remains unresolved; 180537 Swordsman is rejected as a different identity, and Knight remains rejected.

The A6-only `avatar_sprite_pipeline.gd` and manifest seam now select only the A0-resolved gender/grade record, require `license_review.status == VERIFIED_GAME_USE` before loading any texture, build directional `SpriteFrames`, then play only the host-supplied action/direction. Missing direction/action fails closed; there is no identity fallback or fake attack. The tracked/public manifest deliberately has no runtime texture paths; the private local overlay contains the actual SHA-locked grade-zero sheets. The local preview runner is authored but unrun, so no native playback is evidenced. A clean clone remains `SOURCE_BLOCKED` without private staging, while the staged local overlay is only eligible for the pending native test and is not mounted in production.

## Storage and receipt contract

`a0_storage_command_adapter.gd` remains a non-mutating shape adapter. Its validated command now preserves the exact request ID, source revision, owner sequence and stack key as well as item, container, direction and quantity. A0 must still revalidate all fields against its live projection; the A6 adapter is not authorization.

An accepted `soh.ui.response.v2` now leaves the request pending unless it carries a nonempty opaque `receipt_id`, identifies `receipt_owner: A0_SAVE_SERVICE`, and includes the correlated request ID plus a newer authoritative snapshot. The UI never displays the receipt ID. Same-request retry remains disabled unless A0 explicitly advertises durable deduplication; replayed or stale responses cannot release a different request. Stale sequence refusal has concise player copy. Rejections (including full chest/bag) must refresh both authoritative sides without fabricating success.

The current production A0 panel has a bool-returning action and its own session/serial SaveService key; it does **not** expose the A6 correlated-response protocol. In `_submit_owner_panel()`, the A6 test harness clicks the real A0 panel using only item/direction/amount. The A6 request ID, revision, sequence, and stack key do not reach A0's transaction endpoint. The test therefore verifies fixture-funded A0 panel composition and A0's own durable receipt only; it is not end-to-end A6 idempotency, replay, or stale-revision acceptance. The exact branch decision is documented in `A6_A0_STORAGE_OWNER_HANDOFF_20261030.md`: A0's panel remains the only production storage command UI and A6 stays read-only pending an owner API. No A6 code calls SaveService or mutates inventory.

## Native failure findings and correction state

The exact check annotations are available for runs [41022769340](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41022769340) (V3 composition) and [41022762952](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41022762952) (V4 composition). Both were failures before the corrections in this continuation; neither is accepted product evidence.

The annotations revealed:

- Godot 4.7 could not infer two planner boolean locals and four planner-test locals. Explicit types have been added.
- The UI adapter correctly sanitizes an unknown placement denial, but its test incorrectly expected the private raw reason. The oracle now expects generic player-facing copy.
- The V4 storage adapter converted a missing revision before checking its type, causing a runtime error. Conversion is now guarded, with a regression assertion that missing revision fails closed.
- HUD tests expected “Scavenging” for an `exploration` DTO. The production label “In the field” is the intended concise wording; both fixture expectations now match the actual mode.
- Avatar dimension tests used strict array equality across JSON numeric types. They now assert two numeric dimensions explicitly.
- The V3 capture failures in the old run followed the planner parse/mount errors; new bounded captures still need to execute and then be inspected.

The repository working tree has been parsed with `gdparse` (gdtoolkit) for the changed driver, pipeline, native harness, and avatar/storage tests; Python scripts compile, and the private staging validator runs successfully. This is syntax/static evidence only. No local Godot executable or display server is available here, so **no local native runtime/capture is claimed**. V3 run `41031682756` and V4 run `41031682730` are still queued at exact source SHA `08ccb8348f2e7a75e09af47a1741c158fc46e794`; neither is native pass evidence until it completes. The new local native capture runner is written but cannot run in this environment.

## R0–R5 disposition (not an approval)

| Layer | Current status | Evidence / remaining work |
|---|---|---|
| R0 — primary intent | **PARTIAL** | Atlas, trace, D051–D054, A0 acceptance and CT contracts rechecked. Complete requirement→owner code→player action→persistence→test→visual mapping is not finished. |
| R1 — patch/dependency forensics | **PARTIAL** | Current owner refs and asset-license provenance reviewed; selected SHA-locked source staged privately. Production A0 avatar mount and compatible grade-1/2 layers are absent. |
| R2 — test oracle | **CORRECTIONS MADE; RERUN REQUIRED** | Earlier native failures exposed real parser/runtime defects and stale expectations. Updated tests are not yet executed on the corrected A6 SHA. |
| R3 — Godot and visual truth | **NOT TESTED** | No corrected native run or visually inspected 720p/2K/4K artifacts yet. Earlier test/capture failures are not visual acceptance. No human input/readability or Gold-overlay review. |
| R4 — system/value/replay | **NOT TESTED** | Atlas establishes source→process→knowledge and long-run discovery intent; no 14-day-equivalent or human journey has been run here. |
| R5 — binary integration decision | **HOLD** | PR #24 remains Draft/Open. A0 is the sole production/save authority; grade-zero art staging is private-only, grade-1/2 sourcing, native visual evidence and human review remain required. |

## Next executable gates

1. Run the refreshed A0/A1/A3-pinned V3/V4 workflows on the exact updated A6 SHA after the working changes are committed/pushed to this same branch. Fix any native failures rather than inferring success from static parsing.
2. Keep the current A0 panel authoritative and A6 read-only; do not claim request-ID/replay/stale-sequence acceptance. If A0 later exposes a correlated command API, use the exact contract in `A6_A0_STORAGE_OWNER_HANDOFF_20261030.md` and test it through the owner endpoint.
3. Grade-zero license and private source validation are complete; the native runner and actual runtime selection still need execution. Resolve and visually inspect same-identity four-direction male/female grade-1 and grade-2 layers from lawful sources, or keep those grades `SOURCE_BLOCKED`.
4. Run the private native preview on Godot 4.7; inspect 1280×720, 2560×1440, and 3840×2160 captures in real A0 context and original Gold overlay. Run keyboard/mouse/controller/modal, persistence, death/recovery and fresh-player acceptance; keep each unperformed gate open.

**Release gate:** remain Draft/HOLD until owner integration and required native/human acceptance are complete. No merge requested or performed.

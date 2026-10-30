# A6 V4 continuation review — 2026-10-30

**Decision: continue engineering; PR #24 stays Draft/HOLD.** This is a continuation of V3/V4 on A6, not a redesign. No production A6 mount, human input/readability test, approved avatar runtime art, or Gold-context acceptance is claimed.

## Exact sources rechecked

| Source | Current exact ref | Review performed |
|---|---|---|
| A6 working branch | `arena/443f004f-soul-of-hero`, baseline `8bc0af5a1f5f499736ecc0cf202c249d00d3cb3e` before this continuation's edits | Existing planner, adapters, HUD, source gate and workflows; no V3/V4 rebuild |
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

Temporary previews of both selected identities' unarmed idle, walk and run sheets were opened and visually inspected. Their idle sheets are each 768×256 with four directional rows. No source PNG or ZIP was copied into the project or Git. In both ZIPs, `License.txt` contains only `https://craftpix.net/file-licenses/`; the actual game-use, attribution and redistribution terms were not reviewed. Therefore **legal use remains unverified and the art stays out of runtime**. This is a license-evidence blocker, not a Drive/binary retrieval blocker. Armor grades 1/2 remain source-blocked; no Knight or Craftpix 180537 Swordsman substitution is permitted.

The A6-only `avatar_sprite_pipeline.gd` and manifest seam now select only the A0-resolved gender/grade record, require `license_review.status == VERIFIED_GAME_USE` before loading any texture, build directional `SpriteFrames`, then play only the host-supplied action/direction. Missing direction/action fails closed; there is no identity fallback or fake attack. Synthetic test cases and the native suite are authored, but the new native test remains unrun until the refreshed V4 workflow completes. The manifest has no runtime action sheets, and the appearance resolver returns `SOURCE_BLOCKED` until licensed art and sheet-row mapping are verified.

## Storage and receipt contract

`a0_storage_command_adapter.gd` remains a non-mutating shape adapter. Its validated command now preserves the exact request ID, source revision, owner sequence and stack key as well as item, container, direction and quantity. A0 must still revalidate all fields against its live projection; the A6 adapter is not authorization.

An accepted `soh.ui.response.v2` now leaves the request pending unless it carries a nonempty opaque `receipt_id`, identifies `receipt_owner: A0_SAVE_SERVICE`, and includes the correlated request ID plus a newer authoritative snapshot. The UI never displays the receipt ID. Same-request retry remains disabled unless A0 explicitly advertises durable deduplication; replayed or stale responses cannot release a different request. Stale sequence refusal has concise player copy. Rejections (including full chest/bag) must refresh both authoritative sides without fabricating success.

The current production A0 panel has a bool-returning action and its own session/serial SaveService key; it does **not** yet expose the A6 correlated-response protocol. The A6 native composition test continues to exercise the real A0 scene, panel and transfer path, and now checks the durable SaveService transaction receipt. The remaining owner handoff is for A0 to map an A6 request ID to its stable transaction key, verify/replay that receipt, validate the forwarded revision/sequence/stack key, and return the fresh A0 projection. No A6 code calls SaveService or mutates inventory.

## Native failure findings and correction state

The exact check annotations are available for runs [41022769340](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41022769340) (V3 composition) and [41022762952](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41022762952) (V4 composition). Both were failures before the corrections in this continuation; neither is accepted product evidence.

The annotations revealed:

- Godot 4.7 could not infer two planner boolean locals and four planner-test locals. Explicit types have been added.
- The UI adapter correctly sanitizes an unknown placement denial, but its test incorrectly expected the private raw reason. The oracle now expects generic player-facing copy.
- The V4 storage adapter converted a missing revision before checking its type, causing a runtime error. Conversion is now guarded, with a regression assertion that missing revision fails closed.
- HUD tests expected “Scavenging” for an `exploration` DTO. The production label “In the field” is the intended concise wording; both fixture expectations now match the actual mode.
- Avatar dimension tests used strict array equality across JSON numeric types. They now assert two numeric dimensions explicitly.
- The V3 capture failures in the old run followed the planner parse/mount errors; new bounded captures still need to execute and then be inspected.

Static `gdparse` passed on the changed GDScript files. A local Godot binary was not available. A release-binary attempt redirected to a GitHub asset host outside this sandbox's allowed outbound hosts, so **no local native engine test is claimed**. The updated pinned workflows must run on GitHub before any native PASS is stated. The V4 native list now also includes `avatar_sprite_pipeline_test.gd`.

## R0–R5 disposition (not an approval)

| Layer | Current status | Evidence / remaining work |
|---|---|---|
| R0 — primary intent | **PARTIAL** | Atlas, trace, D051–D054, A0 acceptance and CT contracts rechecked. Complete requirement→owner code→player action→persistence→test→visual mapping is not finished. |
| R1 — patch/dependency forensics | **PARTIAL** | Current owner refs and relevant source reviewed; stale workflow/audit pins refreshed. Production A0 request bridge and exact legal-art provenance are still absent. |
| R2 — test oracle | **CORRECTIONS MADE; RERUN REQUIRED** | Earlier native failures exposed real parser/runtime defects and stale expectations. Updated tests are not yet executed on the corrected A6 SHA. |
| R3 — Godot and visual truth | **NOT TESTED** | No corrected native run or visually inspected 720p/2K/4K artifacts yet. Earlier test/capture failures are not visual acceptance. No human input/readability or Gold-overlay review. |
| R4 — system/value/replay | **NOT TESTED** | Atlas establishes source→process→knowledge and long-run discovery intent; no 14-day-equivalent or human journey has been run here. |
| R5 — binary integration decision | **HOLD** | PR #24 remains Draft/Open. A0 is the sole production/save authority; owner mount, avatar license, visual evidence and human review are still required. |

## Next executable gates

1. Push this continuation only to the existing A6 branch; let the refreshed A0/A1/A3-pinned V3/V4 workflows run. Fix any new exact native failures rather than inferring success from static parsing.
2. Have A0 accept/implement the correlated storage request/receipt seam; test stale sequence, duplicate request replay, exact stack quantity and capacity refusal through the owner API—not a UI animation or fixture claim.
3. Obtain and review the actual Craftpix game-use terms/attribution evidence; only then import the smallest approved runtime sheets, verify row-to-direction metadata, build matching male/female grade-0 playback, and source/test equipment-driven grades 1/2 without swapping identity.
4. Retrieve and visually inspect current native 720p/2K/4K captures, including the real A0 context, overlays and original Gold context. Perform real input/human acceptance and keep all unverified gates explicitly open.

**Release gate:** remain Draft/HOLD until owner integration and required native/human acceptance are complete. No merge requested or performed.

# A6 — Live Player-Facing UX Integration Readiness
2026-10-30 | USER_DISPATCH_REQUIRED / NOT_PRODUCTION_MOUNTED. V3/V4 scoped engineering is accepted; continue this package, do not rebuild it. Latest applicable user decisions are D051/D052 on `docs/ct-loot-discovery-gate-20261030` and source correction `CT_D051_D052_AVATAR_AND_PLAYER_UX_CORRECTION_20261030.md`.

## Locked avatar and quality gates

- Exactly two canonical starting player identities: bald, unarmored male, Craftpix 555940, Drive file `1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb`; bald, unarmored female, Craftpix 419402, Drive file `1o5hRVbPZjZxcPGwP5coPDHZARbAej75o`. These supersede D045's previous character-source identities.
- Equipment visuals must preserve selected gender across unarmored, armor grade 1 and grade 2; equip/unequip and save/reload/death/respawn must follow A0-authoritative equipped inventory state. The canonical base sheets are source-verified by the user but are absent from this Arena checkout. No raw commercial ZIP or sprite may be copied into the public repository.
- Armor art: grade 1 and grade 2 male/female matching files have not been verified in this workspace. Craftpix 180537 Swordsman tiers are a different character and are not acceptable fallback. Adapter output must be `SOURCE_BLOCKED` until exact compatible art is source-verified/imported. Never substitute Knight or change gender to conceal the gap.
- D052 is a hard player-quality gate: compact, contextual screens; no raw IDs, FIXTURE labels, technical states, verbose internal explanations, redundant panels, fake controls, or unfinished player-visible surfaces. Internal provenance belongs only in opt-in developer diagnostics.
- Preserve A0's current HUD, SaveService, chest panel, gameplay input, death/recovery and actual player authority. Preserve Gold VFX fidelity; no A6 edits to Gold or A0-owned source.

## Existing A6 package and boundaries

Keep V3/V4 source, tests, adapters and A6 workflows in this PR. The V4 projection remains passive; the revised HUD must consolidate context/Core into a compact, single card and suppress fixture data in normal presentation. Inventory/storage, crafting/research, Core custody and equipment remain owner-projected/request interfaces—not local A6 transactions. A0 validates gameplay state and SaveService mutations; A3 owns item instances/recipes/research/production; A4 owns effects and readiness; A1 owns authored world facts. A6 cannot claim that these surfaces are live merely because a fixture/native projection renders.

`avatar_appearance_adapter.gd` is a presentation seam only. It accepts an A0 owner projection of selected gender and saved armor grade, resolves only the matching identity's explicitly verified asset path, and fails closed with `SOURCE_BLOCKED` when art is absent. It does not create characters, choose gender, equip, save or substitute art. The neighboring manifest records exact private source IDs, tested source-sheet member/dimensions, missing armor tiers and rejected fallbacks.

## Native evidence required before player acceptance

1. Run the V4, V3, A0 modal/input and avatar-source suites against pinned current A0/A1/A3 source. Keep all A6 input passive in the HUD; verify every modal open/close blocks and restores gameplay input in the actual A0 host.
2. Capture the actual composed player-facing experience at 1280×720, 2560×1440 and 3840×2160. Physically inspect those PNGs at each resolution for clipping, readable type, hierarchy, context, icon clarity, A0 overlap and input focus. Bounded CI success or dimensions do not count as visual inspection.
3. The current A6 frame download attempt returned EOF from GitHub Actions artifact storage. Until captures are retrieved and inspected, visual review remains BLOCKED; do not claim human acceptance.
4. Use the exact private source ZIPs only through authorized project asset handoff. Current source record names are `craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip` and `craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip`. Confirm applicable license/attribution separately. Do not upload raw ZIPs/sprites to public Git.
5. Do not alter the other three private-source UI-art handoff ZIP names preserved in `V4_PLAYER_FIRST_HUD_HANDOFF_20261030.md`; those are a separate, non-avatar asset request.

## Exact A0 integration handoff

A0 can integrate this package only after making an owner-authored host adapter and live journey. Preserve the existing A0 region/provisions/counter/prompt/death UI. Mount `res://game/survival/ui/player_first_hud.gd` in one A0-cleared corner; it is passive and has no controls. A6's existing modal views are `res://game/survival/ui/survival_journal.tscn` and `res://game/survival/ui/expedition_workspace.tscn`; A0 must opt in only the surfaces with an approved host and real actions. Do not show an unconnected button.

### Versioned host seam (A0 owns the actual implementation)

- Snapshot: planner accepts `schema=soh.ui.snapshot.v2`, monotonic nonnegative integer `sequence`, stable `revision`, `bag`/`chest`/`recipes`/`places`/`hazards`/`capabilities`/`cores`/`respawns`/`recovery`. Each entry must use player-facing `name`/`label` separate from internal IDs. Add `provenance=A0_OWNER_PROJECTION` at the A0 host boundary; never set fixture provenance on live state. A0 filters undiscovered records before calling A6; A1 authored values and A0 discovery/runtime state remain separate fields.
- Transfer intent emitted by `request_action(action, target_id, payload)` uses `schema=soh.ui.intent.v2`, `request_id`, `revision`, `sequence`, `direction`, `container_id`, canonical `item_id`, display-only `stack_key`, and positive integer `amount`. `a0_storage_command_adapter.gd` only shape-checks this value and returns `mutated=false`; it never grants permission. A0 rechecks alive state, exact open chest, reach, current stack/capacity, protected unique custody and idempotency, then commits once through A0's SaveService. Keep the current A0 ChestInventoryPanel as the only real transfer UI unless A0 approves that command API.
- Response: `schema=soh.ui.response.v2`, same `request_id`, `status=accepted|rejected`, short player-facing `message`, and a fresh authoritative `snapshot` with larger sequence/revision. A6 ignores mismatched, stale or uncorrelated responses. Existing A0 panel does not yet accept the A6 request key as its own durable dedupe key; do not synthesize a retry as another button press.
- Avatar: `schema=soh.ui.avatar_appearance.v1`, `provenance=A0_OWNER_PROJECTION`, `revision`, `gender=male|female`, and integer `armor_grade=0|1|2`, derived from persisted A0-selected character and real equipped inventory state. Feed this to `avatar_appearance_adapter.gd`; if matching art is absent it returns `SOURCE_BLOCKED` and no player art is substituted. Do not persist a second A6 copy.
- Core and crafting/research: A3 supplies physical `instance_id`/`item_id`/condition/uses/custody and recipe/station/research facts. A0 supplies inventory/save transaction and response; A4 readiness remains a separate owner field. Fixture or catalog status never enables an A0 command.

A0 controls gameplay polling/input and SaveService commits. Run the combined native modal/input gate in the exact mount, exercise deposit/withdraw, craft/research, Core custody/equipment and death/recovery, then inspect captured live-owner frames. Include owner source SHA, schema revision, transaction/dedupe behavior, rollback path and explicit outstanding blockers in the A0 handoff.

## Status

A6 V3/V4 scoped CI passed on the previously recorded head. That acceptance does not imply production mount, verified local avatar art, matching armor tiers, live avatar/equipment persistence, human visual/input acceptance, or full-game acceptance. PR #24 stays Draft/Open and must not be merged pending live A0 integration and user-required visual inspection.

# SURV-UX-010A — A6 acceptance record

> **V4 active (2026-10-30):** See [V4_PLAYER_FIRST_HUD_HANDOFF_20261030.md](V4_PLAYER_FIRST_HUD_HANDOFF_20261030.md). V4 extends the existing A6 V3 UI on this branch; it compares against the exact current A0/A1/A3 refs and is not production-mounted. The V3 body below is a historical checkpoint. A0 PR #21 has since added the gameplay input gate, but checks on its latest head `b2c37d35f47ef870fcbafafbc7f49e3d2730cd17` were pending at the last query; the earlier passing `composed-native` check belongs to a previous head. This does not imply that A6 V4 is mounted, human-tested, or approved.

> **Historical V3 status (2026-10-29):** See [V3_SUSTAINED_PRODUCT_ACCEPTANCE.md](V3_SUSTAINED_PRODUCT_ACCEPTANCE.md). A6 added three source-grounded, fixture-labeled presentation journeys and a dedicated pinned A0+A6 Godot 4.7 CI workflow. Production mounting was on hold at that checkpoint. The legacy text below is preserved as historical V0/V1/V2/V3 evidence and must not be read as current V4 CI, screenshot, or integration evidence.

> **Historical continuation note:** `V2_VISUAL_SYSTEM.md` records the recovered-source V2 visual system, canonical A1/A3 read-only projections, testing boundary and unresolved A0 input gate. Its bespoke folio skin and pixel emblems supersede the older “flat/default-font” visual critique below for source state, but **do not** supersede the production hold or make prior native screenshot evidence current.

**Status: WIP; HOLD INTEGRATION pending A0 review.** This is a working, deliberately isolated UI increment, **not** the complete survival experience or a replacement for the live HUD. No production scene is wired to it. Branch base `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7`; assigned integration branch was `00461ea6327bba93c571b25520587b66bcf0dcc5` when checked with `git ls-remote`, and may have advanced. Do not overwrite the live build strip, SaveService, A4 Gold, or other agents' changes.

## What exists

- `game/survival/ui/survival_journal.tscn` and `.gd`: modal, keyboard-focusable tabbed satchel, inspection, scrollable stacks, placement advisor, and caller-filtered notes. Escape closes and restores prior focus; `item_selected` identifies the exact stack key. No item mutations are made by this component.
- `survival_view_adapter.gd`: read-only projection using the actual `SaveService.get_inventory_stacks` shape and `SurvivalService` catalog/count/read APIs, including secondary stack IDs, real piece costs and known rejection codes. Known source hints are filtered to resource IDs passed by the host; they are not an automatic discovery system. `recipe_status` and `core_status` are presentation helpers only, NOT A3's authoritative Core/recipe schema.
- `tests/survival/ui/demo.tscn`: interactive isolated fixture, **not the game**. Scroll to the end for the illustrative Core. Hazard, recovery, durability and Core records are labelled fixture and do not imply gameplay exists. Costs and discovered-source examples use the real provisional SURV-010 catalog.

Run after importing project using Godot 4.7:

```sh
godot --headless --editor --path . --quit
godot --path . res://tests/survival/ui/demo.tscn
godot --headless --path . --script res://tests/survival/ui/ui_test.gd
xvfb-run -a -s '-screen 0 1280x720x24' env LIBGL_ALWAYS_SOFTWARE=1 \
  godot --path . --rendering-method gl_compatibility --resolution 1280x720 \
  --script res://tests/survival/ui/ui_test.gd -- 1280
```

## Integration contract (proposal; not yet approved)

Instance journal, initially hidden; call `set_bag(Adapter.bag(SaveService, SurvivalService))` on each authoritative change; pass `set_placement(Adapter.placement(SurvivalService, piece_id, reason, discovered_resource_ids))` using A0's *current* validation and current selected piece, not cached estimates. Call `open_journal()`. The host receives `item_selected(stack_key)` and `closed`; it must validate any future operation with the owning authoritative service. `set_field_entries` MUST receive only discovered information. Never pass raw, undiscovered catalog/POI data. Format and fields are a local proposal, not a claimed CT standard. `get_inventory_stacks` and `inventory_count` are copies/reads; no migration is performed.

**Critical input caveat:** `Control.MOUSE_FILTER_STOP` blocks GUI propagation and the Knight's `_unhandled_input`, but `chapter1_overworld.gd` currently polls `Input.is_action_just_pressed("build_place")` in `_handle_survival_input`. GUI consumption alone does not guarantee it suppresses that polling. A0 must supply an explicit modal/input gate and verify clicks cannot place or swing, including press/release across closing; don't mount until this is agreed and tested. This change intentionally does not edit A0's code. The modal also needs pause/combat safety and an agreed binding. Use UI status fresh from the transaction owner; it is informational, not permission to transact.

## Evidence / limits

Godot `4.7.stable.official.5b4e0cb0f` on Linux, software GL compatibility (Xvfb). `ui_test.gd`: 21 checks headless; 23 with rendering at 1280×720, 2560×1440, and 3840×2160. The test instantiates the real scene and real survival catalog/autoload, but supplies a fake save and fixture list. It tests keyboard `ui_accept`, Escape, focus restoration, scroll-to-last of 35 stacks, a simulated viewport mouse click on the build tab, invalid placement, source visibility, unknown rejection, costs, condition and charge rendering. The field-notes and satchel tab checks use button signals; the build tab receives a synthetic viewport mouse click. There is no production-game click-through assertion. Native screenshot PNGs beside the test show actual fixture rendering, not gameplay or real environmental lighting. Headless is behavioral, not a visual test. Tests passed locally on the files in this checkpoint; independent test/CI on committed SHA remains required. The Xvfb machine warns missing audio libraries / dummy audio and VSync; audio is not under test.

The actual project uses 640×360 design viewport, 1280×720 window override, `canvas_items`, `expand`, nearest texture filter, and no configured integer stretch mode. 1280/2560/3840 are 2×/4×/6× the logical size; the captured frames do not prove strict integer pixel scaling of all gameplay or text, non-16:9 behavior, subpixel camera behavior, Web, or physical monitor legibility. No global settings changed. Inspect screenshots yourself; UI uses default Godot font and procedural flat shapes, not yet a distinctive production pixel-art icon set. Test real world at bright snow/desert, rainy forest, vault, and Gold-heavy combat after A0 integrates; visual review and player usability remain NOT TESTED.

## Gaps before the mission can be marked complete

- No equipment mutations, transfer actions, harvest/loot notices, actual recipe/crafting/research or workstation controls; no world map, hazards, beds, death bag, respawn, room/roof or actual Core equip/cast. Fixture labels do not implement them.
- No real post-death or 14-day replay proof, no actual world/HUD screenshot, no human playtest, no Web test, no source-faithful Gold interaction evidence. No independent review has approved it.
- Implement a real catalog-backed visual identity/icons only after rights/semantic review; distinguish item types without relying on color, localize text, accessibility review, and test long labels and input across devices. No third-party asset was imported.
- Verify inventory capacity and actual save updates end-to-end, keyboard tab/focus order and mouse interaction, then negotiate A0 input gate; A3 must supply validated recipe/Core/condition adapters; A1 must supply discovered geography/hazards. A0 owns integration/persistence. S6 is not a dependency.

## Cross-system / source trace

Atlas §04, §14, §19–20, §33–34, §45; `DEP-01`, `DEP-18`, `DEP-23`, `JOURNEY-02/04` motivate actionable material sources, preserving secrets, and found-Core versus knowledge distinction. This increment only projects a subset; it does not pass those journeys. CT-03 item ledger read, CT-06 resource hints, CT-07 placement feedback; proposed presentation helpers for CT-04/CT-10 only. CT-05/09/11/12 are not implemented. No save schema/migration, recipe balance, Gold/VFX or world writes. Top-down spatial context can reveal routes and hazards without occluding the Hero, but no comparative usability claim is proven here.

## Collaboration / pending sync

`DOCS_SYNC_PENDING`: Google Docs connector is disconnected, so tabs 03/04/06/07/09 were not independently read or updated. Pending tab 04 entry: "A6 SURV-UX-010A: isolated read-only journal, placement adapter, native fixture tests and screenshots; WIP, A0 input gating required, no production hookup, no full survival/Gold claim. See docs/survival/ux/README.md and branch commit." Shared `STATE.json`, `WORKLOG.md` and canonical `RESEARCH_LOG.md` were intentionally not edited because role scope restricts changes to isolated A6 directories; integrator should reconcile them after independent review. GitHub connector unsupported in this session; push/PR/issue update require separate authenticated access if git push cannot authenticate.

## Handoff checkpoint

Local checkpoint commit `9db851f3c905411ba94825603a2874427b547965` created; subsequent test/doc changes are in the next local commit. Attempted `GIT_TERMINAL_PROMPT=0 git push origin feature/surv-a6-ux-010a` failed: no GitHub credentials. No PR or issue comment was created. Github connector returned `unsupported`. Authenticate Git access, push this branch, then open a **draft PR** against `feature/survival-rpg-foundation-20261029`; independent reviewer must compare current integration HEAD and inspect test scope before any merge. Google Docs remains disconnected.

The original Atlas hash and line count were verified, and sections were inspected, but tool output truncated the full text; a complete independent read of all 1,355 lines and all coverage-trace entries is **not established**. This context-recovery gap remains before claiming work-order compliance.


**Newer offline workspace:** See [V1_WORKSPACE_CONTRACT.md](V1_WORKSPACE_CONTRACT.md) for the fixture-only composed Journal/Desk, V1 snapshots and correlated intent/reply protocol. The A0 production input-gate hold still applies.

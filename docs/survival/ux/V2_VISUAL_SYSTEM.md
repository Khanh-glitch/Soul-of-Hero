# A6 UX / visual system V2 — continuation milestone

**Status: working isolated prototype; native visual sign-off and production integration are HOLD.**

Recovery provenance: exact source-only recovery head `bb71bd059a8a70b2fe5121902c68f0864b7e8b68` (tree `bde993a6f04227820cb23deb734cb65cb31038c0`). The 31 recovered files were materialized on the Arena-pinned working branch without switching away from it. This continuation adds bespoke presentation code, V2 read-only projections, lifecycle coverage and a bounded capture harness. It does not change gameplay authorities, project render globals, A0/A1/A3/A4 files, SaveService, Gold effects or production scene wiring.

## What visibly changes in the prototype

- **Illustrated folio framing:** hand-drawn square-corner trim, interrupted brass corners, a center sigil and offset shadow around dark leather cards. Satchel and Desk share warm bronze/paper/forest-mint accents while the scrim stays subdued.
- **Distinct, original pixel emblems:** 24×24 nearest-neighbour source pixels drawn in code (no third-party art): stepped Ember flame, six-point Frost shard, tapered Venom droplet, neutral prismatic specimen, log bundle, stone and iron. Core icons carry finite-use pips, a depleted mark, condition nick and equipped mark; state remains readable in accompanying text, never hue alone.
- **Typography:** existing repository Handjet (body / semibold controls) and Grenze Gotisch (headings) override component fonts. Their source and SIL Open Font License are recorded in `assets/fonts/SOURCES_AND_LICENSES.md`. No default font is relied on by A6 UI controls and no project-global font/render setting changed.
- **Owner terminology:** specimen rows preserve A3 `instance_id`, `item_id`, `uses`, `max_uses`, integer `condition` / `max_condition`, `location`, `revision` and `origin`. The UI separates equipped/loadout state, recipe catalog knowledge and permanent profile formula knowledge, and labels missing owner projections as unavailable rather than inventing false negatives.
- **Actionable preparation:** recipe projection preserves dictionary `inputs`, `fuel`, outputs, station, minimum tier, duration, required technologies, catalog balance status and optional specimen-consumption item. Known counts/source hints, station status, queue status, authorization and failure reason remain explicit host fields. The interface's buttons request; they do not approve or transact.
- **A1/A0 boundary:** map and hazard adapters use A1 `poi_id`, `cell`, `region_id`, `material_keys`, `required_capabilities`, `content_readiness`, `hazard_id`, `severity`, `requires`, `node_id`, `material_key` and contract status. A0 must explicitly pass discovered/owned state. Static A1 plan data remains `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED` / `CONTRACT_NOT_SPAWNED`; it is never presented as a live world interaction. Material keys are not converted into A3 inventory IDs.
- **Long content / navigation:** existing scroll columns, retained search, keyboard tab neighbors, focus restoration, mouse tabs and explicit disabled/failure copy remain. New modal-state lifecycle signals follow hidden ancestors, restore and tree exit. This reports UI state only.

### Bounded native capture harness

`tests/survival/ui/visual_capture.gd` writes only to ignored `.artifacts/a6-ui/`. At 1280 it saves one composed Satchel frame and one Core detail frame; at 2560 and 3840 it saves only the Core detail frame. Example commands (requires the dedicated Godot 4.7 runtime and a display/Xvfb):

```sh
godot --path . --rendering-method gl_compatibility --resolution 1280x720 \
  res://tests/survival/ui/visual_capture.tscn -- 1280
godot --path . --rendering-method gl_compatibility --resolution 2560x1440 \
  res://tests/survival/ui/visual_capture.tscn -- 2560
godot --path . --rendering-method gl_compatibility --resolution 3840x2160 \
  res://tests/survival/ui/visual_capture.tscn -- 3840
```

**No V2 native captures are claimed yet.** The sandbox had no Godot binary. Downloading the official 4.7 release asset failed at the redirected `release-assets.githubusercontent.com` host, which is outside this sandbox's allowed egress. The small ignored capture directory has not been populated or committed. The capture harness is ready for a controlled native run; its pixels, clipping, physical size, text legibility and 2K/4K scaling remain uninspected until then. The only supported render target remains the repository's 640×360 logical viewport at integer 2×/4×/6× sizes; non-integer scaling, aspect ratios, camera subpixels, Web and game VFX are unproven.

## Read-only producer adapters — source-grounded but unapproved

### A3 PR #19 current head `08711ea7fdf887f8cb0b4df2c352220d9dbc4a78`

Read at current head: `docs/survival/economy/PRODUCT_PROGRESSION_AUDIT.md`, `A1_MATERIAL_MAPPING.md`, `A0_ACTIVE_TICK_HOST_CONTRACT.md`, the recipe/research schemas and actual catalog examples. The A3-authored vocabulary confirmed in source is:

- physical instance record: stable `soh_i_...` `instance_id`, `item_id`, `location`, integer `condition`/`max_condition`, `uses`/`max_uses`, revision and origin;
- `soh.economy.recipes.v1`: `knowledge: starter|recipe`, dictionary `inputs`/`outputs`/`fuel`, station, minimum tier, active `duration_ticks`, `required_technologies`, `balance_status: SOH_PROPOSAL`, provenance, and optional `consumes_specimen`;
- `soh.economy.research.v1`: technology inputs, prerequisites, research station/tier/time and `scope: permanent_profile`;
- schema-2 economy jobs: `queued`, `running`, `paused`, `ready`, `collected`, `cancelled`; host time and physical station authority remain A0-owned.

A3's physical instance schema does **not** itself contain UI fields named `equipped`, `formula_learned`, `can_equip`, `can_craft`, or `can_research`. Those are optional, source-specific owner projections. `survival_view_adapter.gd` validates and copies A3 instance identity and state; `recipe_presentation` translates catalog `inputs` and `fuel` into visible ingredient rows, but defaults actions closed. It does not authorize recipes, select a unique specimen, certify a station, or mutate A3. `knowledge: recipe` is not evidence that a player learned it; `formula_learned` must come from the permanent-profile owner. A research prompt shows the catalog's specimen item requirement but cannot claim the atomic sacrifice occurred.

A3's product progression report is explicitly simulation-only, with native Gold casts zero. The 8 proposed source aliases and 12 missing items remain unresolved. Do not silently equate A1 `frost_resin` to A3 `frost_shard`, `venom_sac` to `venom_spine`, `peat` to `coal`, or material keys to A3 item IDs.

### A1 PR #20 current head `91a3544983ff2712e66fd77997df24f59efb3a44`

Read at current head: `docs/survival/world/A0_ADAPTER.md`, `VALIDATION.md`, `hazard_capability_contracts.json`, `material_source_contracts.json` and `poi_route_graph.json`. A1 authors stable POI/cell/region/material/capability/hazard data and explicit statuses; it does not supply live discovery, SaveService spawning, native hazard damage or native exploration. The adapter requires the runtime owner to supply `discovered=true` before returning a map marker/hazard/material hint. Unrevealed records return empty. A1 material node status is preserved verbatim; `CONTRACT_NOT_SPAWNED` cannot be mistaken for gathering availability. Hazard severity and capability are authored clues/contracts, not measured player damage. A0/A3 remain owners of live state and mitigation.

### A0 PR #21 current head `b372258528e99058f6ae4b96a29db723fe58daf4`

Read the current PR body, `docs/survival/WORKLOG.md`, and source at this head. The report claims paid indoor beds, persisted overworld death bags, reload-safe pending death and safe-wake handling, plus partial generic unique-token protections. It expressly leaves production station/time host, full travel, A6 modal integration and visual acceptance open. `chapter1_overworld.gd` now checks visible `gameplay_modal` roots in `_handle_survival_input()` (so the polled build toggle/slot/place path returns early) and `_unhandled_input()` (so Escape does not retreat or close build mode through a visible modal). This A6 workspace now advertises that group; its scene stays hidden until opened. That is only the correct registry handshake, **not proof of the gate**: this workspace has not been mounted into the production scene or composed in a native test. More importantly, `knight.gd` continues to poll movement, attack, skill, relay, interaction, and other combat actions directly without consulting `gameplay_modal`; a visible modal therefore cannot yet claim combat-input safety. No combined A0/A6 modal regression or verified press/release/outside-click ordering is present. Production mounting remains HOLD until A0 gates every gameplay poll path and the combined native contract passes.

### Authority / acceptance status

| Contract | Status | A6 behavior |
|---|---|---|
| A3 item instance and catalog field names | Source-confirmed in PR #19; production UI adapter not approved | Preserve fields; optional equipment/formula/capability values stay owner-supplied. |
| A3 actual Core acquisition/equip/cast, specimen sacrifice, recipe learn, station queue | A3 owner code exists in draft PR; integration/authority and A4 Gold remain blocked | Display-only records and correlated requests to a host; fake host labels every response. |
| A1 static POI/material/hazard/capability terms | Authored contracts in PR #20; not native world runtime | Read-only projection requiring A0 discovery/ownership values. |
| A0 bed/death/respawn and polled input host | PR #21 WIP at `b372258`; visible `gameplay_modal` blocks overworld build polling and Escape/retreat only; Knight combat/movement polling remains ungated; no combined A0/A6 native modal test | A6 workspace joins the registry group but remains isolated; no respawn invocation, production mount, or live build/combat safety claim. |
| A4 original Gold fidelity/readiness | Owned elsewhere; no current UI proof | No Gold casts, VFX recreation or readiness badge claim. |

## V2 snapshot DTO (A6 proposal, not an owner API)

V2 deliberately bumps the UI-only envelopes to `soh.ui.snapshot.v2`, `soh.ui.intent.v2` and `soh.ui.response.v2` because the earlier V1 fields `found`/`learned` and `charges` did not reflect confirmed A3 source terminology. The same-sequence conflict rule, correlated idempotency key and host-current snapshot behavior from the recovered V1 design remain; a host still has to durably deduplicate and atomically decide.

- Core rows carry the confirmed A3 physical fields. Optional `equipped`, `formula_learned`, `can_equip`, readiness and UI name are separate producer projections; absent values render unknown and actions stay disabled.
- Recipe rows use A3 `knowledge`, `formula_learned` only when the owner knows it, station/tier/duration/queue, input/fuel ingredient rows, output IDs/quantities, `required_technologies`, and action booleans/reason supplied by the host. Missing formula state is not rendered as “not learned”.
- POI/hazard/material rows use canonical A1 IDs and statuses, plus runtime-discovered booleans from the dynamic world owner. The UI filter is defense in depth, not a secrecy boundary; producers must not send undiscovered private data.
- Research requests require a visible confirmation and recheck a current host capability; V2 still only emits intent. Respawn, transfer, craft, research and equip require an authoritative response and current snapshot. No click performs a mutation locally.

Full proposal and hazards remain documented in `V1_WORKSPACE_CONTRACT.md` and `README.md`; this document supersedes its stale V1 fixture terminology for continuation work while retaining the exact recovery source as provenance.

## Testing and independent baseline

- Recovered baseline targets remain `ui_test.gd`, `planner_test.gd`, `workspace_v1_test.gd`, `source_trace_audit.py`; `modal_lifecycle_test.gd` covers hidden-parent restoration/tree-exit reporting; this small `visual_capture.gd` is the only screenshot producer for the continuation.
- The audit was run with the exact Atlas and `SOURCE_COVERAGE_TRACE.json` read from recovery parent `1ee7e43da22adb4b9ce1647efbcb1b07988ceaf7` in an external temporary fixture: **PASS**, 1,355 lines, 108 IDs, 40 unknowns, 28 citations and pinned Atlas SHA `b958de0f...59157`.
- `gdformat --check` parsed all recovered and new UI GDScript files without syntax diagnostics. `gdlint` identified an actual syntax failure in a recovered one-line lambda and a fixture indentation error; both were corrected. It still reports inherited style/line-length violations in old recovered files. This parser is not Godot's parser/runtime.
- The recovered dedicated Godot behavioral suites and 1280/2560/3840 rendered checks were **not run**: this environment has no Godot binary and official download failed at restricted egress. Current branch base is `main` SHA `5214788933b1a827f3a177d11ff486433dfe5e8a`, not the recovery parent; the current base also lacks the `SurvivalService` autoload and shared coverage-source files assumed by the original dedicated suite. No fake claim of a production-composed native baseline is made.
- No screenshots, import caches, or rendered bundles are tracked. Godot caches remain ignored by `.gitignore`; the visual script writes only under ignored `.artifacts/a6-ui/`.

## Next gates

1. Run import + all four dedicated Godot tests at 4.7 on a source-complete A6/A0 composition, inspect exactly the bounded frames at 1280×720, 2560×1440 and 3840×2160, and fix real parser/runtime/clipping/readability defects.
2. Have A0 gate all direct `Knight` gameplay polling as well as overworld build/pause paths, then run a combined native A0/A6 test proving visible-root discovery and suppressing movement/combat/build from press-through, release-after-close, cancel and outside-click sequences. The workspace's group membership is only an adapter handshake; no production wiring before that contract passes.
3. Have A3 approve actual adapters for unique Core instance identity, permanent formula state, recipe/source knowledge, station/tier/queue, transaction receipts and failure codes; combine negative tests against its real services without copying them.
4. Have A1/A0 approve runtime discovered-POI/hazard/capability/material producer fields; preserve the twelve missing materials, eight proposed aliases and not-spawned statuses until owners resolve them.
5. Obtain A4 source/version/readiness evidence before any Gold claim; then perform real-world visual checks across bright, rainy, vault and Gold-heavy scenes, plus human keyboard/mouse/controller review and Web/non-integer scaling review.

No self-merge. PR #22 remains recovery provenance. A separate continuation review is required before any production integration.

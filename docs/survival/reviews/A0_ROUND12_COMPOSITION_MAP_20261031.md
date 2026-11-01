# A0 Round 12 — owner composition, precedence and conflict map (WP-A0.1)

Status: **composition tooling and conflict map are real and run locally; native
execution of the composed tree is NOT tested yet in this document.** This is an
A0 integration record. It does not accept any other owner's work as product
evidence and it does not claim a player journey.

Round 12 objective: ONE connected production player journey. That is only
possible if the four owner branches can be joined without silent overwrites.
The old temporary workflows did `cp -a .a6-source/game/survival/ui/ .`, which is
not reproducible, not auditable, and silently dropped every A6 change outside
that one directory.

## Exact pins used

| Owner | Ref | SHA | Scope files copied |
| --- | --- | --- | --- |
| A1 (geography, art, stands) | `arena/e385312a-soul-of-hero` | `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf` | 269 |
| A3 (items, recipes, economy) | `arena/7a12b27e-soul-of-hero` | `b44e22df3af40939069189be14afc23ee1ce21c4` | 22 |
| A8 (POI content, neutral intents) | `arena/2d7e6d7a-soul-of-hero` | `6337533f7cc0d39487921e279d3967ac29a59297` | 63 |
| A6 (presentation) | `arena/05e0328d-soul-of-hero` | `81c1f57ea01396686eb155af5b36fe8a64921a52` | 95 |
| A0 (integration, world, save, run) | `arena/dea2428e-soul-of-hero` | the branch head this document ships on | the whole base tree |

Every pin is a full 40-character SHA. `tools/a0/compose_owners.py` re-resolves
each ref and refuses a short ref, a symbolic ref, or a missing object.

## Precedence

`a1 -> a3 -> a8 -> a6`, then A0 resolutions applied last.

Precedence only decides which owner is asked first for a file; it never silently
resolves a file two owners both changed. Those become entries in
`composition.json` and `CONFLICTS.md`, and the composer fails if one is
unresolved.

## Conflict map (measured, not asserted)

The composer diffs each owner against the merge base `51225718` and classifies
every changed file:

- **In scope** — copied from the exact SHA.
- **Out of scope** — refused and listed with a count and examples. A1 carried
  178 out-of-scope files (mostly `docs/survival/world/**` evidence PNGs and its
  own tools), A3 132, A8 10, A6 85. Refusing them is deliberate: a docs image or
  an owner's private harness must not be able to change A0's runtime.
- **A0 integration surface** — a file A0 owns that an owner also changed. These
  are the only real conflicts, and each one has exactly one ruling:

| File | A0 changed | Owner changed | Ruling |
| --- | --- | --- | --- |
| `game/autoload/save_service.gd` | +85 / −4 (Round 11 survival + reset) | A6 +173 / −0 (player identity) | **A0 resolution**: reviewed three-way merge in `tools/a0/merges/save_service.gd`. One service, no second wallet, no second clock. A6 authored the identity block; A0 owns the file. |
| `game/overworld/chapter1_overworld.gd` | +33 (economy composition, art candidate, **Round 12 threat mount**) | A6 +28 / −1 (carry sampling, material naming) | **A0 resolution**: `tools/a0/merges/chapter1_overworld.gd`. |
| `game/ui/screens/title/title_screen.gd` | +9 (A0 started the run in `_start_new_game`) | A6 +3 / −1 (new profile → avatar choice) | **A6 wins**, and A0's hook is dropped: starting the 336 h clock on the title screen, before the player had an identity or a world, was the weaker moment. The mounted world opens a run when none exists (`a0_economy_composition.gd`), which is still fail-closed. A0 keeps the requirement `world_opens_run_when_absent` and proves it in its own suite instead of depending on A6's file. |
| `tests/survival_normal_entry_home_restart_test.gd` | A0 oracle | A6 adapted it to the identity step | **Accept**: the A6 version is strictly stronger (New Game → avatar choice → Home, and still fails if Home does not open). Recorded here because an owner touched A0's oracle. |
| `game/app/app_flow.gd`, `game/app/app_root.gd`, `game/overworld/overworld_hud.gd`, `game/survival/economy/economy_panel.gd`, `game/survival/chest_inventory_panel.gd`, `game/survival/survival_build_system.gd`, `game/survival/player/player_avatar_presenter.gd`, `game/characters/knight/knight.tscn` | none | A6 | **Accept owner version.** A0 changed none of them. A0 still verifies the seats it relies on and runs its own journeys against them. |

Reproducing the map:

```bash
python3 tools/a0/compose_owners.py --repo . --out .composition --copy-base \
  --owner a1=9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf \
  --owner a3=b44e22df3af40939069189be14afc23ee1ce21c4 \
  --owner a8=6337533f7cc0d39487921e279d3967ac29a59297 \
  --owner a6=81c1f57ea01396686eb155af5b36fe8a64921a52
python3 tools/a0/check_composition.py .composition
```

## Seat check (runs before any native job)

`tools/a0/check_composition.py` resolves every `preload`/`load`/`ext_resource`
and every autoload in the composed tree, plus the A0 APIs A0 promises to
presentation. Result at the pins above:

```
seat checks: 2090, problems: 0, known stale: 2
COMPOSITION SEATS PASSED
```

The two known-stale references are printed, not hidden, and each carries the
owner action:

1. `tests/survival_a6_modal_composition_test.gd` → `res://game/survival/ui/expedition_workspace.tscn`.
   A6 published that scene at `8bc0af5a` and `63d3fae5` and withdrew it in its
   rewritten history (first absent at `9afb7c8c`, still absent at `81c1f57e`).
   A0's earlier modal claim therefore describes a scene A6 no longer ships.
   Round 12 does not claim it; A6 must publish the current workspace scene name.
2. `tools/survival/web_probe.tscn` → `res://game/survival/web_probe_ci.gd`, which
   was already missing at A0 base `738e621b`. Pre-existing, dormant, unrelated.

## Attribution of the old V4 failure — by SHA, not by report title

The pinned PASS `41166608047` (A6 `6b801554`) and the later failure
`41166608006` (A6 `8bc0af5a`) belong to a workflow that no longer describes any
current branch:

- `a0-a6-v4-latest-composition.yml` pins A1 `7fd000e1`, A3 `c363c7e7`, A6
  `8bc0af5a`. All three are stale today (A1 `9ca1453c`, A3 `b44e22df`,
  A6 `81c1f57e`).
- Its test list (`ui_test`, `planner_test`, `workspace_v1_test`,
  `modal_lifecycle_test`, `journey_test`, `player_first_hud_test`,
  `avatar_appearance_test`, `v4_storage_owner_integration_test`) exists **only**
  at `8bc0af5a`. At `81c1f57e` **none** of the eight files exists; A6 ships
  `a6_ui_layer_test`, `a6_a0_consumer_test`, `avatar_identity_native_test`,
  `a6_survival_return_native_test` and capture scripts instead.
- `game/survival/ui/expedition_planner.gd` and `expedition_workspace.*` exist at
  `8bc0af5a` and do not exist at `81c1f57e`.
- The planner at `8bc0af5a` parses cleanly (gdtoolkit 4.5.0, `gdparse` rc=0), and
  its preloads (`expedition_planner.tscn`, `planner_fixture.gd`,
  `survival_view_adapter.gd`, `survival_journal.tscn`) all exist at that same
  SHA. So the planner was not a parse failure *at its own SHA*; and no rerun at
  `81c1f57e` can reproduce anything about it, because the file is gone.

Conclusion: a V4 failure today is a **pin/name mismatch**, not evidence about
current A6 code. The Round 12 workflow therefore pins the four current SHAs,
composes them with this tool, and runs suites that exist at those SHAs. Anything
still true about `8bc0af5a` must be re-stated as history.

## What this document does NOT claim

- It does not claim the composed tree boots, renders or plays. That needs the
  native jobs.
- It does not accept A8's mount package, A3's bindings or A6's visuals as
  product readiness.
- It does not authorize any reward. A8 neutral intents remain requests.

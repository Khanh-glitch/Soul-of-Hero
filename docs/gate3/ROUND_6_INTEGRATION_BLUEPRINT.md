# ROUND 6 — Integration blueprint: staged, pinned, reversible

Planning document. **No branch was created, no file was moved, no PR was merged.** The
branch strategy below is a proposal for the owner to approve, not something Round 6 did.

---

## 0. Pinned revisions (reconcile before any work starts)

| Ref | Commit at the time of writing | Role in the plan |
| --- | --- | --- |
| `main` | `5214788` | the only shipping line |
| `arena/6e89e68d-soul-of-hero` (this branch) | `d7f6da7` | carries Gate 0–5; **already contains PR #3's content** |
| PR #3 `integration/chapter1-2-hero-web-playtest` | `1c21a49` | open against `main`; **ancestor of this branch** |
| PR #5 `design-pilot/levels3-4-candidate-a` | `1fd78f8` | 3 files, base = the branch below |
| PR #5 base `arena/b1c99a44-soul-of-hero` | `f27e8b7` | carries the L3/L4 redesign in `data/levels/` |

### Reconciliation check (run this before touching anything, every time)

```bash
git fetch origin --prune
git status --short                 # must be empty
git rev-parse HEAD origin/arena/6e89e68d-soul-of-hero    # must be equal
git merge-base --is-ancestor 1c21a49 HEAD && echo "PR3 content present"
git cat-file -e 1fd78f8:docs/design-pilot/LEVELS3_4_BRIEF.md && echo "PR5 reachable"
git show origin/arena/b1c99a44-soul-of-hero:data/levels/chapter_1_level_3.json | sha256sum
sha256sum prototypes/gate0/level_data/chapter_1_level_3_a.json   # must match the line above
```

This session already hit the failure mode the first line protects against: the workspace
silently reset to `main` and 349 paths were de-tracked. A branch that does not match
`origin/arena/6e89e68d-soul-of-hero` is not this branch.

### Two facts that reshape the dependency graph

1. **PR #3 is not a future merge risk for the runtime files — it is already in this
   branch's history.** `1c21a49` is an ancestor, and the four files a Gate 3 integration
   must edit are **byte-identical** to PR #3's head:

   | file | blob | equals PR #3 head |
   | --- | --- | --- |
   | `game/main.gd` | `f37799b` | yes |
   | `game/ui/hud.gd` | `f4eb216` | yes |
   | `game/characters/knight/knight.gd` | `ab3dfc9` | yes |
   | `game/heroes/hero_soul_manager.gd` | `62157a9` | yes |

   What remains is *sequencing against `main`*, not conflict resolution: PR #3 still has
   to land on `main`, and this branch is 342 commits ahead of `main` with 349 changed
   paths. Nothing in the plan below requires rebasing either one.

2. **PR #5's diff contains no level data.** Its three files are a workflow, a brief and an
   auditor. The L3/L4 rewrite lives on its *base* branch `arena/b1c99a44` (`f27e8b7`,
   28 commits not in this branch, 50 files, `level_3_crossfire_archive_builder.gd` +969
   lines, `data/levels/chapter_1_level_{2,3,4}.json` rewritten). Any decision to adopt
   Candidate A is a decision about **that** branch, and it needs its own promotion PR; PR #5
   as opened cannot deliver it.

3. **PR #3 does not touch `data/levels/chapter_1_level_3.json`.** It touches
   `game/levels/level_schema.gd`, `tests/content/content_contracts_test.gd`,
   `tests/chapter_1_collision_route_test.gd`, `tests/chapter_1_campaign_map_design_test.gd`
   and 80-odd map/test files for Levels 5, 6, 8, 10 and Chapter 2 — all of which are already
   in this branch. The Level 3 map is therefore a **serial** decision, not a merge conflict.

---

## 1. Dependency graph

```
                       ┌─────────────────────────────────────────┐
                       │ D0  owner: which L3 is content of record │  (decision doc §3.3)
                       └───────────────┬─────────────────────────┘
                                       │ A1 (canonical) / A2 (adopt Candidate A)
        ┌──────────────────────────────┼───────────────────────────────┐
        ▼                              ▼                               ▼
┌───────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ D1  PR #3     │            │ D2  PR #5 scope   │            │ D3  death flow   │
│ lands on main │            │ restated (L3 or   │            │ policy: A / B    │
│ (owner)       │            │ L4 only)          │            │ (owner)          │
└───────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
        │                             │                               │
        └──────────────┬──────────────┴───────────────┬───────────────┘
                       ▼                              ▼
        ┌────────────────────────────┐   ┌────────────────────────────────┐
        │ S1 authoring pass on the   │   │ S4 revival UX (only if D3 = B) │
        │ winning map (props, lights,│   │ 1 button + 1 policy, behind a  │
        │ material, shade, camera)   │   │ feature flag, no save change   │
        └──────────────┬─────────────┘   └──────────────┬─────────────────┘
                       ▼                                │
        ┌────────────────────────────┐                   │
        │ S2 presenter promoted into │                   │
        │ game/ + data/ + assets/    │                   │
        └──────────────┬─────────────┘                   │
                       ▼                                 ▼
        ┌────────────────────────────────────────────────────────────┐
        │ S3 native gates → S5 visual gates → S6 browser/Web gates   │
        └────────────────────────────────────────────────────────────┘
```

Hard sequencing rules:

* **D0 before S1.** Re-authoring props for the wrong map is the most expensive possible
  mistake in this plan (52 placements, all frames, all balance evidence).
* **S2 before S4.** Revival cannot be photographed or judged until a checkpoint and the
  Knight can both be seen (the `_tuck_checkpoints` fix is part of S2).
* **S3 before S6.** Browser work on an unverified native scene wastes CI minutes and
  produces slideshow-shaped evidence, as Round 5 §4.5 already warned.
* **D1 (PR #3 on main) is not on the critical path for this branch**, because its content is
  already here. It is on the critical path for *shipping*, and it must land before any
  promotion PR is opened against `main`.

---

## 2. Ownership map

| Area | Owner | May change without a new decision | Must ask |
| --- | --- | --- | --- |
| L3/L4 map documents (`data/levels/`) | design owner (PR #5 holder) | nothing in Round 7 | any envelope, entity or spawn change |
| Death-flow policy | owner (product) | nothing | any revival/roster/persistence rule |
| Gate 3 presenter code (`prototypes/gate3/`) | Gate 3 team | reads, tests, fixtures | promotion into `game/**` |
| Authoring tool (`tools/gate3/`) | Gate 3 team | parameterisation, door derivation, stair-loop removal | new map constants that encode a design decision |
| CI workflows | Gate 3 team | CI-only substitution probes, evidence steps | anything that runs on `main` or publishes |
| Evidence (`docs/gate3/evidence/`) | Gate 3 team | new evidence, never rewriting old | deleting or re-labelling published evidence |
| PR #3 / PR #5 branches | their authors | — | **nobody in this plan touches them** |

---

## 3. Staged plan

### S0 — Decisions (blocking, zero code)

| # | Decision | Evidence to hand the owner | Cost of getting it wrong |
| --- | --- | --- | --- |
| D0 | L3 content of record: A1 (canonical) or A2 (adopt Candidate A) | decision doc §3.2–3.5 | a full re-authoring pass in the wrong direction |
| D2 | PR #5 scope restated: L3+L4, or L4 only | decision doc §3.3, PR #5 brief vs PR #5 branch | two level documents claiming one slot |
| D3 | Death flow: keep A, or approve B | decision doc §4.3–4.4 | a gameplay rule shipped without approval |
| D4 | Promotion shape: presenter-in-engine vs level-authored tiles | reuse matrix §1 | if the owner prefers authored tiles, the whole presenter is unnecessary |

**Exit gate:** four written answers, each naming who approved it and on what date. Until
then S1–S6 do not start.

### S1 — Authoring pass on the winning map (prototype namespace only)

1. Fix the two authoring leaks first: derive `worldmodel.DOORS` from `floor_door` entities;
   remove or data-gate the `SHAFT_ROOM` stair loop in `build_material()`.
2. Regenerate the material document for the winning map; assert 100 % floor and wall
   coverage and 0 out-of-bounds cells before anything else runs.
3. Re-fit props; every rejection is a design decision, not a silent drop — record each one
   with its authored cell and the reason.
4. Re-derive lights, camera bands (with the canonical-overlap fix from reuse matrix §2.4),
   and shade.
5. Re-run `check_coverage`, `validate_routes`, `validate_prop_choke`,
   `worldmodel.py audit --level <winning map>`, and PR #5's auditor (re-pinned).
6. Regenerate all frames on the prototype path; nothing is promoted yet.

**Exit gate:** authoring checks green, prototype frames regenerated, no file outside
`prototypes/gate3/` and `tools/gate3/` changed.

### S2 — Presenter promotion (owner-gated, one PR)

Move, don't rewrite. File-by-file plan in §4. The PR must contain **only** moves, the
per-level lookup that replaces `EXPECTED_LEVEL`, and the reload re-attachment; no design or
balance change rides along.

**Exit gate:** native tests green on the integration branch; the presenter refuses to
attach to a level with no presentation document instead of painting nothing.

### S3 — Native Godot 4.7 gates (see §6.1)

### S4 — Revival UX (only if D3 = B)

Behind `LevelPresentationConfig.revival_enabled` (default off) so the flag can be turned
off in a Web build without a revert. No save-format change. Behaviour specified in the
decision document §4.3.

### S5 — Visual gates (see §6.2)

### S6 — Browser / Web gates (see §6.3)

---

## 4. File-by-file change plan

### 4.1 Presenter promotion (S2)

| From (prototype) | To (production) | Change allowed during the move |
| --- | --- | --- |
| `prototypes/gate3/gate3_redesign.gd` | `game/levels/presentation/level_presenter.gd` | rename, replace `EXPECTED_LEVEL` with a presentation-path lookup, split the respawn director out (delete), keep every coverage proof |
| `prototypes/gate3/visual_placement.json` (949 KB, generated) | `data/presentation/<level_id>.presentation.json` | regenerated for the winning map — **not** copied |
| `prototypes/gate2/art/archive_tiles.png` | `assets/environment/archive/archive_tiles.png` | none |
| `prototypes/gate2/art/props.png` + `props.json` | `assets/environment/archive/props.png` + `props.json` | none |
| `prototypes/gate2/art/light_radial.png` | `assets/environment/archive/light_radial.png` | none |
| `prototypes/gate3/art/peaks_1..4.png` | `assets/environment/archive/hazards/` | **deferred** (reuse matrix §3.6) |
| — | `game/levels/presentation/presentation_config.gd` (new) | per-level lookup + flags |
| — | `data/presentation/manifest.tres` or registry entry (new) | level id → document path |

### 4.2 Production files that must change (minimal set)

| File | Change | Why it is unavoidable | Risk |
| --- | --- | --- | --- |
| `game/main.gd` | attach the presenter after `level.reload_from_disk()` **and** on `GameEvents.map_changed`; detach before re-attach | `_on_level_data_changed()` (`:833`) respawns entities and calls `_apply_camera_bounds()` (`:247`) | medium — this is PR #3's file; keep the diff to ~15 lines |
| `game/main.gd` | let the presenter own the camera limits when it is active | `_apply_camera_bounds()` writes whole-map limits and calls `reset_smoothing()`; the presenter only re-applies limits on a *band change*, so after a reload the camera stays on whole-map limits until the player crosses a storey boundary | high if ignored — this is the "band staleness" defect |
| `game/levels/dungeon_level.gd` | none expected | `reload_from_disk()` already emits `GameEvents.map_changed` | — |
| `game/ui/hud.gd` | unchanged for S2; S4 only | revival is S4 | — |
| `game/autoload/*` | **none** | no new singleton, no new manager | — |
| `project.godot` | none expected | the presenter is added by `main.gd`, assets are `res://` paths | — |

**Explicitly forbidden by the standing constraints:** a second Knight, a second HUD, a
second campaign manager, a new autoload singleton, new TileSet sources inside
`data/levels/chapter_1_level_3.json`, or any substitution of the production JSON.

### 4.3 Tests and CI

| File | Change |
| --- | --- |
| `tests/chapter_1_campaign_map_design_test.gd`, `tests/chapter_1_collision_route_test.gd`, `tests/content/content_contracts_test.gd`, `tests/chapter_1_balance_matrix_test.gd` | **unchanged** — they must keep validating the production path |
| `tests/presentation/level_presenter_test.gd` (new) | asserts attach/refuse/idempotent-reattach and coverage, on a headless run |
| `tools/design/levels3_4_pilot_audit.py` (copy under `tools/`) | re-pin `BASE` to the winning L3 blob and `SLOTS[3]` to the winning entity count |
| `.github/workflows/gate3-runtime.yml` | keep as the prototype evidence workflow; drop the `cp … data/levels/chapter_1_level_3.json` substitution once S2 lands (it is only legitimate while the fixture is a fixture) |
| `.github/workflows/godot-runtime-validation.yml` | add the presenter test to the headless job; **never** run a substitution step on `main` |

`gh workflow run` is 403 in this environment; CI is triggered by pushing a commit. Plan CI
time accordingly and batch changes into one push per stage.

---

## 5. Conflict prevention

1. **One slot, one document.** Never let two paths claim "Level 3". If A2 is chosen,
   `prototypes/gate0/level_data/chapter_1_level_3_a.json` becomes a *copy* of the production
   file and the prototype must read the production path, not a private copy.
2. **No substitution outside a runner.** The `cp` in `gate3-runtime.yml` is legitimate only
   for the prototype fixture; anyone who commits that copy has broken the frozen-path rule.
3. **Diff budget.** `main.gd` is PR #3's file and a shared surface: the integration should
   be a handful of lines around `reload_from_disk()` / `map_changed` / `_apply_camera_bounds`.
   If it needs more, the presenter's lifecycle contract is wrong and should be fixed in the
   presenter, not in `main.gd`.
4. **Never touch PR #3 / PR #5 branches, never rebase, never force-push.** Reconcile by
   reading heads (`gh pr view --json headRefOid`), not by merging.
5. **One PR per stage.** S2's PR contains moves; S4's PR contains gameplay. Reviewing them
   together is how a gameplay change gets approved by accident.
6. **Evidence immutability.** New evidence goes in new files; published logs and screenshots
   are never rewritten (Round 5 §2.7 records what happened the one time a `tee` clobbered a
   log).

---

## 6. Acceptance gates

Legend: **[now]** can run on this branch today · **[S2]** needs the promoted presenter ·
**[S5]** needs the visual pass · **[S6]** needs the Web export.

### 6.1 Native Godot 4.7 (hard gates — a green build is not acceptance)

| # | Gate | Status |
| --- | --- | --- |
| N1 | Canonical contracts: `chapter_1_campaign_map_design_test`, `chapter_1_collision_route_test`, `content_contracts_test`, `chapter_1_map_design_test`, `chapter_1_balance_matrix_test` green on the **production** path | **[now]** green on `23ca6a8` (run `40093897442`, job "Import and headless runtime tests") |
| N2 | Full traversal on the winning map with the presenter on: every storey, every door, every required objective, spike-avoidant | **[S2]** |
| N3 | Live collisions: player-sized shape query against the presenter-active scene (props included) — not just the JSON | **[S2]** |
| N4 | Hazard visibility: every authored spike is visible and animated at 1× and 3× with the presenter on | **[S2]** |
| N5 | Both Hero death flows: (a) reserve alive → relay, overlay never appears; (b) no reserve → defeat overlay. Asserted on signals, not screenshots | **[S2]** |
| N6 | Campaign entry → completion → persistence: enter L3 from the campaign, finish, verify `SaveService` record and that a reload does not duplicate loot | **[S2]** |
| N7 | Runtime re-attachment across reloads: touch the level JSON, let `reload_from_disk()` fire, assert exactly one presenter, one prop set, one collider per prop, and camera limits equal to the active band | **[S2]** — **this is the gate most likely to fail first** |
| N8 | Survivability without prototype-only help: no `--respawn`, no harness director, no scripted input; measured on the production input actions | **[S2]** |
| N9 | Revival flow (only if D3 = B): the four assertions in decision doc §4.5 | **[S2]** |
| N10 | No engine errors, and no `push_warning` from the presenter on the happy path | **[S2]** — the Web smoke fails on warnings |

### 6.2 Visual (paired evidence, independent score)

| # | Gate | Status |
| --- | --- | --- |
| V1 | Paired production screenshots at 1280 × 720 and 1024 × 576, presenter off/on, same commit, same station list | **[S5]** |
| V2 | **Floor-2 arrival first impression**: door landing not at the frame edge; the recorded 45.3 % defect resolved *by geometry*, not by camera statistics | **[S5]** |
| V3 | Floor-3 camp frame exists and reads as a camp | **[S5]** |
| V4 | Rock repetition at 1× and 3×, with the 32-px period re-measured (autocorrelation, reuse matrix §2.3) | **[S5]** |
| V5 | Legibility: Knight, enemies, hazards and checkpoints readable in every frame | **[S5]** |
| V6 | Independent score from a reviewer who did not author the change, recorded with its rubric | **[S5]** |

No camera manipulation to inflate composition percentages. `camera_frame_report()` describes
frames; it is not an objective.

### 6.3 Browser / Web

| # | Gate | Status |
| --- | --- | --- |
| W1 | Real boot in Chromium through `tests/ci/web_playtest_browser_smoke.cjs` — title screen **and** live gameplay entity population | **[S6]** the harness exists; the presenter has never run in it |
| W2 | WebGL2 overlay renders: 12 `TileMapLayer`s, the full-map shade sprite (linear filtering), 45 props, 10 `PointLight2D`s | **[S6]** |
| W3 | Frame-time distribution with a production baseline on the same runner — not a single number | **[S6]** |
| W4 | Draw calls and memory vs baseline; the only existing figures are software GL (+112 nodes, +1 266 objects, 227 → 96 draw calls, 15.44 → 17.05 ms) | **[S6]** |
| W5 | Floor-door traversal in the browser (the Web build must not lose the doors) | **[S6]** |
| W6 | Zero console errors **and** warnings (the smoke script fails on both) | **[S6]** |
| W7 | Exported-resource check: every presentation document and atlas is actually inside the export | **[S6]** |
| W8 | Save smoke test: local save loads, no schema drift | **[S6]** |

Web export packaging notes that follow from the current setup: preset `Web Playtest`
(`export_presets.cfg`, `build/web/index.html`), single-thread templates, and
`web-playtest-pages.yml` builds from a *selected* branch — it will not automatically pick up
this branch. The 949 KB placement document and the atlases are the largest new payloads in
the export, and W7 has to prove they were packaged.

---

## 7. Runtime contract details the integration must honour

### 7.1 Reload / re-attachment (the sharpest edge)

* `game/levels/dungeon_level.gd::reload_from_disk()` (`:51`) re-applies Backdrop, Geometry
  and Decor and emits `GameEvents.map_changed`. A 0.55 s file watcher calls it from
  `_process()` whenever the JSON's modified time changes — including in a packaged build
  where the file is read-only (the watcher simply never fires).
* `game/main.gd::_on_level_data_changed()` (`:833`) re-derives the entity signature,
  respawns entities, resets the spawn if it moved, and calls `_apply_camera_bounds()`.
* Therefore a presenter that attaches once will, after the first reload: keep its props and
  colliders over freshly spawned entities (**duplicate props, orphaned colliders**), paint
  material for the old geometry, and lose its camera limits to `_apply_camera_bounds()`
  without ever re-applying them (the band only changes on a storey crossing).
* Required contract: `detach() → re-attach()` on `map_changed`, idempotent by level id, and
  the camera limits re-applied inside the same handler.

### 7.2 Both Hero combat/respawn state

* The presenter must never touch `knight.health`, the hero pools, `hero_soul_manager`'s
  snapshots, or `GameSession.checkpoint`.
* The revival rule (S4) acts only through `knight.respawn()` — which already restores every
  hero pool, barrier, mana and stamina — and must not re-implement any of it.
* Death overlay lifecycle stays owned by `hud.gd`. The presenter must not pause or unpause
  the tree. This is the specific defect of the prototype director: it arms a
  `create_timer(1.2, true)` that runs while paused and calls `respawn()` behind the HUD's
  back.

### 7.3 Save and campaign progression

* `GameSession.checkpoint` is in-memory and reset per run; nothing in the revival path may
  write it to `SaveService`.
* Loot/progress persistence runs through `SaveService.transact_once` with transaction keys;
  the presenter must not touch `SaveService`.
* A Web build with the presenter enabled must still pass W8; if it does not, revert S4 first
  (gameplay) before blaming S2 (presentation).

---

## 8. Rollback

| Stage | Rollback | Cost |
| --- | --- | --- |
| S1 authoring | delete regenerated documents; prototype evidence only | minutes |
| S2 promotion | feature flag per level (`presentation.enabled = false`) keeps the merged code dormant; the presenter already refuses to hide any production layer without a 100 % coverage proof, so "off" is genuinely the shipped look | one flag, no revert |
| S4 revival | flag off returns exactly today's flow (overlay → restart) | one flag |
| Any stage | per-stage PR means a single `git revert` per stage; no stage is entangled with another | one revert |

The presenter design makes rollback cheap *because* it is additive: it adds layers, props and
one shade sprite and hides production layers only behind a proof. There is no format change,
so no save migration is ever needed to roll back.

---

## 9. Out of scope for this plan

* Level 4 (PR #5 owns it; nothing in Gate 3 has ever touched L4).
* The broader art direction or the rock-frame replacement.
* Any redesign round, any new evidence architecture, any new harness.
* Any change to PR #3 or PR #5 or their branches.
* Any rebalancing. Balance is *measured and reported* (decision doc §4.2), never silently
  tuned.

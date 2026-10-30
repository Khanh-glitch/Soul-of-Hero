# A8 Round 10 worklog — three-POI native input journeys

**Disposition: `PARTIAL_WITH_BLOCKERS`.** This is a continuation of PR #26 on `arena/2d7e6d7a-soul-of-hero`; no second PR, merge, production acceptance, or human play is claimed. The implementation source is prepared for the next exact-head CI run. Until Godot 4.7 journeys and exact-SHA CI actually execute, the new journey suite is implementation evidence only.

## Source truth and owner baseline (WP0)

- Revalidated open PR #26 from reviewed head `3030ba753bf78610f3c2f45906b4b7a40421a3d7`; exact-head A8 native (`41098737595`), runtime/rendered (`41098737590`), and handoff (`41098737598`) runs were still **queued** at the source review. The current patch requires a fresh run at its pushed implementation SHA.
- Refreshed owner heads: A0 PR #21 `4b4b63f56b92c2f7b50d770554afd96d5d0a098b`; A1 PR #20 `7d2b017c8a90b7d5e24ff85f065ff1b18548cd29`; A3 PR #19 `35214ed8f555350b83bd8985e9bec7512f3181e8`. Each remained open. Their baseline-comparison checks are not treated as A8 gameplay evidence.
- Inspected the current Product Contract, D062–D074, POI/DEP/JOURNEY source, current A8 site definitions, existing phase/transition tests, owner-projection contract, and the test-only action catalog. The fixture catalog's fictional costs/rewards are not A3 authority and are not used by the new journey authority.
- Confirmed the four lifecycle boundaries remain A0-owned and unmodified: season is at most 14 real days including offline; abandon/death/evacuation are distinct; closure resets gameplay state except achievements, run history, and physically secured Ragnarok currency; Ragnarok is the final 72 hours; unbanked currency remains vulnerable until a physical deposit; repeated deposits do not end the run; evacuation does. This A8 work changes none of those rules.
- Read-only search of the inspected A3 `world_source_bindings.v3.json`, `meta_economy.v1.json`, and planner source found no `south_crown_mill`, `repair_waterwheel`, or `recover_fastener` production binding. This is absence evidence, not authorization. Mill repair/fastener terms remain **`WAITING_FOR_A3_A0`**.
- A local Godot 4.7 release-asset download failed with `EOF` at the GitHub release-assets host. A source build was started from the official 4.7-stable codeload archive with a minimal LinuxBSD configuration after the container's missing `pkg-config` initially blocked SCons. It failed while linking `libcore` after 42m41s with `No space left on device`; no runnable engine was produced. The extracted source remains in ignored `.artifacts/toolchain/godot-4.7-stable`; only its incomplete generated object cache was cleared to restore workspace space. Local native status is `NOT_RUN`, not pass. Even a successful minimal editor build would not stand in for Xvfb visual acceptance.

## Implemented A8-owned work (WP1–WP3, WP5)

- Added `tests/survival/world_content/native_poi_input_journey_test.gd`, a frame-driven test for the existing `poi_pilot.tscn` and `player_probe.gd`. It injects physical key events through Godot's input parser, waits for physics frames, and records live position, collision observations, action intent, phase/run identity, and real shell/site transition signals. It does not assign actor positions, call `request_test_motion`, force an intent, or bypass collision. Existing scene-spawn/interior-doorway anchors remain the normal scene mapping.
- Added `PoiJourneyAuthorityFixture`, an explicitly A8-only projection fixture with no inventory, currency, save, economy, timer, or production approval API. It applies only source-authored site state and test-seeded owner capability/readiness projections. Its schema-required `clock_seconds` is a constant zero placeholder and never advances. A fixture seed is not evidence of an A3 binding.
- The planned input matrix covers both Quarry brace/chock paths and proves the unselected route remains colliding; Orchard clear/leave choices, blocked/open boardwalk movement, owner-ready graft-mark reading and retreat/revisit; Mill observation, no-capability physical access rejection, a distinctly labelled test-only salvage/readiness projection for the A8 wheel presentation, physical approach to the fastener source, no-readiness/no-intent/no-extra-state, a real pending repair request rejected after owner capability/projection revision changes, and retreat/revisit. A separate gate falsification probe reverses the locked Mill gate's one-way direction and expects physical unauthorized entry, then restores the safe direction and retreats using live input.
- Added source-faithful presentation assertions and capture code for exterior baseline, interior baseline and changed states. The journey requests 23 scenario captures per resolution (69 PNG requests total across 1280×720, 2560×1440, and 3840×2160 Xvfb runs), including owner-projected state, a pending-request revocation state, and a capability-revocation difference. Capture generation is not visual review; until the PNGs are actually inspected, status remains `VISUAL_NOT_REVIEWED`.
- In `south_crown_mill.json`, `repair_waterwheel` and `recover_fastener` now require `owner_ready_required`. The fastener action still also requires `cap_salvage` and `mill_wheel=turning`. Without an owner-projected ready action, A8 does not emit the intent. `native_poi_site.gd` now gives generic owner-readiness feedback rather than an Orchard-only message for every action.
- No A0 SaveService, A1 master geography, A3 economy/reward implementation, AVFX Gold timeline, project-wide actor, or production mount was changed. The three existing POI identities/assets are preserved.

## Player-value and revisit comparison (WP4)

| Existing site | First-hour motivation and distinct choice | Physical/revisit consequence in the A8 test projection | Retreat | Still not genuinely playable/approved |
|---|---|---|---|---|
| **South Quarry** | Notice an unstable seam; brace the east shelf, chock the west ramp, or leave it untouched. | The selected brace/chock changes the visible prop/path and opens its specific route while the alternate route remains collision-blocked; the player can return and see the persisted owner-projected route. | Existing south doorway and shell return remain. | Extraction cost/yield, capability effect, finite work-face value and route risk remain A3/A0-unapproved. No stone grant. |
| **South Orchard Ruin** | Quietly inspect the sluice; clear it or leave the channel blocked. | Owner-projected `flowing` removes the authored deadfall and opens the fixed boardwalk; owner-ready `read_water_marks` reveals the existing graft clue. Retreat/revisit preserves only the projected presentation. | Existing boardwalk/south doorway; weather/tide remain unknown. | No honey, herb, farming yield, time/cooldown schedule, or economic value is authorized. The fixture readiness seed is not a live clock. |
| **South Crown Mill** | Read the stopped race marks safely; repair the wheel or leave it seized if an owner later projects legitimate salvage/readiness. | The test-only readiness seed can exercise the A8-authored turning-wheel props/path. Without salvage capability the physical gate blocks entry; if capability is revoked after approach, a new owner projection must prevent further action. After repair the test reaches the fastener source, but absent owner readiness prevents intent and grants nothing. | Both locked Mill gates are explicitly one-way for safe outward retreat; a frame-driven negative case reverses the collider direction to prove the mutation permits unauthorized entry, then restores the safe direction and physically exits. Runtime remains pending. | No A3 binding for repair or fastener was found. Costs, capability authorization, fastener source/reward, finite cycle/cooldown and actual production route all remain **`WAITING_FOR_A3_A0`**. |

This is A8-local route/presentation work, not proof of strategic balance, real economy, a mounted A0 Hero, or the expected 14-day experience. There are no six playable bosses and no new POIs.

## WP0–WP6 and mission A–F disposition

| Work package / mission | Result at this checkpoint |
|---|---|
| **WP0 / Mission A — source, baseline, tools** | Source/owner refresh completed. Official release download failed; local source build then failed on disk capacity before producing an engine. Exact new-head CI must be queried after push. |
| **WP1 / Mission B — physical three-site journeys** | Journey code implemented with actual input events and three-site choices. Godot execution is **NOT_TESTED** at this checkpoint. |
| **WP2 / Mission C — phase/boundary/adversarial** | Existing A8 phase, terminal, stale projection, replay, transition, and fixture adversarial suites remain regression coverage; the new journey run asserts ordinary run/phase identity. Capability-revocation and deliberate one-way-gate mutation probes are now implemented but **NOT_TESTED** until native execution. Full per-site before/at/after 264/288/312/336-hour matrix and pending-exit case remain **NOT_TESTED**. No clock was added. |
| **WP3 / Mission D — readable/source-faithful visuals** | Journey-mode UI now says `projection fixture only · no live economy/save` and marks the owner seed read-only. 20 Xvfb captures are requested per resolution, including shell/interior baseline, owner-projected choice/state and capability-revocation states. No capture has been generated/inspected yet. |
| **WP4 / Mission E — revisit value and authority honesty** | Comparative table recorded above. Unsupported A3 terms remain `WAITING_FOR_A3_A0`; no fake economic acceptance. |
| **WP5 / Mission F — seams and negative evidence** | Mill repair/fastener are gated on owner readiness; fastener remains blocked without a trusted projection. No A0/A1/A3/AVFX owner adapter became available, so production integration remains fail-closed. |
| **WP6 — validation, review and delivery** | Local Python authoring/unit checks and GDScript lint/format checks pass. New Godot tests, visual review, exact-head Actions, and independent review are pending. PR #26 remains open and unmerged. |

## Local checks actually executed

- `python3 -m unittest discover -s tests/survival/world_content -p 'test_*.py'` — **29 passed**.
- `python3 tools/survival/world_content/author_site.py --check` — **passed**, four site files and references resolved.
- `gdformat --check` / `gdlint` for changed GDScript and native tests — **passed** after formatting.
- Workflow YAML and changed site JSON parse; `git diff --check` — **passed**.
- These are not Godot runtime, rendered visual, production integration, or human-play passes.

## R0–R5 (independent review protocol) and nine strict gates

Values use the protocol's `PASS / FAIL / NOT_TESTED / NOT_APPLICABLE`; scoped static/source evidence is not promoted to runtime/product acceptance.

| Review layer | Verdict | Scope/evidence |
|---|---|---|
| **R0 — primary-source intent** | **PASS (scoped)** | Product Contract, D062–D074, Atlas POI/DEP/JOURNEY and source-coverage constraints were refreshed; no old lifecycle rule was reintroduced. |
| **R1 — patch/dependency forensics** | **PASS (scoped)** | Changed files are A8/test/workflow/docs only; owner boundaries and the three site IDs are preserved; fixture catalog not promoted. |
| **R2 — independent test-oracle scrutiny** | **NOT_TESTED** | Static checks pass, but the new input oracle and its adversarial false cases have not executed in Godot 4.7. |
| **R3 — actual Godot and visual truth** | **NOT_TESTED** | No completed local engine run, exact-head native CI result, or visually inspected screenshot yet. |
| **R4 — system/value and 14-day replay** | **NOT_TESTED** | The table assesses scoped motivations only; no real economy, full connected loops, human play, or replay cadence is accepted. |
| **R5 — binary verdict/integration authority** | **NOT_TESTED** | Independent coordinator review and owner-composed production tests remain outstanding. Overall task disposition stays `PARTIAL_WITH_BLOCKERS`. |

| Strict gate | Verdict | Reason |
|---|---|---|
| `RESEARCH_PROVENANCE` | **PASS (scoped)** | Current source anchors and relevant locked rules reviewed; no new external asset or research claim introduced. |
| `ARCHITECTURE` | **PASS (scoped)** | A8-only fixture stays projection-shaped and has no transaction/save authority; protected owner files untouched. |
| `CODE_RUNTIME` | **NOT_TESTED** | GDScript lint/format is not engine execution. |
| `TEST_ORACLE` | **NOT_TESTED** | The new frame-driven suite still needs exact Godot 4.7 execution and falsification. |
| `VISUAL_UX` | **NOT_TESTED** | Three-size capture is configured, but no images inspected. |
| `SYSTEM_VALUE` | **NOT_TESTED** | No production source-to-sink, rate, or long-form player evidence. |
| `SAVE_MIGRATION` | **NOT_APPLICABLE** | This A8-isolated fixture has no SaveService or durable state. A0's save path is not tested here. |
| `INTEGRATION` | **NOT_TESTED** | A0/A1/A3/AVFX production mounts/authorizations are absent; no owner code changed. |
| `BALANCE_REPLAY` | **NOT_TESTED** | No creator-approved cost/reward/rate or human replay evidence. |

## Exact evidence handoff

The authoritative SHA for an implementation claim is the exact branch head shown by `git rev-parse HEAD` and the matching GitHub Actions `headSha`, not a prior 923-check fixture run. The current pushed head at dispatch was `3030ba753bf78610f3c2f45906b4b7a40421a3d7`; its native/runtime/handoff runs above were queued, not passed. New exact-head CI URLs and outcomes must be added to the PR handoff after this patch is pushed and queried. Until then: `PARTIAL_WITH_BLOCKERS`, `NOT_TESTED`, `VISUAL_NOT_REVIEWED`, `NOT_HUMAN_PLAYTESTED`, `HOLD_PRODUCTION`.

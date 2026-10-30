# A8 Round 10 PR #26 handoff

**Verdict:** `PARTIAL_WITH_BLOCKERS` / `HOLD_PRODUCTION`. Continue only on PR #26, branch `arena/2d7e6d7a-soul-of-hero`. Do not create a second PR, merge, or treat a fixture/capture filename as product acceptance. See [`A8_ROUND10_WORKLOG_20261031.md`](A8_ROUND10_WORKLOG_20261031.md) for work packages, player-value comparison, R0–R5, nine-gate verdicts, and local-check detail.

## Implementation summary

This PR continuation adds a deterministic, frame-driven native input journey suite around the existing A8 pilot/probe, a projection-only test authority, Mill owner-readiness gates, source-faithful presentation assertions, and an Xvfb three-resolution capture loop. Both Mill gates now use explicit one-way outward retreat when locked. The suite requests 23 screenshots per resolution (69 total) and includes a pending-request capability-revocation race, physical retreat, and an isolated collider-direction mutation probe. It preserves the existing Quarry/Orchard/Mill identities. No actor-position assignment is used by the journey test; the existing authored exterior/interior spawn mappings remain part of scene transition behavior. Engine execution and capture review are still pending.

The test owner projection is explicitly fictional and read-only with respect to A0/A3 product authority. It can change only A8 site-state projections; it has no item, currency, save, clock-advance, reward, or run-finalization capability. The test-only action catalog remains separate and is not referenced by the new journey authority.

## Owner seams and requested actions

### A0 — run, actor, scene and save owner

- Keep the current A8 contracts `soh.native_poi.intent.v3` and `soh.native_poi.transition.v2` neutral. The new test records run ID/epoch, ordinary phase, site instance, observed revisions, physical actor position, and actual transition signals only from the A8 phase fixture.
- Before production mounting, provide/review an exact runtime projection adapter for active A0 Hero/world state and owner-ready actions. The A8 pilot's invisible probe is not the canonical Hero.
- Validate exact source/action identity, active run/epoch/phase, actor/range/facing, and replay/idempotency in the existing owner path. Preserve the one SaveService authority. A0 must not infer A3 approval from A8 site data or fixture readiness.
- Normal-entry/full-world A0 mount, persistent canonical positioning, restart and owner-transaction evidence remain separate blockers. The guarded Waystation candidate is not proof the A8 POI route wedge is fixed.

### A1 — geography/source owner

- Existing three site identities and current art/collision anchors are preserved; no new POI or endpoint socket was added.
- Review any production mount/route against current A1 bytes. No A1 file was edited. The four proposed Ragnarok endpoint sockets remain unapproved; six territory proposals remain data, not six playable bosses.

### A3 — economy/reward owner

- The inspected current A3 source files contain no binding for Mill `repair_waterwheel` or `recover_fastener`. Please either publish an exact source/action/capability/readiness authorization (and creator-approved costs, yields and cooldown only if intended) or keep both unavailable.
- A8 now requires `owner_ready_required` on both Mill repair and fastener interactions. The frame-test projection seeds readiness for repair only to exercise A8's source-authored state/presentation path; this is explicitly not an A3 binding. Fastener readiness remains absent and the test expects no request, item, or state change.
- Quarry/Orchard/Mill costs, yields, source allocation, cooldowns and rates remain `WAITING_FOR_A3_A0`. The fixture catalog's fictional values are not acceptance evidence.

### AVFX / A5 / human QA

- AVFX Gold timeline and A5 boss/combat are untouched. No A8 fake boss, Gold substitution, or reward was added.
- Inspect generated 1280×720, 2560×1440 and 3840×2160 PNGs for crisp 16px art, contrast, route-choice legibility, shell/door clarity, and site-specific visual differences. If inspection cannot be completed, record `VISUAL_NOT_REVIEWED`.
- Normal-human play through a production-mounted A0 Hero, economy, return/revisit, restart and failure cases remains `NOT_HUMAN_PLAYTESTED`.

## Verification requirements after push

1. Query PR #26 head and make sure the A8 native, runtime/rendered, and handoff jobs all report the exact pushed SHA. The prior runs at `3030ba753bf78610f3c2f45906b4b7a40421a3d7` (`41098737595`, `41098737590`, `41098737598`) were queued at the source review and are not passes.
2. Run the new input journey at all three configured resolutions; inspect native logs, assert counts, confirm the 23-request-per-resolution PNG set and file hashes. Verify the pending-request revocation race, outward retreat, and that the reversed-direction mutant is detected by observed unauthorized entry. Any failure must be fixed in A8-owned code and rerun on a new exact SHA; no screenshot filename alone is a pass.
3. Keep R0–R5 and the nine strict gates scoped as in the worklog. If engine/CI remains queued, report `PARTIAL_WITH_BLOCKERS`; if screenshots remain uninspected, report `VISUAL_NOT_REVIEWED`; if live A0/A3 authority is absent, keep `HOLD_PRODUCTION`.
4. Do not close or merge PR #26. A0/A1/A3 owner acceptance and independent review are not replaced by this handoff.

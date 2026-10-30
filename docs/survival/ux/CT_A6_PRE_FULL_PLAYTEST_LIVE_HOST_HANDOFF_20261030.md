# A6 — Live Player-Facing UX Integration Readiness
2026-10-30 | USER_DISPATCH_REQUIRED / NOT_PRODUCTION_MOUNTED. New scoped follow-on after V3/V4 specialized CI success at PR24 9d123899. Do not edit A0 owned source.

## Evidence and purpose
Read current PR24 source and docs/survival/ux/V4_PLAYER_FIRST_HUD_HANDOFF_20261030.md; DECISIONS D045/046; ACCEPTANCE P2–P7; A0 PR21, A1 PR20, A3 PR19. A6 V3 41008097621 PASS; V4 41008097505 PASS; 41008097544 Godot import and Xvfb captures PASS. Total workflow fails on original-main baseline comparison and must be triaged separately. Scoped pass is not product use.

Stop producing isolated demo shells. Deliver an owner-authority-compatible, visually inspected integration package in A6-owned paths only: game/survival/ui/**, tests/survival/ui/**, docs/survival/ux/**, scoped A6 CI. A0 SaveService/SurvivalService is single owner; A0 chest interactions are only live host authority. No UI local mutated SaveService or fabricated positive owner projections.

Implement/test:
1. Ordinary actual A0 survival states, selected stack/chest transfer requests and truthful rejection, all UI-open modal-world-pointer gating and focused inputs, no staleness, double request, duplicate or false readiness.
2. Player-visible bed/death-bag/recovery, workshop/queue/research and discovered-only hazard/route hints. Show physical Core instance/charges/custody distinctly from learned recipe and unverified A4 cast. Ensure Core ownership before first cast can be seen; no fake happy path.
3. Create character-choice UI for exactly the two LOCKED original Male/Female Adventurer ZIP avatars only if true original bytes and source rights are accessible; don't use Craftpix 555940/419402 substitutes, don't demand shooting animations. If bytes unavailable, deliver verified import manifest/seam and clear BLOCKED_FOR_SOURCE, not an invented final avatar.
4. Pin latest A0 PR21 for read-only source composition, run Godot 4.7 native tests in isolated A6 workflow and capture actual 1280x720 / 2560x1440 / 3840x2160 frames. Inspect actual screenshots/readability; don't let a bare screenshot existence count as Gold or game signoff. Don't duplicate A0 region/provisions HUD.
5. Hand off exact versioned UI request/projection DTO and minimal scene-mount instructions for A0 host, idempotency, authority, input gating, source pin and rollback. Only A0 makes the actual production mount or approves it. Honest product status remains NOT_INTEGRATED until a single true player journey in Godot.

Commit/push owned source and test/evidence with exact SHA; report passing and failing tests and blocked artifact rights. No self-merge, no unrelated UI redesign, no extra generic demo.
# MEC-01 R3 handoff — mechanics depth & causal-integrity audit (R4 scope, PR #44 untouched)

**2026-11-08. Response to CONTROL TOWER "MEC-01 R3 — mechanics depth & causal integrity" (P0–P4 program).**
**Status: P0 COMPLETE · P1 COMPLETE (audit) · P2 COMPLETE (probes, zero new engine defects) · P3 RECORDED (no game-code change, by discipline) · PR #44 REMAINS OPEN / DRAFT / UNMERGED. Do not merge on the strength of this document.**

Session branch: `arena/a9d7aa20-soul-of-hero` (HEAD at handoff = the P3/P4 doc commit; see `git rev-parse HEAD`). PR #44 head is `arena/d4bfcfff-soul-of-hero@2a4db2a` — **this session's commits are intentionally NOT pushed to the PR branch** (fast-forward to PR branch requires explicit user instruction).

## P4 deliverable index

1. **Exact final SHA + real logs** — see "Verification matrix" below. P0 = `df11d2f`; P2 = the causal-integrity test commit; P3/P4 = the docs commit (all on `arena/a9d7aa20-soul-of-hero`). Full suite logs: `/tmp/r3-p0-suite.log`, `/tmp/r3-p2-suite.log`. Typecheck logs: `/tmp/tsc-tests3.log` (app, 0 errors), `npm run -s typecheck:tests` → 0 errors (whole tests/ tree now strict).
2. **Coverage matrix** — `docs/survival/MEC01_R3_AUDIT.md` §3 (K1–K8, C01–C24 roll-up incl. per-edge uncovered failure modes) and §5 (Atlas SYS01–SYS18 roll-up — with the explicit provisional/no-v11-CSV caveat; no XEDGE closed).
3. **Implemented causal network + verified physical flows** — §3.9 (C-registry statuses; flow evidence: source→crate→custody→craft→settle→reload→reclaim, escrow physical arc, death→bag→reload→spend, E2 arc). `shipping_fresh` remains a TEMPORARY mechanical test world; no travel-economics conclusion about the final Map is drawn from it.
4. **Confirmed bugs fixed with reproductions** — one this round: **b03-return false-pass harness defect** (setup omitted the anchor `x,y`; the hidden-POI exclusion assertions ran against `undefined` and passed vacuously). Fix: setup returns `x,y`; suite re-verified 9/9 with real coordinates; full suite green. Reproduction: checkout HEAD~N(df11d2f^), run `npx vitest run tests/b03-return.test.ts` with the anchor removed and observe `expect(...).not.toMatch(...)` always passing; after fix the assertions carry meaning. (Historic R2 note: `delivery.json` bike-vs-foot result stands as DATA only, not a mechanic rejection — unchanged.)
5. **Remaining canonical mechanic gaps ranked by consequence** — §4 (G1…G8) of the audit: C16 first-chest PROPOSED (creator lock pending — R3-O1), C21 backend VERIFIED ranking missing by design (R3-O3), C20 score-uniqueness unproven (N1), C09/K6 offline defense unproven (W07-R; R3-O2), C11/C15/C22/C24 final-map topology/beacons/spawn (Map, R3-M1…M6), Atlas-proposal strata SYS12/13/14/18 (G6, R4 triage N5).
6. **Map / owner dependencies, NOT blocking** — §6 of the audit, items R3-M1…M6 (Map: oil-source contract, evac beacon, final72 cash route/POI suite, vehicle geometry, spawn-eligible mask, loot deposit ledger) and R3-O1…O4 (creator: first-chest lock; offline-defense model; A6 24h forecast; backend).
7. **Next executable scope** — audit §7 (N1 C20 adversarial score-uniqueness; N2 harness-anchor lint sweep; N3 offline-defense truth model after R3-O2; N4 re-verify matrix on FINAL map per R3-M answers; N5 R4 Atlas-strata triage). No work in N3/N4 may start before its owner answers R3-O2/M-series.

## Verification matrix (real commands, real outputs)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` (via `npm run typecheck`) | **PASS, 0 errors** |
| `npm run -s typecheck:tests` (`web/tsconfig.test.json`, strict, src+tests+`vite.config.ts`) | **PASS, 0 errors** (was 134 errors at R3 start; every one fixed or honestly scoped) |
| `npm test` at P0 `df11d2f` | **99 files passed \| 1 skipped (100); 722 tests passed \| 1 skipped (723)** — identical to R2 baseline `6bcb712`; no regression from the ~30 test-file edits |
| `npm test` after P2 (new `tests/mec01-r3-causal-integrity.test.ts`) | **100 files passed \| 1 skipped (101); 725 tests passed \| 1 skipped (726)** (+3 new probes, 0 lost) |
| New probes standalone | **3/3 green** (two-bench gear race; recycler-holds-UID refuses craft; one canister → one refuel only) |
| `npm run build` (single-file) | NOT run; known packaging blocker (exit-137 OOM) unchanged from R2 — not claimed |
| Browser/S3 visual, Gold pixels, S4/S5 human evidence | NOT RUN — automation never claims readiness; E3 backend does not exist; LOCAL/UNVERIFIED labelling is honoured |

## What R3 did NOT do (deliberately)

- No engine/game-code changes. The two apparent exploits classes (forged-reservation laundering at load; cross-system UID races) resolve to either reusable custody invariants (proven) or trust-boundary items (backend, by design). See audit §4.4.
- No catalog-entry counting; no Atlas→mandatory conversion; no balance verdicts on `shipping_fresh`; no fun/engagement/excitement claims of any kind; no NATURAL_INPUT fabrication (new probes labelled FIXTURE_INTENT position + granted materials); no PR #44 changes; no pushes to any other branch.
- W07/W08/W09 remain PARTIAL exactly as previously reported (offline turrets reserve power but never fire offline; combat-sound stimulus exists; player-playable sound exists). No XEDGE-001–104 is closed; the v11 Atlas CSV was not re-read (not in this checkout).

## Known limits / residual risks (explicit)

- Test-only fixes may have preserved sub-optimal typings elsewhere (tests compile strict; strictness now gates PRs — coverage of `src/` strictness unchanged from R2).
- The new probes exercise `shipping_fresh` layout specifics (road line for the bike; buildable patches for benches). They will fail loudly if the temporary world layout is regenerated in a way that removes roads/patches — investigate, do not delete.
- C20 adversarial score uniqueness is UNPROVEN (gap G3 → next scope N1). Do not represent the run score mechanism as exploit-free.
- Legacy saves (`reserved === undefined`) cannot be auto-repaired; the engine safely refuses them (no invented refunds) — the intended migration is "let them finish through the bag flow", unchanged.
- Final acceptance of ANY of this against the final Map happens in N4, not before.

## R4 entry prompt (suggested)

1. Creator decisions R3-O1 and R3-O2 (blocks N1 scope acceptance and N3 start).
2. Map intake per R3-M1..M6 → re-run K2/K3/K6/K7/C11/C13/C15/C22/C24 cells of the matrix (N4).
3. N1 + N2 (small, independent), then creator triage G6 (N5).
4. Keep PR #44 DRAFT/UNMERGED; all of the above stays on `arena/a9d7aa20-soul-of-hero` until the creator lifts the HOLD.

*Crossrefs: audit `docs/survival/MEC01_R3_AUDIT.md`; R2 handoff `docs/survival/MEC01_R2_HANDOFF.md` (R3 addendum appended there); ledger `docs/survival/gameplay-depth/CAPABILITY_LEDGER_W00.md`; causal companion `docs/survival/gameplay-depth/CAUSAL_GRAPH_W00.md` (not required to change in R3).*

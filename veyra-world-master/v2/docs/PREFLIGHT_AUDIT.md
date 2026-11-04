# WMP-02 / MAP-LR03R — Independent preflight & M-G3/M-G4 audit

Status: **COMPLETE, independently reproduced**. All work below was performed in the
isolated copy `/tmp/wmp_preflight_verify` so that **no WMP-01 evidence byte was
modified**. This document is additive and lives only under `v2/`.

## 1. Exact refs observed (2026-11-04, Asia/Saigon)

| Item | Exact value |
|---|---|
| Working branch | `arena/2e3cfbd2-soul-of-hero` (ACTIVE) |
| Map local HEAD at preflight | `d0221688076f823b5e15fe9c1050406928eafbca` |
| Map remote HEAD at preflight | `d0221688076f823b5e15fe9c1050406928eafbca` (local = remote) |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` (untouched) |
| PR #44 | **OPEN / DRAFT**, base `arena/4795760e-soul-of-hero`, head `arena/d4bfcfff-soul-of-hero` |
| PR #44 head at preflight | `8206869f627128e700c64a41f8c9ee29912aee84` |
| Gameplay commits since `d1c56a45…` | `c664c449` (Clarify recycler and workbench interactions), `8206869f` (Record partial Core and Chitin gameplay evidence) |
| WMP-01 chain (historical, preserved) | `7342972c… → 5322e91d… → d0221688…` |
| Worktree at preflight | clean (`git status --porcelain` empty) |
| Only Map LR03/WMP-01 handoff comment | `6624249473` @ `2026-11-04T06:27:49Z` (NOT duplicated) |
| New Gameplay comment | `6624475878` @ `06:42:42Z` — M-CORE-03S partial/HOLD, **no Map task** |
| New CT verdict | `6624745510` @ `06:59:41Z` — CONTINUE_WORK / PARTIAL ACCEPT / **NO MERGE**, explicitly "No new features or Map work", "Map Agent remains on MAP-LR03/WMP-01 and must not be interrupted or reassigned", no independent CI, no acceptance |

The CT verdict does **not** start an agent (it says a separate one-shot Arena prompt is
required). This corrective round is driven by the user's direct MAP-LR03R instruction,
not by a PR comment. No other-owner branch was modified; no merge was performed.

### 1b. Concurrent activity observed at final push (same date, later)

| Item | Exact value |
|---|---|
| PR #44 head at WMP-02 push | `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` (was `8206869f…` at preflight) |
| New Gameplay commit | `d73aa63f` — "Document M-CORE-03T assisted recovery and partial E04" (45 files, evidence/docs only) |
| New comment | `6625624576` @ `2026-11-04T07:52:25Z` — M-CORE-03T PARTIAL / DRAFT / HOLD / DO NOT MERGE |
| Contract check | `git diff --name-only 8206869f..origin/gp44-live` contains **no** `world-economy.ts`, `geography-contract.ts` or `web/src/game` change, so the read-only contract inspection above remains valid |
| Map relevance | "No Map request, Veyra changes or new Recycler development"; no independent human/statistical balance verdict, no visual acceptance, no merge |

`8206869f…` remains the exact head inspected for the consumer contract; it is **not**
reported as the current live head.

## 2. Independent reproduction of the reported evidence

Command (isolated copy, no writes back into v1):

```
cp -a veyra-world-master /tmp/wmp_preflight_verify
cd /tmp/wmp_preflight_verify && ./reproduce.sh
```

Observed: `WMP_BUILD_OK … roofs=153 vertical=18 proposed=10 blockers=8 chunks=70`,
`WMP_VIEWS_OK`, `WMP_TESTS 75/75` (M-G0 15/15, M-G1 5/5, M-G2 13/13, M-G3 8/8,
M-G4 12/12, M-G5 22/22; 12 negative fixtures), `WMP_CLEAN_ROOM_OK`, `WMP_ARTIFACT_INDEX_OK
files=51 bytes=1462745 manifest=327bf48c05c92d9c`, `WMP_REPRODUCE_OK`.

Pinned values reproduced exactly:

- `manifest.v1.json` SHA-256 `327bf48c05c92d9ce0ee3ddf1281aca9ce2a47dcf47ede81dc524f80e86e313e`
- `revisionDigest` `8e3e76da5b7f8db35c66322b0236ef37599b4d2dfbe381ea7b2e5ae176d38e4f`
- `data/source_manifest.v1.json` SHA-256 `c1f0b7a8664656842d97df95a63ee93a258268b6856ac579f27c1908a072cc4d`
- `layers/scales.v1.json` SHA-256 `6013292c9a61151b9900e165d7a03831c44810db31cd4ea1aa5a89c684317a2b`

The isolated source tree remained clean after that run.

## 3. M-G3 / M-G4 audit: COVERAGE/DOCUMENTATION PASS ≠ physical-completion PASS

Full machine-readable classification: `v2/layers/preflight_audit.v2.json`.

Explicit **DOCUMENTATION_PASS** tests (they pass *because an unresolved blocker is
documented*, not because anything physical was fixed):

- `M-G3-03` — asserts 10 proposed + 8 named blockers = 18 and that blockers carry
  `BLOCKED` / `verticalSeparationAu=null` / `UNRESOLVED` strings.
- `M-G4-04` — passes because `cartPassable=false` and `deckStatus=UNRESOLVED` are recorded.
- `M-G4-06` — passes because 7 disconnected roads, 8 blocked ferries and crossing
  defects are preserved as strings.
- `M-G4-07` — passes because alternate candidates exist and are non-canonical.
- `M-G4-08` — passes because `>0` envelopes have unresolved water overlap. The v1
  overlap count (12) was itself **wrong**; see the build-envelope reconciliation.
- `M-G4-10` — does include a real BFS reachability check (classified PHYSICAL_CHECK),
  but `stockAndCash=UNKNOWN` and `sweptClearance=UNKNOWN` remain documented unknowns.

Real but limited physical checks already present: `M-G3-02` (bbox containment only),
`M-G3-04` (shaft centre inside overlap bbox only), `M-G3-06` (direct LOS counts),
`M-G4-01/02` (chunk digits and stable IDs), `M-G4-05` (centreline clearance vs 3
assumed body widths), `M-G4-09` (spawn/home counts), `M-G4-10` (BFS legs).

**Verdict:** v1 M-G3/M-G4 are predominantly COVERAGE / DOCUMENTATION passes; physical
completion was NOT proven. WMP-02 adds real collision, connectivity, bidirectional
traversal, negative-counterexample and re-derivation checks, and explicitly separates
`COVERAGE`, `INTEGRITY`, `PHYSICAL` and `NEGATIVE_FIXTURE` test kinds in
`v2/evidence/tests/results_v2.json`. No BLOCKED item was promoted to PASS for being
better documented.

## 4. Consumer contract inspection (read-only)

Read from `8206869f627128e700c64a41f8c9ee29912aee84`:

```
git show 8206869f…:web/src/game/world-economy.ts       # EconomyMap, validateEconomyMap, compileEconomy, diagnoseStarts
git show 8206869f…:web/src/game/geography-contract.ts  # GeographicHandoff, validateGeographicHandoff
```

`projectWindow()` in `api/intake.mjs` emits 5 masks (`tiles`, `fresh`, `zone`,
`seaDist`, `land`) — **not** a complete playable `EconomyMap`. WMP-02 supplies all 13
`EconomyMap` arrays plus every `GeographicHandoff` field, with Gameplay-owned
semantics explicitly `UNRESOLVED`. See `v2/docs/INTAKE_CONTRACT_V2.md`.

# WMP-03 PREFLIGHT AUDIT — live HEADs, concurrency, contract discovery

Date: 2026-11-04 (Asia/Saigon). All checks were executed, not assumed.

## 1. Named task contract

The task named `MAP_WMP03_P0_CORRECTIVE_HANDOFF.md` as the full contract. A comprehensive
search found **no such file**:

| Search | Result |
| --- | --- |
| `/home/user` (find maxdepth 5, filename and content grep) | 0 |
| Current Map HEAD tree (`git ls-tree -r --name-only HEAD`) | 0 |
| All 66 fetched remote branch trees (`refs/remotes/origin/scan/*`, `scan2/*`) | 0 |
| GitHub code search (repo-scoped and global, `MAP_WMP03_P0_CORRECTIVE_HANDOFF`) | `total_count=0` |
| PR44 issue/PR search (`is:issue` / `is:pr` corrected qualifiers) | 0 |
| All PR44 issue comment bodies | 0 |
| `git log --all --grep` for WMP03 / P0 | only unrelated older AVFX/C08/P0 commits |

**Resolution:** the operative contract used is the complete WMP-03 instruction text in the
user's task message, together with the WMP-01 / WMP-02 sources and the current Gameplay
Bible. This finding is recorded explicitly rather than silently substituting a document.
No `v3/` edit was made before this conclusion.

## 2. Live HEADs and concurrent activity (rechecked immediately before editing and again before commit)

| Ref | SHA | Note |
| --- | --- | --- |
| `arena/2e3cfbd2-soul-of-hero` (local + remote) | `c600f0410b2d47607f44b2882336dddd877dbbe9` | Map branch, clean worktree before edits |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` | untouched |
| PR44 head `arena/d4bfcfff-soul-of-hero` | `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` | OPEN, DRAFT, base `arena/4795760e-soul-of-hero`, `updatedAt 2026-11-04T07:55:34Z` |
| `origin/gp44-live` (force-fetched) | `d73aa63f…` | Gameplay branch |

PR44 last 8 comments end at `6625676255` (WMP-02 Map handoff, 07:55:33Z). No new Gameplay
commit, no new Control Tower verdict and no WMP-03 comment appeared during this round.
Comments `6625624576` (M-CORE-03T PARTIAL/HOLD) and `6625676255` are **not** new Map work
authorizations. PR44 remains **OPEN / DRAFT / HOLD / NO MERGE**; it is not merged, closed or
retargeted.

## 3. Current Gameplay Bible (read at live head)

`git show origin/gp44-live:web/ref/bible.md` → SHA-256
`8aa2ac6eee210a823c197e66ec8e12f93f149a9e7671e22889ffa3a5b08b4340`, 832 lines.

Relevant constraints honoured by v3:

- **§11.5 "MAP LEAD INTERFACE: geography as the final actuator, NEVER the gameplay author"** —
  Map receives inputs, not permission to choose prices/quests. v3 emits geometry with
  explicit `UNKNOWN / PROPOSED / VERIFIED` status and never asserts a Gameplay law.
- **§11.5.1 World ground truth** — "naturally graded terrain … Ground/water/buildable layers
  must be explicit." Motivates P0-01 and P0-04.
- **§11.5.3 Roads and cargo** — "necessary bridges/ferries **where approved** … An actual cart
  must pass geometry, slope and bridge collision." Motivates keeping ferry/bridge/ford as
  separate PROPOSED/BLOCKED geometry with **zero** active collision permission, and zeroing
  `cargoPassable`.
- **§11.5.4 Human home sites** — "**many buildable player-chosen positions** … rather than one
  mandated best starting base." Directly forbids restricting sandbox construction to 23 zones.
- **§11.5.5 POIs** — "approachable exterior … never automatically made all compulsory
  entrances." v3 reports the 26 source POIs without an exterior entrance by exact ID and
  redesigns none.
- **§11.5 proof packets (F)** — "640×360 1× pixel legibility … not just top-down paper
  metrics. Candidate map A/B/C mathematical height-mask and build percentages are NOT
  acceptance." v3's PNGs are labelled `TECHNICAL_PREVIEW__NOT_WEB_RUNTIME_PROOF__NOT_VISUAL_ACCEPTANCE`.
- **§11.3 C24 / §8.7** — "Map candidate geometry is distinct from A0/A3 committed receipts";
  placement/spawn is variable while terrain is stable. v3 keeps that separation.
- **§11.5 world-position costs** — "No invented km/minutes, number of chests, bank purchase
  cost or exact drop percentages." v3 invents no numeric balance.

## 4. Baseline reproduction (before any v3 edit)

Executed in an isolated copy `/tmp/wmp03_preflight_verify` using `./reproduce_v2.sh`:

```
WMP_V2_BUILD_DETERMINISM_OK 872502373e783b190f94a3c86065d6b3fd8c08d010b2ecc4130623f4283a682d
WMP_TESTS 75/75 gates=M-G0:15/15 M-G1:5/5 M-G2:13/13 M-G3:8/8 M-G4:12/12 M-G5:22/22
WMP_V2_TESTS 47/47 physical=29 negative=11 FAIL=0
WMP_V2_CLEAN_ROOM_OK digest=872502… noExternalCanonicalSource=true noLegacyLab=true noNetwork=true
WMP_V2_ARTIFACT_INDEX_OK files=102 bytes=5827481
WMP_V2_REPRODUCE_OK revisionDigest=872502…
```

Pinned source SHAs: `manifest.v1.json 327bf48c…`, `v2/manifest.v2.json 6954e17a…`,
`v2/handoff/geographic_handoff.v2.json 82d8b061…`. Source-tree `git status` was clean
after the isolated run.

## 5. Byte-preservation policy

`git diff --name-only c600f041 -- veyra-world-master`, excluding `v3/` and the two new root
scripts, is **empty**. All WMP-01 and WMP-02 tracked bytes — including
`evidence/artifact_index.v1.json` and `v2/evidence/artifact_index.v2.json` — are unchanged.
v1 `node tests/run.mjs` is executed **only inside the isolated clean room**, because running
it in the main tree rewrites a timing field in `evidence/tests/test_results.v1.json`.

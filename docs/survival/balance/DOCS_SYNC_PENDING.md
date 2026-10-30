# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 3)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim, unchanged since checkpoint 2):** `gh issue comment 16` → `Resource not accessible by
integration, Locations: [{Line:1 Column:49}]`. The session's GitHub integration can open pull requests but has
**no issue-write permission**. Permission blocker, not a content blocker: the text below is final.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) — checkpoint 3 entry appended and
read back. Checkpoint 1 at index `156980`, checkpoint 2 at index `175097`, checkpoint 3 after them.

**Action required:** someone with issue-write access posts the text below on Issue #16, then deletes this file.
Git — PR #25, `ACCEPTANCE_SCOREBOARD.md`, `PLAYER_BLOCKERS.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 3 — repinned against current owner heads, built an 8-link integration acceptance gate, and cut the
blocker list from five to four by closing two of them with measurement. Branch
`arena/353cf120-soul-of-hero`, PR #25 updated (**not** self-merged). No gameplay file, loot table, rate or other
owner's code was touched; only A7-owned balance/QA paths.

### 1. Repin (what changed since checkpoint 2)

| Owner | Head | Note |
|---|---|---|
| A0 | `77e434a7` | home entry unchanged; A0 now ships a byte-identical mirror of A3's source catalog (36/36 rows) |
| A1 | `2951bf85` | vertical-slice **handoff contract**: `rr_waystation_cache_claim`, 3 `iron_scrap` + 2 `knowledge_spares`, renewable 1800 s, transaction key `a1slice:poi_crown_waystation:cache_restock:1` |
| A3 | `18e7afcb` | unchanged data; yields already equal A1's (3 / 2 / 2) |
| A6 | `bed3fc81` | avatar adapter + art manifest: grade-0 `idle_sheet` empty, grades 1–2 `null` → honest `SOURCE_BLOCKED` |
| A8 | `f9ed82b9` | three native POI scenes, all `test_harness_only := true`, committed through `PoiAuthorityFixture` |

37 files sha256-pinned; the tool refuses to load on any byte drift.

### 2. Integration gate — the honest headline is `S0_ABSENT` at `L1_ENTRY`

Two chains (`waystation_cache`, `a8_quarry`) × 8 links (`entry → route → interaction → A3 authorization → A0
commit receipt → save/reload → no duplicate → useful outcome`), each link labelled `S0`–`S5`. **14 of 16 links
are blocked.** Static inspection can never exceed `S3`; `S4`/`S5` require the owner's native run, so they are
never reported. `gate.json` carries the exact native command strings mined from the owners' own workflows plus
the seven assertions an owner must see in a single run to earn `S4`.

Most important single fact: `SaveService.transact_once` is idempotent and A1's contract names the keys, but
**no mounted path calls it** — every reward that exists today is committed by a test fixture.

### 3. Four blockers (five → four; two closed by measurement)

| # | Blocker | Owner | Class |
|---|---|---|---|
| BLK-1 | No production mount: no interaction reachable with normal input | A0 (+A1/A8) | `MISSING_PRODUCTION_MOUNT` |
| BLK-2 | A1 already authorizes the first-hour cache; A3 has not adopted the binding | A3 (+A8) | `SOURCE_DATA_INCOMPATIBILITY` |
| BLK-3 | Mounted body is Knight art; locked avatar has no installed frames | A6 (+A0) | `PLAYER_FACING_VISUAL_DEFECT` |
| BLK-4 | Every existing reward path is fixture-only: nothing committed, reloaded or de-duplicated | A0 (+A8) | `FIXTURE_ONLY_SUCCESS` |

**Closed: "first research is a bootstrap cycle."** A1 authorizes 2 `knowledge_spares` per Waystation cache claim
(renewable, 1800 s) and `research_kit` is a **workbench** recipe needing 3 spares, so the ladder starts with no
station. Two claims (= one cooldown) reach it. **No free spares and no new loot rate were proposed** — the earlier
reading came from a static `make_spares` → research-station edge, and A3's yields already match A1's.

**Closed: "debug UI ships on screen and duplicates A0's HUD."** The old ~100-token figure was a whole-file grep.
On mounted surfaces the vocabulary sits behind `_developer_diagnostics` (default `false`), the survival UI is not
mounted by any production scene, and the three HUD scripts own disjoint jobs. `PROD-04/05/06` keep their broad
file-level verdicts as hygiene warnings; they are not re-tightened to manufacture agreement.

### 4. Quality checks for "half-built mistaken for finished"

Q-01 empty POIs · Q-02 duplicate HUD/developer text · Q-03 invalid item-source mapping · Q-04 avatar identity and
armour · Q-05 orphaned craft/research outputs · Q-06 buttons without an owner action · Q-07 fixture-only save
claims. **Six pass; only Q-04 fails** (the same defect as BLK-3, not a second ticket). Q-03 also compares A0's
mirrored catalog with A3's and fails on drift (currently `MATCH`, 36/36).

### 5. Tests: 191, no inflation

164 pre-existing (unchanged; `E[T]` for 4 spares still `3.525289745`) + 16 gate tests + 11 quality tests. Every
blocker's closure test builds the defective input, requires FAIL, applies the *one* owner edit, requires PASS —
and two negative tests prove the wrong fixes (inventing a rate, same-process reload) do **not** close them.
`run_analysis.py --check` → `artifacts up to date`.

### 6. Next smallest action

1. A0: one home destination mounting the existing A1 world host + A8 site scene, no test flag.
2. A3: adopt A1's rebind on two rows (`poi_id` only, no quantity moves).
3. A0: `transact_once` call site + a real two-process reload test.
4. A6: install the grade-0 idle sheet for one gender.

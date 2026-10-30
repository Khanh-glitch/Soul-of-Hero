# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 6)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (verbatim, re-probed this round):** `gh issue comment 16` → `Resource not accessible by
integration, Locations: [{Line:1 Column:49}]`. This session's GitHub integration can open and
update pull requests but has **no issue-write permission**. Permission blocker, not a content
blocker: the text below is final.

**Google Docs:** tab 04 (`t.h4haqfdoyzzn`, `04 · Nhật ký LIVE & bàn giao`) — checkpoint 6 is
appended after checkpoints 1–5.

**Action required:** someone with issue-write access posts the text below on Issue #16, then
deletes this file. Git — PR #25, `ACCEPTANCE_SCOREBOARD.md`, `PLAYER_BLOCKERS.md`,
`B0_ACCEPTANCE_MATRIX.md` — stays authoritative meanwhile.

---

## Text to post on Issue #16

A7 checkpoint 6 — **the gate was challenged and it failed once, in two different ways.** Branch
`arena/353cf120-soul-of-hero`, PR #25 updated (**not** self-merged). No gameplay file, loot table,
rate, price or owner code touched.

### 1. Repin

A0 `9269739e` · A1 `939720d5` · A3 `c5e80922` · A6 `08ccb834` · A8 `c8b4bc88` — 75 sha256-pinned
files. Every native state is `STALE_HEAD`; 33 workflow runs recorded (18 queued, 15 completed, all
15 failed). Nothing that ran on an older sha is quoted as current.

### 2. What the challenge found

**Hole 1 — reachability by comment.** `gate.entry_content()` counted a scene name that appeared
inside a `;` comment as an instanced scene, so an unmounted A8 site could read as `SOURCE_PRESENT`.
Fixed: only live `instance=` / `path=` / `preload(` lines count, comments stripped. The spoof is
now permanent as adversary probe `comment_mention`.

**Hole 2 — a red check filed as closed.** `PROD-04` (developer text on a player surface) could be
`FAIL` while the same payload mapped it to the closed bucket, so the failure was silently dropped;
and the vocabulary list included the wire key `"schema"`, so `intent.get("schema")` counted as
player prose. Fixed: display-sink literals are separated from unbound ones (2 vs 105 hits), the
verdict is `FAIL` only when the surface is actually mounted and `WARN` when latent, and `"schema"`
is off the list. Recorded as `CORR-13`.

**Hole 3 — a catalog that loaded empty.** The test fixture resolved A3's binding table by guessing
`a3.world_source_bindings.v3.json` while the writer stored `a3.world_source_bindings_v3.json`. The
miss produced an empty catalog, and an empty catalog answers "no binding exists" to every question.
Every oracle that needed A3 was quietly vacuous in the test path. Fixed: catalogs resolve through
the manifest's `source_path`; a missing one raises. Guarded by `A32` and adversary probe
`respelled_catalog_key`.

### 3. What the gate now says, with the numbers

* **15/15 spoof probes rejected** (`adversary.json`) — `NO_KNOWN_SPOOF_SURVIVES`.
* **33 assertions, 255 tests**, all holding.
* Claim **C** is `SOURCE_PRESENT_BEHIND_DISABLED_FLAG`, `reachable_by_normal_input = false`: A0
  `9269739e` really does mount the Waystation host and A1's slice geometry, behind
  `survival/a0_waystation_candidate`, which the shipped `project.godot` never declares.
* **BLK-2 is a one-file re-vendor, not an A3 change.** A0's host sends
  `si:r_ashen_crown:waystation_cache:01`; A3 `c5e80922` authorises exactly that row
  (`a1_waystation_roadside_cache_v3`); A0's vendored table still says `node_waystation_cache`, and
  A0's lookup is exact string equality. A3's re-canonicalisation also reopened `Q-03`: A0's mirror
  of `sources.json` diverges on `road_notes`, `road_scrap`, `road_supplies` (33/36 rows identical).
* **BLK-3 is `SOURCE_FIXED_PENDING_NATIVE`**, not an open source defect: 0 unknown engine statics at
  `c8b4bc88` (it was 15 at `5ccf7b3f`), and no native run has exercised the replacement.

### 4. Phase 3 — the first-hour probe that cannot lie

Two Godot 4.7 probes ship under `tests/survival/balance_native/`, subclassing A0's own
menu → Home → paid-shelter chain. They teleport nothing, inject no node, force no death, grant no
item, and take every coordinate from A0's own host (`matches_interaction()` decides the stand
cell). On today's heads the first one exits **2 (blocked)** at `L2_MOUNT`, and the death one exits
**2** because the composed overworld mounts nothing that can kill a player.

A7 has no Godot binary, so neither has been run: the artifact says
`PROBES_STATICALLY_SOUND_NOT_EXECUTED` / `NATIVE_UNEXECUTED`, and `A33` fails if that label is
changed. What is proved is the part A7 can prove: each probe extends the shipped chain, contains no
fabricating construct, and names only symbols present in the pinned bytes.

### 5. Smallest next action per owner

* **A0 (one line):** declare `survival/a0_waystation_candidate=true` in `project.godot`, then run
  `tests/survival/balance_native/first_hour_route_probe.gd` unchanged.
* **A0 (one file):** re-vendor `data/survival/items/world_source_bindings.v3.json` from A3
  `c5e80922` and re-sync `data/survival/items/sources.json`; that closes BLK-2 and Q-03 together.
* **A8:** run `a8-world-content-native.yml` on `c8b4bc88`; the source defect is already gone.
* **A6:** import one grade-0 idle sheet for one gender, and drop the two fixture labels at
  `acceptance_journeys.gd:241,340` before that viewer is ever mounted.
* **A5/A0:** give the overworld one authored hazard that calls `begin_overworld_death()`, so death
  recovery stops being `RUNTIME_UNKNOWN`.

### 6. Standing limits

No native run, no rendered frame and no human review backs any claim here. S4 stays 0 of 5 clauses
and S5 is not grantable by A7. The matrix at
`docs/survival/balance/B0_ACCEPTANCE_MATRIX.md` is regenerated from the same payloads, so it cannot
drift from the gate.

# DOCS_SYNC_PENDING — Issue #16 status comment (A7 checkpoint 6b, addendum)

**State:** `DOCS_SYNC_PENDING`.
**Blocker (re-probed):** `gh issue comment 16` → `Resource not accessible by integration`. This
session's GitHub integration can read and update pull requests but has **no issue-write
permission**. Permission blocker, not a content blocker: the text below is final.

**Why an addendum:** checkpoint 6 was already appended to the Google Doc tab and is accurate as far
as it goes. Work continued after it was written (a third probe, two new player-facing checks, a
seventh matrix row, and two more holes found in A7's own tooling). Rather than rewrite a posted
checkpoint, the delta is recorded here.

**Action required:** someone with issue-write access posts this after the checkpoint-6 comment on
Issue #16, then deletes this file. Git stays authoritative meanwhile — in particular
`docs/survival/balance/B0_ACCEPTANCE_MATRIX.md`, which is generated and therefore cannot drift.

---

## Text to post on Issue #16

A7 checkpoint 6b — **three more questions were asked of the owner code, and all three answers are
"not for a player yet".** Branch `arena/353cf120-soul-of-hero`, PR #25 updated (never self-merged).
No gameplay file, loot table, rate, price or owner code touched; A7 imported no art.

### 1. Two new player-facing checks, both FAIL, both one owner action away

**`Q-08` — every A8 site anchor lies outside the world A0 actually mounts.** The mounted world is
`448 x 256` tiles and the only imported annex is `(384,192)-(448,256)`. The three A8 anchors are at
`(30,280)`, `(140,300)` and `(140,360)`. A player cannot walk to an anchor past the map edge, so
A8's scene quality cannot reach anyone until A1 moves the anchors or A0 mounts a contiguous
extension. A8's own review already says `REJECT_FOOTPRINT_MISMATCH` for a 1:1 mount — this check
turns that prose into a number that flips.

**`Q-09` — the avatar seam A0 and A6 are being asked to accept does not exist.** No A0 production
file references A6's `avatar_appearance_adapter` or `avatar_art_manifest`; no production UI offers a
male/female choice; the mounted body is `knight.tscn`. A6's side is separately `SOURCE_BLOCKED`
(grade-0 paths empty). So an avatar acceptance test would today be measuring an intention, and the
native probe `avatar_body_probe.gd` says exactly that instead of passing.

### 2. Third native probe: the avatar interface, expressed as a contract

`tests/survival/balance_native/avatar_body_probe.gd` extends A0's own entry chain and asserts:
a chooser exists at normal entry → the mounted sheet is D051 `555940`/`419402` → four facings →
armour grade 0 → the same body after respawn → never the Knight. It stops at the first check
because there is no chooser. This is the interface test A0/A6 can be held to, written before the
work rather than after it.

### 3. The route probe got honest about coordinates

`first_hour_route_probe.gd` no longer contains a single authored cell. It walks with ordinary
movement input to whichever neighbour of the locker the **host's own** `matches_interaction()`
accepts, presses `interact` once, requires exactly one receipt and the authored sentence, presses
again and requires a refusal in words, then repeats at the cache. It has an opt-in
`--force-branch` mode that sets the project flag at runtime; that mode is labelled
`SOURCE_PRESENT_BEHIND_GUARD, not acceptance`, because setting a production flag from a test is not
evidence that a shipped build reaches the branch.

### 4. The adversary found two more holes — in A7's tooling

* **`P08`.** A fixture-only evidence file could be credited toward S4's `C4_authorised_commit`
  clause. Fixed structurally: the clause names `a0_waystation_player_input`, and a perfect green
  authority fixture now demonstrably leaves `C4 = NOT_HOLDS`. Pinned by
  `test_a_perfect_fixture_run_still_cannot_grant_s4`.
* **`P09`.** `Q-07`'s overclaim pattern recognised `SAVE_VERIFIED`/`DUPLICATE_PROOF` but not a
  `REWARD_VERIFIED` token, so a fixture could announce a reward nobody committed. The pattern now
  covers reward/loot/economy/grant claims, with a liveness test per alternative.

Both are the kind of hole that makes a QA board look greener than the product; they are recorded
rather than quietly fixed.

### 5. Numbers at this pin

A0 `9269739e` · A1 `939720d5` · A3 `c5e80922` · A6 `08ccb834` · A8 `c8b4bc88`; 75 sha256-pinned
files; 57 CI runs fetched with `--limit 10` (45 queued, 12 completed, all 12 failed); every native state `STALE_HEAD`.

* **34 assertions** (`A01`–`A34`) hold; `A34` fails the build if any named spoof survives.
* **269 tests** green; `run_analysis.py` green.
* **15/15** adversary probes rejected; **3/3** native probes statically sound, `NATIVE_UNEXECUTED`.
* Matrix: **`B0_NOT_MET`**, 7 rows, strongest `SOURCE_FIXED_PENDING_NATIVE`, each row carrying an
  exact SHA, a `verify_command` a reviewer can paste, the owner and the minimum fix.
* S4 remains 0 of 5 clauses and S5 is not A7's to grant: no native run, no rendered frame, no human
  review backs anything here.

### 6. Smallest next action per owner (unchanged, and now ordered)

1. **A0, one line:** `survival/a0_waystation_candidate=true` in `project.godot`; then run
   `first_hour_route_probe.gd` unchanged.
2. **A0, one file:** re-vendor A3's `world_source_bindings.v3.json` + `sources.json`; closes BLK-2
   and `Q-03` together. Without it the locker pays and the cache answers `unknown_source_instance`.
3. **A8:** run `a8-world-content-native.yml` on `c8b4bc88`.
4. **A1/A0/A8:** put the three site anchors inside the mounted world (or declare the sites interior
   instances entered from a canonical anchor) — `Q-08`.
5. **A6 → A0:** import one grade-0 sheet, then a chooser plus `avatar_appearance_adapter` mount —
   `Q-09` and `BLK-5` close in that order, not the reverse.
6. **A5/A0:** one authored hazard that calls `begin_overworld_death()`.

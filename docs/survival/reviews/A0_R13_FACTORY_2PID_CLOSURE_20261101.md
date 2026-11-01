# A0 R13 — Factory 2PID debt closed

**Date:** 2026-11-01
**Branch:** `arena/dea2428e-soul-of-hero` (draft PR #21, unmerged)
**Gate:** `.github/workflows/a0-connected-journey.yml` → `survival_normal_connected_journey_test.gd`
**Verdict run:** `41269852926` — **whole workflow success**, every step green.

The debt was recorded as *UNACCEPTED* in
`A0_R13_WORLD_AUTHORITY_20261031.md` §6 with the Round 12C failed evidence kept. It is
now closed by a two-process journey that passes on ordinary input, in the composed
tree, with no fixture grants.

---

## 1. What the run proves

| claim | receipt (run `41269852926`) |
| --- | --- |
| the journey passes in process 1 and process 2 | `connected journey process1=0 process2=0`; `A0 CONNECTED SURVIVAL JOURNEY PASSED - 62 checks (play)` |
| a player's **key** arms the paid job, not a method call | `A0_PREPARE_WORK raw allowed=true modal=false frame=1678` → `A0_PREPARE_WORK press` → `A0_PREPARE_WORK result=true station=b2 distance=9.1 prepared=["job_000005"]`; oracle side: `A0_CONNECTED_PREPARE result=armed taps=1 jobs=1` |
| the departure did **not** do the arming for it | departure is refused as already done: `"prepared":{"armed":{"job_000005":{…}},"ok":false,"prepared":[],"reason":"already_armed",…}` |
| the job survives the closure and is settled by the second process | `A0_CONNECTED_OFFLINE_SETTLE {"applied":{"applied_ticks":12,"completed":["job_000005"],"ok":true,…},"duplicate":false,"ok":true,…}` |
| the same save is not paid twice | `A0_CONNECTED_STAGE stage=verify_no_double_payment … checks=20 failures=0` |
| production captures at 1440p and 2160p | `capture 2560x1440 exit=0 3 images`, `capture 3840x2160 exit=0 3 images`, each PNG validated at exactly its resolution |
| the parse gate is green | `PARSE_GATE scripts=8 failures=0` |

Canonical-form receipts (verbatim, from the run annotations):

```
A0_PREPARE_WORK raw allowed=true modal=false frame=1678
A0_PREPARE_WORK press
A0_PREPARE_WORK result=true station=b2 distance=9.1 prepared=["job_000005"] refused=[]
A0_CONNECTED_PREPARE result=armed taps=1 jobs=1
A0_CONNECTED_DEPARTURE {"body_position":[840.816589355469,3362.40405273438],"ok":true,"persisted":true,"position":[840.0,3368.0],"prepared":{"armed":{"job_000005":{"duration_ticks":12,"elapsed_at_arm":0,"station_id":"b2",…}},"ok":false,"prepared":[],"reason":"already_armed",…}}
A0_CONNECTED_OFFLINE_SETTLE {"applied":{"applied_ticks":12,"completed":["job_000005"],…,"ok":true},"blocked":[],"duplicate":false,"ok":true,"operations":1,…}
A0_JOB_WAIT stage=wait_kit_ready job=job_000001 status=ready elapsed=8/8 wall_ms=9961 frames=30
A0_JOB_WAIT stage=wait_weave_ready job=job_000002 status=ready elapsed=6/6 wall_ms=7249 frames=22
connected journey process1=0 process2=0
PARSE_GATE scripts=8 failures=0
```

## 2. The six defects that were hiding the debt

Each one produced a *silent* failure, which is why the previous rounds kept re-running
the same red step.

1. **Collect was searched for by a sentence.** The composed A6 panel
   (`6d1e8bce`, read-only) draws `Job_<job_id>` rows whose action button reads
   `COLLECT`/`CANCEL` and whose state lives in a separate `Status` label. The gate
   matched a lowercase `collect` plus the word *ready*. An earned Collect control was
   invisible to the oracle. Fixed by finding the control by the job it belongs to
   (`_find_collect(panel, words, job_id)`), reopening the snapshot list when needed.
2. **A freed node was still being named.** A row press frees its own Button, and the
   shared helper read `.name` afterwards: `Invalid access to property or key 'name' on
   a base object of type 'previously freed'` aborted the coroutine mid-phase. Every
   post-press read is now `is_instance_valid`-guarded and reports `<freed>`.
3. **The press oracle read state before the frame could deliver the key.** Pressing `P`
   and reading `prepared_work()` in the same breath always saw an empty list, so the
   check failed while the departure armed the job behind its back. The oracle now taps
   like a person (up to five taps) and polls.
4. **The world the gate ran was not the world in the tree.** `game/overworld/chapter1_overworld.gd`
   is an `a0_resolution`: the composition copies `tools/a0/merges/chapter1_overworld.gd.merged`
   over it. Three commits of reach and press fixes never ran — the run's own probe
   proved it (`world_in_reach=no_method` while `session_in_reach=true`). The merge is
   refreshed and the composition step now **fails closed** on a stale merge.
5. **Prepare-work measured reach to the sprite's corner.** The panel let the player
   queue a smelt while the key said "stand at a workstation": 53.4 px from the
   furnace's origin, 9.1 px from the block it occupies. Preparing now asks the same
   `SurvivalStationReach` question the rest of the game asks.
6. **A3 judged the arming against a projection older than the furnace.** A player who
   builds a station and immediately prepares work was refused with
   `station_projection_unavailable`; the departure, which settles first, armed the same
   job. The key path now asks for a read-only plan before arming — nothing is
   committed.

Two further defects were found by turning on the parts of the gate that had been
skipped or lenient:

7. **4K was never rendered.** `xvfb-run`'s default virtual screen is 1280x1024, so the
   "3840x2160" window was clamped: a valid PNG at the wrong size, clicks landing
   elsewhere, and only two of three captures. The screen is now sized to the request
   and every PNG is validated at exactly the requested resolution.
8. **Below ~4 fps, no survival work progressed at all.** The session discarded any
   inter-callback gap over 250 ms as suspension. At 2160p a software frame takes ~380 ms,
   so a queued kit sat at `elapsed=0/8` for twenty seconds (`checks=15`) while the same
   kit finished in 7.8 s at 1440p. Long gaps are now **capped** at a quarter second per
   callback instead of dropped: a real suspension still earns almost nothing, a slow
   machine still gets the furnace it paid for.

## 3. Gates

| gate | verdict | evidence |
| --- | --- | --- |
| Factory 2PID (paid factory across two processes) | **PASS** | run `41269852926` step 8; 62 checks, 0 failures, both processes exit 0 |
| ordinary-input arming (key `P`) | **PASS** | press → `prepared=["job_000005"]`; departure reports `already_armed` |
| offline settlement (A3 planner, one SaveService) | **PASS** | `applied_ticks=12`, `completed=["job_000005"]`, `duplicate=false` |
| no double payment | **PASS** | `stage=verify_no_double_payment checks=20 failures=0` |
| production captures 1440p / 2160p | **PASS (engine + pixel size)** | `exit=0 3 images` at both; `validate_png.py --expect` per file |
| VISUAL_UX of those captures at 1× | **NOT_TESTED** | the artifact host (`productionresultssa*.blob`) is unreachable from this environment; the frames are in the run's artifact for a reviewer with access |
| parse gate | **PASS** | `PARSE_GATE scripts=8 failures=0` (loads in project context; `--check-only` has no autoloads) |

Not claimed: no POI reward, no A8 payout, no A3 source authorization, no human play,
no balance judgement.

## 4. Remaining, not A0's to close

* **A1** — `A0_STREAM_PROBE stage=mount mounted=false` and
  `A1_AUTHORED_READER_ABSENT … [SKIPPED]`: A1's authored reader is not mounted in this
  composition, and step 7 still carries `FAIL the refusal names A1's own artifact
  hash/path rather than an A0 failure`. Owner-tagged, does not block A0.
* **A3** — no source is authorized yet (`A3_SOURCE_AUTHORIZATION_ABSENT`), so the
  reward path stays refused by design.
* **A6** — the read-only panel this gate drives is A6's; the presentation file was not
  touched.

## 5. Next primary capability

**A0: the authored-continent route gate at native 720p/1440p/2160p with both POIs
reached on foot through the physical doorway** (unchanged from R13), now on top of a
green Factory 2PID baseline. External dependencies: A1's byte lock must match the
payloads it ships, and A3 must authorize one source before any reward may be claimed.

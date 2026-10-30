# A6 — survival return UI: owner contract, corrections and mount notes

Status: **NATIVE_HEADLESS corrected and re-verified** on the real Godot 4.7 build
with the production autoloads (`A6 RETURN UI NATIVE PASSED (165 checks)`, ~2.5 s,
run twice against a reused save). **Not** visually inspected: this sandbox has a
headless-only engine, so no PNG has been rendered here. Layout at 720p/1440p/2160p
is measured; the capture gate now demands four real frames per resolution and
fails when any is missing or blank.

Revision: this document supersedes the 2f9e6234 version. It answers the eight
defects in
`docs/survival/reviews/CT_A6_RETURN_UI_2F9E6234_OWNER_NATIVE_SOURCE_QA_20261030.md`.

Scope: A6 owns `game/survival/ui/return/**`,
`tests/survival/ui/a6_survival_return_native_test.*`,
`tests/survival/ui/a6_return_ui_capture.*`,
`tools/run_a6_return_ui_gate.sh` and `tools/verify_a6_return_ui_captures.py`.
Nothing here writes to `SaveService`, `AppFlow`, the title screen, the gameplay
actor, the chest transfer path or A3's economy. There is no second save service,
no storage controller, no identity code and no quest receipt of A6's own.

---

## 1. What the player gets

| Card | Scene | When it appears |
| --- | --- | --- |
| Season chip | `a6_run_card.tscn` | Only when a **season clock projection** exists. Top-left, under the vitals. Focusable button; opens the record. |
| Starter guidance | `a6_guidance_panel.tscn` | First run: the five-step chain. Later runs: one line, the next unfinished step. Disappears when nothing is left. Dismissible for the session. |
| Return digest | `a6_return_digest.tscn` | Only when an **owner-settled return digest** exists. Top-right, non-blocking, one primary button. Shown once per digest id per session, or per owner acknowledgement. |
| Season record | `a6_season_record_panel.tscn` | On demand (season chip, or `open_record()`). Finished seasons + account achievements; opens even when A0 publishes nothing and says so. |
| Site cues | `a6_site_cue_chip.tscn` | Only when a **D061 perceptual cue** is still inside its owner freshness window. No "safe" state exists. |

No season score, no daily reward, no "your base survived" verdict, and no
placeholder row when the owners have no data: the cards hide themselves.

## 2. Mounting (A0 side)

```gdscript
const RETURN_UI := preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")

var ui := RETURN_UI.instantiate()
add_child(ui)                      # CanvasLayer; never pauses the tree
ui.configure(get_tree())           # optional: the layer configures itself in _ready()
ui.refresh()                       # after boot, save load, offline settlement, season rollover
ui.digest_dismissed.connect(my_persist_acknowledgement)   # optional, see §3.3
```

| Member | Purpose |
| --- | --- |
| `configure(tree, overrides := {}, now_provider := Callable())` | Bind the owner tree. `overrides` / `now_provider` are test seams. |
| `refresh()` | Re-read every projection and re-render. Call it after any settlement. |
| `open_record()` / `close_record()` | Open the season record; the chip calls this itself. |
| `dismiss_digest()` / `dismiss_guidance()` | Same as the player pressing the card's own control. |
| `now_seconds()` | The clock the layer is using. |
| signals `digest_dismissed(digest_id)`, `record_opened` | For A0 persistence and analytics. |

The layer places its own cards at 720p/1440p/2160p and on resize. It does not
touch the existing HUD, does not grab focus during play and never pauses the tree.
It adds corner cards only — no scrim, tint or post-process, so night/fog/Gold
readability is unchanged.

## 3. Projection contracts

A6 resolves optional owner methods **by name** on the real autoloads; the first
that exists is used. Every projection is re-validated, and a malformed value is
rejected wholesale, so a card can never half-render.

| Contract | Accepted methods (first match wins) | Owner |
| --- | --- | --- |
| `soh.a6.season_clock.v1` | `SaveService.get_season_projection()`, `get_run_season_projection()`, `get_run_projection()` | A0 |
| `soh.a6.run_facts.v1` | `SaveService.get_run_guidance_facts()`, `get_run_facts_projection()`, `get_guidance_projection()` | A0 (fed by A1/D057 events) |
| `soh.a6.return_digest.v1` | `SaveService.get_offline_return_digest()`, `get_return_digest()` | A0 (fed by A1/A3 settlement) |
| `soh.a6.digest_ack.v1` | `SaveService.get_return_digest_acknowledgements()`, `get_return_digest_ack_projection()` | A0 |
| `soh.a6.run_history.v1` | `SaveService.get_profile_history_projection()`, `get_run_history_projection()` | A0 |
| `soh.a6.site_cues.v2` | `SurvivalService.get_site_cue_projection()`, `get_signs_projection()` | world/ecology owner (D061) |

### 3.1 `soh.a6.season_clock.v1`

```jsonc
{
  "contract": "soh.a6.season_clock.v1",
  "run_id": "run-0007",              // opaque, <=96 chars, never shown
  "run_number": 3,                   // >=1, shown as "MÙA 03"
  "started_at_unix": 1793318400,
  "ends_at_unix": 1794528000,        // MUST be started + 1209600 (14 x 24 h)
  "ended": false,
  "ended_reason": ""                 // "" | "deadline" | "abandoned"
}
```

Rejections: missing contract, invalid timestamps, a span that is not exactly 336 h,
bad run id. The span check is about the *window*, not about how much is left:
showing "13 ngày" near the end is still correct. A rejected clock means no
countdown at all.

Display floors to whole units, **except the last minute**: under 60 s the chip
prints real seconds (`59 giây`, `1 giây`, `0 giây`) and switches to `Đã khép` at
the deadline, so remaining time is never overstated when it matters.

### 3.2 `soh.a6.run_facts.v1` — the D057 fix

```jsonc
{
  "contract": "soh.a6.run_facts.v1",
  "run_id": "run-0007",              // optional, opaque
  "run_number": 3,                   // optional; absent = unknown
  "performed": {                     // DURABLE per run: true stays true
    "gather_materials": true,        // ever gathered six materials this run
    "valid_shelter": true,           // ever produced a physically valid room
    "place_bed": true,
    "place_storage": false,          // explicit false = known still open
    "learn_recipe": true
  },
  "holds": { "materials": 4 },       // optional CURRENT snapshot, display only
  "shelter": { "validated": true }   // physical topology judgement (A1/A0)
}
```

Three states are preserved on purpose:

| Owner value | A6 shows |
| --- | --- |
| action `true` | ticked (`✓`), permanently, even after the materials are spent or the chest is emptied |
| action `false` | open (`•`) |
| action absent | **unknown** (`?`) — not "not done" |
| `shelter.validated` absent | unknown; a lone wall/floor/foundation is never a home |
| `shelter.validated: false` | open; the owner judged the current base not to be a valid room |

Why this exists: carried inventory is current state, not history. The previous
version treated `inventory_total >= 6` as "gathered", so building a wall and
stashing the rest un-ticked a completed quest; and it treated `structure_count >= 1`
as a sheltered home, so one wall was presented as D059 protection. Both are fixed
here, and A6 does not compensate by inventing a receipt: the durable record is
A0's to publish.

Guidance also shows *current* facts as current, in separate wording:
"Đang mang 4 nguyên liệu", "Đang có 2 khối đã dựng", "Đang có giường". These never
tick a step; they answer "what do I have right now".

Progress reads `—/5` (with a muted "Chưa ghi nhận: N bước") whenever any step is
unknown, because `0/5` would be a claim. Learned recipes are the exception: they
live in the run's own durable knowledge block, so a non-empty recipe set does
complete the research step without an owner ledger.

Run mode (first run teaches / later runs compact) is derived **only** from an owner
run number — the season clock first, then `run_facts.run_number`. With neither, the
guide stays in first-run mode forever; one completed action never promotes a
novice.

**D056 binding.** A ledger is only evidence for the run it belongs to. Before a
single step is read, `bind_run_facts(facts, clock)` correlates the two owner
projections and returns a reason when they disagree:

| Situation | `reason` | Result |
| --- | --- | --- |
| `facts.run_id` ≠ `clock.run_id` | `run_facts_run_id_mismatch` | every step UNKNOWN |
| `facts.run_number` ≠ `clock.run_number` | `run_facts_run_number_mismatch` | every step UNKNOWN |
| both identities inside one ledger disagree | `run_facts_conflict` | every step UNKNOWN |
| facts carry no `run_id`/`run_number` while a clock exists | `run_facts_unverified` | every step UNKNOWN |
| no clock at all, facts carry their own id | bound | normal tri-state |
| no clock and no identity in the ledger | `run_facts_unverified` | UNKNOWN, never DONE or FALSE |

A refused ledger is replaced with an *unavailable* one, so the new season can never
inherit last season's checkmarks, and it is never reported as "not done" either.
The model reports `facts_bound` and `facts_reason` in its output so A0 can log the
refusal instead of silently showing a blank guide. There is no hard quest gate, no A6 reward and no ordering requirement.

### 3.3 `soh.a6.digest_ack.v1` — once across processes

```jsonc
{
  "contract": "soh.a6.digest_ack.v1",
  "acknowledged": [
    { "run_id": "run-0007", "digest_id": "settle-20261030T0410" },  // preferred
    "a-globally-unique-digest-id"                                   // accepted form
  ]
}
```

Two accepted shapes, because a digest id alone is only unambiguous if A0 promises
it is globally unique:

* an **entry** `{run_id, digest_id}` — the identity is `run_id + digest_id`;
* a bare **string** — accepted only as a globally unique id (e.g. a timestamp), and
  it silences that digest in whichever run presents it.

An entry from a previous run does **not** acknowledge a digest with the same id in
the current run: a reused id is a different identity, not a duplicate. Entries with
a missing field, or a bare string that later collides, are simply not matched.

A6 only reads this list. The player's "Continue" is reported through the layer's
`digest_dismissed(run_id, digest_id)` signal; A0 may persist it under its own
transaction and publish the projection on the next launch. Without the projection, the digest
is remembered for the session only — that limitation is explicit rather than
papered over with a second save file.

### 3.4 `soh.a6.return_digest.v1`

```jsonc
{
  "contract": "soh.a6.return_digest.v1",
  "digest_id": "settle-20261030T0410",
  "run_id": "run-0007",                // REQUIRED: the season it settled in
  "away_seconds": 64800,
  "production": [
    { "kind": "forge", "completed_units": 8, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty" }
  ],
  "provisions": {
    "consumed": 4,
    "shelter": "home",              // home | wilderness | unknown
    "shelter_validated": true,      // REQUIRED for the 1 HP floor claim
    "hp_floor": true
  },
  "world_changes": ["Cây cầu đã sập"]
}
```

A digest without `run_id` is refused (`return_digest_run_unbound`) and renders
nothing: an unattributable settlement card could otherwise be replayed into a new
season, or suppressed because a previous season used the same id. When the clock
names a different run (`digest.run_id` ≠ `clock.run_id`), the card is refused as
well — history, not a return.

`stop_reason` ∈ `fuel_empty`, `input_empty`, `output_full`, `no_water`,
`queue_empty`, `capacity_full`, `season_ended`, `unknown`. Rows with
`completed_units <= 0`, an unknown `kind` or a technical `unit_label` are dropped;
an all-empty digest hides the card. The 1 HP floor is honoured only when the
settlement says `shelter: "home"` **and** `shelter_validated: true` (D059: the home
must be structurally valid, not a test boolean). Wilderness never gets it.

### 3.5 `soh.a6.run_history.v1`

```jsonc
{
  "contract": "soh.a6.run_history.v1",
  "runs": [
    { "started_at_unix": 1782000000, "ended_at_unix": 1793318400,
      "end_reason": "deadline", "milestones": ["Giường đầu tiên"] }
  ],
  "achievements": [
    { "title": "Qua mùa đầu", "detail": "Sống trọn 14 ngày", "earned_at_unix": 1793318400 }
  ]
}
```

Every valid record is collected and **sorted by completion date before** the newest
20 are kept, so a newer run that arrives late in an unsorted owner list is not
lost. Achievements are capped at 24 and carry no power; the schema has no field for
a bonus.

When A0 publishes neither a clock nor a history, the record panel shows a visible
`Chưa có dữ liệu mùa` notice and `Chưa có dữ liệu thành tựu` in the lists. It never
falls back to the scene defaults "Chưa có mùa nào khép lại", because that would
claim the account has never finished a season.

### 3.6 `soh.a6.site_cues.v2` — D061 without a radar

```jsonc
{
  "contract": "soh.a6.site_cues.v2",
  "observed_at_unix": 1793318400,
  "cues": [
    { "channel": "trace", "age_seconds": 5400, "ttl_seconds": 10800 },
    { "channel": "sound", "direction": "left", "age_seconds": 120, "ttl_seconds": 900,
      "label": "Tiếng bước chân" }
  ]
}
```

`channel` ∈ `trace` (a physical mark), `sound` (something audible from where the
player stood), `sight` (something visible on screen). `direction` is optional and
player-relative. There are **no coordinates, no metres and no 400 m radius**: the
v1 contract with `distance_m` is rejected. A precise distance may only be printed
if a future owner contract justifies a real sensor, which this one deliberately
does not claim.

Each cue ages forward from `observed_at_unix` (`age + now - observed`), is dropped
once it passes `ttl_seconds`, and the chip disappears when nothing fresh remains.
An observation dated in the future, or a missing/zero `observed_at_unix`, is
impossible chronology: the age resolves to `-1` and the cue is dropped rather than
clamped to "just now", so a bad clock cannot manufacture a fresh sign. A local
clock that is *behind* the observation behaves the same way.
Expired evidence therefore cannot keep looking current. An empty projection renders
nothing — silence, never "your base is safe".

## 4. Behaviour encoded from the decisions

| Decision | Behaviour |
| --- | --- |
| D052 no clutter | Every visible Label/Button text and tooltip is screened against `res://`, `user://`, `soh.`, `schema`, `contract`, `_v1`, `_v2`, `BLOCKED`, `NATIVE`, `FIXTURE`, `TEST ONLY`, `TODO`, `null`. Corner cards only; diagnostics never reach release UI. |
| D055 14 real days | exact 1,209,600 s window; countdown floors, seconds under a minute; `Đã khép` at expiry. |
| D056 reset + history | only completed runs and achievements are read; record says achievements carry no strength into the next season. A run change *inside one Godot process* is a real boundary: the dismissed guide, the seen-digest set and the active digest are dropped, while owner-published history and achievements stay readable. |
| D057 guidance | durable owner facts, tri-state unknown/false/done; out-of-order and pre-completion count; first run/later run from owner run identity; no A6 rewards or gates. |
| D059 sheltered starvation | 1 HP floor only with `shelter: "home"` **and** `shelter_validated: true`. |
| D061 traces | perceived cues only, aged and expired; no omniscient safety. |
| D051 / Gold / CraftPix | untouched; no art changed in this work. |

## 5. What A6 shows today

* **Season chip: absent** (no owner clock).
* **Return digest: absent** (no offline settlement exists).
* **Guidance: live but honestly incomplete** — it reads real `SurvivalService`
  state, so a fresh profile shows the five-step chain with `—/5` and "Chưa ghi
  nhận", not false ticks. Once A0 publishes `run_facts`, completed steps tick and
  stay ticked.
* **Site cues: absent** (no D061 projection).
* **Record: opens and says it has no data.**

## 6. Visual evidence gate (Phase 3)

Rendering is owned by `.github/workflows/a6-return-ui-render.yml`, a separate A6
job that needs **public repository content only**. It is deliberately not part of
the avatar workflow: those captures sit behind the licensed CraftPix staging step
in a private Drive folder, so a failed download would also mean the return UI was
never drawn anywhere.

`tests/survival/ui/a6_return_ui_capture.tscn` renders four states — `digest`,
`guidance`, `history`, `empty` — at 1280x720, 2560x1440 and 3840x2160 under
`xvfb-run` with `LIBGL_ALWAYS_SOFTWARE=1` and llvmpipe. Two details are load-bearing
and were both found the hard way:

* the capture scene is passed **positionally** (`godot --path .
  res://tests/survival/ui/a6_return_ui_capture.tscn -- …`). Launching the project's
  main scene and waiting for it to hand over is what wedged the windowed engine for
  four hosted runs — the last log line was the startup banner, before `_ready`, which
  is also why the in-engine watchdog never spoke;
* a plain `--quit-after` boot runs first, and the window size is asserted from
  inside the scene (`--capture-size=WxH`) so the request and the framebuffer are
  compared in one place. 720p passes no `--resolution` at all, because the project
  already overrides the window to exactly that size.

It:

* refuses to run on a headless binary (`RENDERER REQUIRED`, exit 2);
* writes a per-resolution manifest with the renderer, the window size, each
  frame's real pixel size, the 640x360 layout units it was authored in, a
  non-blank verdict computed from the framebuffer, every visible string with its
  measured rectangle and overflow verdict, and `state_ok` per state;
* **exits 1** when fewer than four frames were saved, when any text overflows its
  box, or when a state does not show the card it is named after — a refused
  projection renders an empty card, and a screenshot of that is a failed capture,
  not a preview;
* names files by the **framebuffer** size, not the stretch-unit viewport, and
  fails if those disagree with the requested window;
* carries a 120 s in-engine watchdog that prints `TIMEOUT` and exits 3, so a wedge
  is a verdict rather than a bare outer-timeout kill;
* can be built with no framebuffer at all (`--a6-ui-fixture-audit`): the same four
  fixtures are checked for card identity and every string's box, so a drifted
  preview fails in two seconds in the local gate instead of after a hosted run.
  Both paths share one `_fixtures()` list;
* tags every file `return_preview_` and declares `"data": "preview_fixture"` and
  `"backdrop": "layer_only"`.

`tools/verify_a6_return_ui_captures.py` then checks all twelve files individually:
exact dimensions, PNG chunk structure with CRC and a full inflate of the pixel
data (a header-only or truncated file is rejected), `saved`, `non_blank`,
`state_ok`, at least three audited text boxes, screen containment, per-string
overflow, and four byte-distinct frames per resolution. It requires a real
display-server name in the manifest, so a `headless` run can never satisfy it. The
workflow fails the job unless the log says
`RETURN UI CAPTURES VERIFIED (12 frames, 3 resolutions)`; the artifact steps carry
`if: always()` so a failure still leaves the frames for inspection.

These frames are `preview_fixture` + `layer_only` evidence. They say nothing about
offline production being real, nothing about the live A0 HUD or Gold contrast, and
nothing about the CraftPix avatars.

## 7. Evidence

```
bash tools/run_a6_return_ui_gate.sh /path/to/godot
→ import exit 0
→ no save/mint/unlock call in game/survival/ui/return/
→ A6 RETURN UI NATIVE PASSED (205 checks)
→ A6 UI FIXTURE: digest ok (29 strings) / guidance (21) / history (30) / empty (4)
→ A6 UI FIXTURE AUDIT OK (4 states, no framebuffer needed)
→ A6 RETURN UI GATE PASSED
```

The harness is itself fail-closed: `A6_RETURN_SCENE=res://…/missing.tscn` makes it
report `FAILED: the return UI gate exited 1`, `FAILED: the gate did not print its
pass line`, `A6 RETURN UI GATE FAILED (2)` and exit 1.

Positive and negative coverage:

* 61 s / 60 s / 59 s / 1 s / 0 / −1 s countdown, last-minute urgency, expiry;
* 13-day span rejected; exact expiry transition;
* 2 h / 18 h / 48 h returns; zero output, unknown station, 0-unit rows dropped;
* `hp_floor` refused without `shelter_validated` and outside a home;
* 23 shuffled runs → newest 20, ordered, newest survives the cap;
* acknowledgement hides a digest in a fresh layer; absent acknowledgement shows it
  again;
* cue freshness: a sound expires while a younger trace remains, then both vanish;
  v1 distance contract rejected; no metres in any string;
* gather → spend → stash with the real `SurvivalService`: two walls and a chest
  placed through A0, materials decreasing, and no false tick;
* an owner `holds` snapshot fills the "đang mang" line when A6 cannot read the bag,
  without completing the step;
* lone wall never completes the shelter step, in the model and against the real
  base;
* bed-before-guide ticks out of order; first-run mode survives one completed action
  with no clock;
* empty record says "Chưa có dữ liệu mùa"; hidden clock is not a missing-data
  notice;
* 720p/1440p/2160p geometry, text hygiene, and A0's save document and save file
  unchanged byte-for-byte.
* **D056 run isolation** — a season-01 ledger under a season-02 clock is refused by
  id mismatch and by number mismatch, stays UNKNOWN for both gathering and shelter,
  and still reports `mode: returning`; a ledger with no identity at all is
  `run_facts_unverified`; a matching ledger ticks only its own season; without a
  clock the ledger's own id is authoritative;
* **in-process run change** — one layer instance goes from season 01 to season 02:
  the guide reopens after last season's dismissal, checkmarks reset to `—/5`,
  progress never inherits, a dismissed digest does not silence the new season, a
  *reused* digest id in the new season reappears, the old season's digest is
  refused under the new clock, and an old-season acknowledgement does not hide the
  new season's digest while the current-season one does (cross-process reload).
  Historic runs and achievements stay readable throughout;
* **digest binding** — a digest without `run_id` is rejected with
  `return_digest_run_unbound`; the acknowledgement identity is `run + digest`, so
  the same id in another run is neither suppressed nor matched, and a bare string
  still works as a globally unique id;
* **impossible chronology** — a cue observed in the future, or a clock behind the
  observation, resolves to age `-1` and is dropped instead of clamped to fresh;
* `away(20)` reads "20 giây", not "1 phút".

The isolation tests are mutation-checked: removing the run-change reset fails
`a new season reopens the guide…`; trusting an unbound ledger fails four
assertions including `a stale ledger never ticks gathering`; dropping the digest
run gate fails `a digest without a run binding is rejected`.

The avatar gates are re-run separately (see the hand-off report); they are a
regression check, not part of this gate.

## 8. Remaining A0/A3 dependencies

1. D055 run window (`get_season_projection`).
2. D057 durable action/shelter ledger (`get_run_guidance_facts`) — without it the
   guide is honest but static.
3. Offline settlement digest, including `shelter_validated` from A1 topology.
4. Account history/achievements and a run identity for the second-run mode.
5. Digest acknowledgement persistence (A0 connects `digest_dismissed(run_id, digest_id)`).
6. D061 perceptual cue projection from the world/ecology owner.
7. Production mount, and the human visual pass over real frames with the A0 HUD.

`tools/verify_a6_return_ui_captures.py` is itself tested with a synthetic tree
(logic only — never quoted as render evidence): a complete set passes 12/12, and
nine wrong ones are rejected — `headless` in the manifest, an engine
`state_errors` entry, a frame the engine did not confirm, four identical frames
(stuck framebuffer), an overflowing string, a missing state, a header-only PNG,
and corrupted pixel data (bad IDAT CRC).

### 7.1 The twelve real frames — run `41098936639`

| | |
| --- | --- |
| workflow | `A6 return UI renderer captures` (`.github/workflows/a6-return-ui-render.yml`) |
| run | `41098936639`, head `ced422c5`, event `push` |
| job | `Render and verify twelve frames (Xvfb, llvmpipe)` — **success** |
| frames | `return_preview_{digest,guidance,history,empty}_{1280x720,2560x1440,3840x2160}.png` — 12/12 |
| artifacts | `a6-return-ui-frames-41098936639` (563 749 B), `a6-return-ui-render-logs-41098936639` (20 684 B) |
| link | <https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41098936639> |

What the job itself asserted, step by step: a headless binary refuses to pose as a
renderer (`RENDERER REQUIRED`, exit 2); the four fixtures keep their cards and text
boxes with no framebuffer; a cold windowed boot completes; all three resolutions
render; the verifier accepts every file individually — exact pixel size, valid PNG
chunk structure with a full inflate, non-blank, `state_ok`, at least three audited
text boxes, every string inside the viewport, no string overflowing its own box,
and four byte-distinct frames per resolution; a separate step re-counts four PNGs
per folder and twelve in total at the three exact sizes; and the final gate refuses
the job unless the log says `RETURN UI CAPTURES VERIFIED (12 frames, 3
resolutions)`.

Why the earlier attempts died at exit 124: the job launched the project's **main
scene** and waited for it to hand the frame over. Under Xvfb the windowed engine
stopped before `_ready` — the last log line was the startup banner — so neither the
capture code nor its 120 s watchdog ever ran. Passing the capture scene
positionally, the way the diagnosis probe did when it produced four frames, fixed
it. Two lesser bugs were fixed on the way: GitHub runs `run:` blocks with `bash -e`,
so a `timeout` exit killed the step before it could print the log tail (three runs
reported nothing but a bare 124), and `upload-artifact@v4` silently skips
dot-directories, so `.artifacts/…` uploaded nothing until `include-hidden-files` was
set.

### 7.2 What this evidence is, and is not

Five separate lines, deliberately not merged:

1. **Source correctness — PASS.** 205 native checks locally, including the D056
   isolation matrix (mismatched run id, mismatched run number, unverified ledger,
   in-process season 01 → 02, cross-process reload, reused digest id, old
   acknowledgement, impossible cue chronology). Three mutations of that logic each
   fail the suite.
2. **Real rendered frames — PASS for the render job.** Twelve PNGs from the actual
   Godot renderer at three resolutions, verified file by file. These are
   `preview_fixture` + `layer_only`: the projections are synthetic and the layer is
   drawn without the A0 HUD.
3. **CraftPix avatar visual acceptance — HOLD.** `A6 native avatar validation`
   remains red on its two private-staging jobs (licensed art is staged from a
   private folder on the runner; the public-clone and return-UI jobs pass). Nothing
   in this work weakens that gate, and no avatar visual claim is made.
4. **A0 production mounting — NOT TESTED.** No real `SaveService`, `AppFlow`,
   Title/actor/chest or Gold/HUD composition is exercised here.
5. **D055–D061 owner projections — DEPENDENT.** See §8.

**Pixel-level review, stated honestly:** the twelve PNGs are attached to the run
above, but artifact downloads are blocked from the environment this change was
authored in (the blob host is unreachable there), so the frames could not be opened
and eyeballed *there*. Wrapping, clipping, focus, hierarchy and pixel clarity were
therefore checked mechanically (per-string rectangles, overflow verdicts, screen
containment, byte-distinct states) rather than by eye. The human visual pass on the
attached files is still open and is listed as such rather than claimed.

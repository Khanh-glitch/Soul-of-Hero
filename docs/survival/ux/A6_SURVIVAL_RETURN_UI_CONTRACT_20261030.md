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
novice. There is no hard quest gate, no A6 reward and no ordering requirement.

### 3.3 `soh.a6.digest_ack.v1` — once across processes

```jsonc
{ "contract": "soh.a6.digest_ack.v1", "acknowledged": ["settle-20261030T0410"] }
```

A6 only reads this list. The player's "Continue" is reported through the layer's
`digest_dismissed(digest_id)` signal; A0 may persist it under its own transaction
and publish the projection on the next launch. Without the projection, the digest
is remembered for the session only — that limitation is explicit rather than
papered over with a second save file.

### 3.4 `soh.a6.return_digest.v1`

```jsonc
{
  "contract": "soh.a6.return_digest.v1",
  "digest_id": "settle-20261030T0410",
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
Expired evidence therefore cannot keep looking current. An empty projection renders
nothing — silence, never "your base is safe".

## 4. Behaviour encoded from the decisions

| Decision | Behaviour |
| --- | --- |
| D052 no clutter | Every visible Label/Button text and tooltip is screened against `res://`, `user://`, `soh.`, `schema`, `contract`, `_v1`, `_v2`, `BLOCKED`, `NATIVE`, `FIXTURE`, `TEST ONLY`, `TODO`, `null`. Corner cards only; diagnostics never reach release UI. |
| D055 14 real days | exact 1,209,600 s window; countdown floors, seconds under a minute; `Đã khép` at expiry. |
| D056 reset + history | only completed runs and achievements are read; record says achievements carry no strength into the next season. |
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

`tests/survival/ui/a6_return_ui_capture.tscn` renders four states — `digest`,
`guidance`, `history`, `empty` — at 1280x720, 2560x1440 and 3840x2160 under
`xvfb-run` with software GL. It:

* refuses to run on a headless binary (`RENDERER REQUIRED`, exit 2);
* writes a per-resolution manifest with each frame's dimensions, a non-blank
  verdict computed from the framebuffer, and every visible string with its measured
  rectangle and overflow verdict;
* **exits 1** when fewer than four frames were saved or when any text overflows its
  box, so a `save_png` failure can never be reported as a capture;
* tags every file `return_preview_` and declares `"data": "preview_fixture"` in the
  manifest.

`tools/verify_a6_return_ui_captures.py` then checks all twelve files individually
(dimensions, saved flag, non-blank, screen containment, minimum audited text
boxes). A directory full of avatar frames fails: without the return tag and the
manifest the count stays at zero.

**No frame has been rendered or inspected in this sandbox.** Human review of
Vietnamese wrapping, focus, hierarchy, overlap with the real A0 HUD and Gold
contrast remains open, and hostility between this layer and the live HUD can only
be judged once A0 mounts it.

## 7. Evidence

```
bash tools/run_a6_return_ui_gate.sh /path/to/godot
→ import exit 0
→ no save/mint/unlock call in game/survival/ui/return/
→ A6 RETURN UI NATIVE PASSED (165 checks)
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

The avatar gates are re-run separately (see the hand-off report); they are a
regression check, not part of this gate.

## 8. Remaining A0/A3 dependencies

1. D055 run window (`get_season_projection`).
2. D057 durable action/shelter ledger (`get_run_guidance_facts`) — without it the
   guide is honest but static.
3. Offline settlement digest, including `shelter_validated` from A1 topology.
4. Account history/achievements and a run identity for the second-run mode.
5. Digest acknowledgement persistence (A0 connects `digest_dismissed`).
6. D061 perceptual cue projection from the world/ecology owner.
7. Production mount, and the human visual pass over real frames with the A0 HUD.

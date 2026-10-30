# A6 — survival return UI: owner contract and mount notes

Status: **NATIVE_HEADLESS verified** on the real Godot 4.7 build with the production
autoloads (`A6 RETURN UI NATIVE PASSED (88 checks)`, ~2.4 s). **Not** visually
inspected: this sandbox has a headless-only engine with no GL/Vulkan surface, so no
720p/1440p/2160p screenshot exists yet. Layout at those three resolutions is
*measured* (geometry assertions), not seen. The preview harness is written and its
CI step is wired, but no frame has been rendered here.

Scope: A6 owns `game/survival/ui/return/**`,
`tests/survival/ui/a6_survival_return_native_test.*`,
`tests/survival/ui/a6_return_ui_capture.*` and `tools/run_a6_return_ui_gate.sh`.
Nothing in this change writes to `SaveService`, `AppFlow`, the title screen, the
gameplay actor or A0's chest transfer path. There is no second save service, no
storage controller and no identity code here.

---

## 1. What the player gets

| Card | Scene | When it appears |
| --- | --- | --- |
| Season chip | `a6_run_card.tscn` | Only when a **season clock projection** exists. Top-left, under the vitals. Focusable button; opens the record. |
| Starter guidance | `a6_guidance_panel.tscn` | First run: the five-step chain. Later runs: one line, the next unfinished step. Disappears when nothing is left. Dismissible for the session. |
| Return digest | `a6_return_digest.tscn` | Only when an **owner-settled return digest** exists. Top-right, non-blocking, one primary button. Shown once per digest id per session. |
| Season record | `a6_season_record_panel.tscn` | On demand (season chip, or `open_record()`). Finished seasons + account achievements; opens even when A0 publishes nothing. |
| Site cues | `a6_site_cue_chip.tscn` | Only when a **D061 cue projection** reports a real trace or a real nearby threat. No "safe" state exists. |

Nothing else. In particular there is **no** season score, no daily-login reward, no
"your base survived" verdict, and no placeholder row when the owners have no data:
the cards hide themselves.

## 2. Mounting (A0 side)

```gdscript
const RETURN_UI := preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")

var ui := RETURN_UI.instantiate()
add_child(ui)                      # a CanvasLayer; it never pauses the tree
ui.configure(get_tree())           # optional: the layer configures itself in _ready()
ui.refresh()                       # after boot, save load, offline settlement, season rollover
```

Public API (all read-only, all safe on a node whose owners publish nothing):

| Member | Purpose |
| --- | --- |
| `configure(tree, overrides := {}, now_provider := Callable())` | Bind the owner tree. `overrides` / `now_provider` are test seams only. |
| `refresh()` | Re-read every projection and re-render. Call it after any settlement. |
| `open_record()` / `close_record()` | Open the season record; the chip calls this itself. |
| `dismiss_digest()` / `dismiss_guidance()` | Same as the player pressing the card's own control. |
| `now_seconds()` | The clock the layer is using (injected clock in tests, system time in game). |
| signals `digest_dismissed(digest_id)`, `record_opened` | For an A0 pause menu or analytics. |

The layer positions its cards itself at 720p/1440p/2160p and on viewport resize. It
does not touch the existing HUD, does not grab focus while the player is playing,
and does not set `get_tree().paused`.

## 3. Projection contracts

A6 resolves optional owner methods **by name** on the real autoloads, so no import
cycle is needed. It accepts the first method that exists and returns a Dictionary:

| Contract | Accepted methods (first match wins) | Owner |
| --- | --- | --- |
| season clock | `SaveService.get_season_projection()`, `get_run_season_projection()`, `get_run_projection()` | A0 |
| return digest | `SaveService.get_offline_return_digest()`, `get_return_digest()` | A0 (fed by A1/A3 settlement) |
| run history | `SaveService.get_profile_history_projection()`, `get_run_history_projection()` | A0 |
| site cues | `SurvivalService.get_site_cue_projection()`, `get_signs_projection()` | world/ecology owner (D061) |

Every projection is re-validated. A malformed value is rejected wholesale and the
card behaves as if the projection were absent — it never half-renders.

### 3.1 `soh.a6.season_clock.v1`

```jsonc
{
  "contract": "soh.a6.season_clock.v1",
  "run_id": "run-0007",              // opaque, <=96 chars, never shown
  "run_number": 3,                   // >=1, shown as "MÙA 03"
  "started_at_unix": 1793318400,     // real UTC seconds
  "ends_at_unix": 1794528000,        // MUST be started + 1209600 (14 x 24 h)
  "ended": false,
  "ended_reason": ""                 // "" | "deadline" | "abandoned"
}
```

Rejections: missing contract, unparsable or out-of-range timestamps (accepted range
2001–2100), span not exactly 336 h, bad run id. A rejected clock means **no
countdown at all**, because a wrong deadline is worse than none.

### 3.2 `soh.a6.return_digest.v1`

```jsonc
{
  "contract": "soh.a6.return_digest.v1",
  "digest_id": "settle-20261030T0410",     // once shown, not shown again this session
  "away_seconds": 64800,                   // 18 h; drives "Vắng 18 giờ"
  "production": [                          // 0..4 rows; only real settled output
    {
      "kind": "forge",                     // forge | research | crop | food | water
      "completed_units": 8,                // >0, else the row is dropped
      "unit_label": "thỏi sắt",            // player-facing noun, <=40 chars
      "stop_reason": "fuel_empty"          // see the enum below
    }
  ],
  "provisions": {                          // omit or {} when nothing was consumed
    "consumed": 4,                         // ration units actually eaten
    "shelter": "home",                     // home | wilderness | unknown
    "hp_floor": true                       // honoured only when shelter == "home"
  },
  "world_changes": ["Cây cầu đã sập"]      // 0..3 short player-facing lines
}
```

`stop_reason` enum: `fuel_empty`, `input_empty`, `output_full`, `no_water`,
`queue_empty`, `capacity_full`, `season_ended`, `unknown` (the last renders no
note). Rows with `completed_units <= 0`, an unknown `kind`, or a `unit_label`
containing internal markers are dropped. If every section ends up empty the card
does not appear: *"the owner settled nothing" must never look like "you earned
nothing"*.

`hp_floor` is honoured only inside a real home (D059). Outside, the card reports
ration use but never claims the player was saved.

### 3.3 `soh.a6.run_history.v1`

```jsonc
{
  "contract": "soh.a6.run_history.v1",
  "runs": [                                // newest first after validation; max 20
    {
      "started_at_unix": 1782000000,
      "ended_at_unix": 1793318400,
      "end_reason": "deadline",            // deadline | abandoned, else dropped
      "milestones": ["Giường đầu tiên"]    // 0..3 short lines
    }
  ],
  "achievements": [                        // max 24; no gameplay effect (D056)
    { "title": "Qua mùa đầu", "detail": "Sống trọn 14 ngày", "earned_at_unix": 1793318400 }
  ]
}
```

A6 drops any entry that would promise power: the schema has no field for a bonus,
and `title`/`detail` are screened for internal markers. Achievements are history,
never buffs. When A0 publishes no history at all, the record panel says
"Chưa có dữ liệu mùa" instead of pretending the account has never finished a season.

### 3.4 `soh.a6.site_cues.v1` (D061)

```jsonc
{
  "contract": "soh.a6.site_cues.v1",
  "observed_at_unix": 1793318400,
  "trail": { "present": true, "age_seconds": 5400 },   // age AT OBSERVATION
  "threats": [ { "distance_m": 42.0, "label": "Tiếng bước chân" } ]  // <=400 m, max 3
}
```

There is deliberately **no `safe` flag and no percentage**. A6 prints the nearest
threat and the freshest trace; an empty projection prints nothing. A6 will not age
a trace forward past `observed_at_unix`, because that would claim knowledge the
world owner never published.

## 4. Behaviour encoded from the decisions

| Decision | Where | Behaviour |
| --- | --- | --- |
| D055 14 real days, offline included | `A6ProjectionContract.RUN_SECONDS`, `A6RunCard` | exact 1,209,600 s window required; countdown floors to whole units; card switches to "Đã khép" at the deadline. |
| D056 reset, history survives, no power | `sanitize_run_history`, `A6SeasonRecordPanel` | only completed runs + achievements are read; the panel states in plain words that achievements carry no strength into the next season. |
| D057 guidance resets, accepts out-of-order work | `A6GuidanceModel` | five milestones derived from committed A0 state (`materials`, `structures`, `bed`, `storage`, `recipes`), never from a step counter. Built before the guide is read = already ticked. First run teaches; later runs show one optional line. No rewards. |
| D059 sheltered starvation | `_sanitize_provisions`, digest row | `hp_floor` only with `shelter: "home"`, worded "Bạn gục trong nhà / Tỉnh dậy với 1 máu". |
| D061 no omniscient safety | `A6SiteCueChip`, `sanitize_site_cues` | cues only; no "an toàn"/percentage anywhere; empty means silent. |
| D052 no clutter / no raw ids | `TECHNICAL_MARKERS` + the gate's `_scan_forbidden()` | every visible Label/Button text and tooltip is screened for `res://`, `user://`, `soh.`, `schema`, `contract`, `_v1`, `BLOCKED`, `NATIVE`, `FIXTURE`, `TEST ONLY`, `TODO`, `null`. |
| keyboard/controller | `A6RunCard` is a Button; `close_button.grab_focus()` | the season chip has a focus ring and activation; closing the record returns focus to the chip. |

Night/fog/Gold readability and the existing HUD are untouched: this layer adds
corner cards only, never a full-screen tint, scrim or post-process.

## 5. What A6 shows today (honest state)

* **Season chip: absent.** No owner publishes `soh.a6.season_clock.v1` yet, so there
  is no countdown in production. The gate asserts that absence rather than faking a
  clock.
* **Return digest: absent.** A1/A3 have no offline production queue, so no digest is
  published and no card appears. No apples, ingots or research completions are
  invented.
* **Guidance: live.** The panel reads real `SurvivalService` state (structures,
  inventory totals, learned recipes) and renders honestly; on a fresh profile it
  shows 0/5 with the first step open.
* **Site cues: absent.** No D061 projection exists, so no cue is shown.

## 6. What would make Phase 2 rich

Nothing in the UI blocks it. The owner side only has to publish
`soh.a6.return_digest.v1` from the settlement it already performs:

1. A3 settles the offline interval and returns *completed units per station plus the
   stop reason it actually hit*.
2. A0 stores that settling result under its own transaction and exposes it with
   `get_offline_return_digest()`, adding `provisions` from the hunger tick and
   `world_changes` from the world owner.
3. A0 exposes the run window with `get_season_projection()` (D055) and the account
   record with `get_profile_history_projection()` (D056).

Until then the cards stay hidden. That is the agreed failure mode.

## 7. Evidence

```
bash tools/run_a6_return_ui_gate.sh /path/to/godot
→ import exit 0
→ no save/mint/unlock call in game/survival/ui/return/
→ A6 RETURN UI NATIVE PASSED (88 checks)
→ A6 RETURN UI GATE PASSED
```

Covered by the gate: 2 h / 18 h / 48 h returns; 13-day clock rejected; 0-unit and
unknown-station rows dropped; `hp_floor` refused outside home; history ordering and
achievement filtering; empty cues produce no chip; first run vs second run; a bed
built before the guide is ticked; a finished chain hides itself; a dismissed digest
survives repeated refresh and a double "Continue" emits one dismissal; an empty
record panel opens and admits it has no data; 720p/1440p/2160p geometry (inside the
screen, corner cards never overlap, record centred); every visible string passes the
marker ban; and A0's save document and save file are unchanged byte-for-byte after
mounting, opening, dismissing and refreshing every card.

The full avatar gate was re-run on this tree and still passes
(`A6 NATIVE GATES PASSED`: male full 74 / verify 31, female full 74 / verify 31),
so the new scenes do not disturb the existing A6 identity work. A0's pre-existing
profile-choice red is unchanged and attributed to A0.

Not covered: pixels. `tests/survival/ui/a6_return_ui_capture.tscn` renders the
cards under `xvfb-run` in CI and refuses to run on a headless binary (prints
`RENDERER REQUIRED`, exit 2), but **no frame has been inspected here**. Until that
job runs, the honest status is NATIVE_HEADLESS.

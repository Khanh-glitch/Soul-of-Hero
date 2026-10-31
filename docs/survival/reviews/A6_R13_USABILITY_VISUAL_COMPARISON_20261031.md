# A6 R13 — creator visual comparison and handoffs

Round: **R13-A6-USABILITY**. Branch `arena/05e0328d-soul-of-hero`.
Authority read from `origin/feature/survival-rpg-foundation-20261029`: `CURRENT_PRODUCT_CONTRACT.md`,
`DECISIONS.md` (D051–D074, D074 confirms A6 = authoritative read-only UX), `ACCEPTANCE.md`
P1–P8, `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md` R0–R5. Shared ledger: issue #9 comment 6545071995.

**No self-declared product visual acceptance.** Everything below is either a measured
result or a question for the creator.

## 1. What this round fixed, with proof

| defect | how it looked to a player | proof it is fixed |
| --- | --- | --- |
| the workshop named controls by output item | five item ids were produced by 2–3 recipes, so a click could queue a recipe the player did not choose (23/36 ids differ from their product) | `economy_recipe_identity_test.gd` over the real catalog, with the collision case (`smelt_iron`/`smelt_ore` → `iron_ingot`) asserted as two separate controls |
| panel rebuild ran inside the button's own `pressed` signal | a click could land twice, or on a row that no longer existed | `a6_workshop_gui_input_test.gd`: real pointer motion + press + release at 720p/1440p/2160p, 19 checks each — one click queues one job, a rebuild under a stationary pointer queues nothing, a click after a wheel scroll queues the row under the pointer, focus never survives on a freed node |
| refusals printed owner status codes in English | `Cannot queue: missing_inputs` in a Vietnamese game | refusals are Vietnamese sentences ("thiếu nguyên liệu", "hàng đợi đã đầy"); unknown codes fall back to a neutral sentence; the GUI test asserts both that a refusal is never phrased as success and that no token leaks |
| scrollbar was Godot's stock grey grabber on the parchment border | an engine widget dropped into a hand-drawn window | the bar now lives in its own gutter beside the list (`A6UiKit.style_scroll`) |
| workshop chrome was English | `WORKSHOP`, `CLOSE [C]`, `station offline`, `short 8 stone chunk` | `XƯỞNG CHẾ TÁC`, `ĐÓNG [C]`, `trạm ngưng chạy`, `thiếu 8 × stone chunk`; every glyph checked against Handjet-SemiBold's cmap before use |
| footer printed on the parchment's bottom border | the last line sat on the frame | window pinned to a fixed rect inside the 640×360 canvas |

### Verification cost is now honest

Three CI rounds this round were spent on "the engine never loaded the script" rather
than on the product: a dropped `_fail()` helper, a dropped `Rig` class, and untyped
`Dictionary` fields. All three are now caught in about a second by
`tools/review/script_symbols.py` (helper calls + declaration-line types against a
baseline), which fails the lint job before any engine starts. `parse OK` from a
grammar-only parser is not evidence that a script compiles.

## 2. Frames to review (native 1×, three resolutions)

Published by `a6-survival-ui-render.yml` into `docs/survival/reviews/native/`:

| frame | resolution | what it is |
| --- | --- | --- |
| `world_economy_1280x720.png` | 1280×720 | home workshop through the real world, real inventory, real affordability |
| `world_economy_2560x1440.png` | 2560×1440 | same |
| `world_economy_3840x2160.png` | 3840×2160 | same, plus `_half` copy for window-scale reading |
| `world_fresh_world_*.png` | all three | overworld HUD on the live world |
| `world_build_*.png` | all three | construction strip |
| `world_roof_inside/outside/adjacent_*.png` | all three | roof fade and room visibility |
| `survival_ui_avatar_choice/female/title/hud_field/return_digest/return_guidance_*` | all three | A6-owned survival surfaces |

**Evidence class.** `world_*` frames are native production components on the real
scene. `survival_ui_*` frames are the production component driven by a fixture — they
are *not* a claim that a player earned those numbers, and they are labelled that way in
`docs/survival/reviews/`. Neither is a human playtest.

## 3. Visual choices that are yours, not mine

D054 delegates asset selection but keeps the language of the game with you. These are
the open questions the frames raise, each with the two options I can implement quickly
and what each costs:

| # | choice | option A | option B | current |
| --- | --- | --- | --- | --- |
| 1 | recipe card rhythm | one card per row, tall, icon + name + costs (current) | two columns of half-height cards, more on screen | A |
| 2 | scroll affordance | gutter bar (current) | no bar; a "▼ còn nữa" tag on the last visible card | A |
| 3 | cost chips | icon + `have/needed`, amber when short (current) | plain text cost line, chips only for shortfalls | A |
| 4 | refusal feedback | inline notice line under the header (current) | flash the offending cost chip, no notice line | A |
| 5 | job rows | quiet bar + status word + COLLECT/CANCEL (current) | collect-all button once, rows collapsed | A |
| 6 | workshop title | `XƯỞNG CHẾ TÁC` (current) | `CHẾ TÁC` | A |
| 7 | bar/parchment palette | authored kit colours (current) | darker wood frame for modal windows | A |

If nothing is answered, A stays. **None of these change the contract**: the control
names, the cost text shape and the action semantics stay exactly as they are, so a
later choice is a styling pass, not a rewrite.

## 4. Exact handoff — A0

Two items, both measurable, neither edited by me.

### 4.1 Continue → home actor does not walk (blocking P2, and the only red native gate)

```text
21_continue_home_walk: walked neither direction (needs 4.0 px)
  [move_right moved 1.80 px] {bounds=150,44 900x1112 controls=true walkable=on auto=false slides=<sampled while held>}
  [move_left  moved 2.07 px] {…same…}
  permitted=no-gate modals=[] velocity=(0.0, 0.0) route=home
```

The diagnosis now rules out three of the four candidates: bounds are a real
900×1112 rect (not collapsed), `controls_enabled` is true, a walkability test is
installed, and no auto-move is running. What remains is `move_and_slide()` being
stopped immediately, or `_resolve_walkable_position()` returning `previous` for the
candidate, the x-only candidate **and** the y-only candidate.

**What A0 needs to answer:** does `_walkability_test` accept any point within ~4 px of
the restored spawn, and is the restored spawn inside a solid? The file and lines are in
`docs/survival/ux/A6_A0_HOME_LOCOMOTION_HANDOFF_20261031.md`. A6 will re-run the same
capture and report the new numbers unchanged.

Note for A0: the capture now samples `velocity` and slide collisions **while the key is
held**. Earlier readings were taken after release and answered nothing.

### 4.2 Projections A6 still cannot draw

| value | status | A6 today |
| --- | --- | --- |
| `soh.a6.account_wallet.v1` — secured Ragnarok currency | contract + validator landed, no owner projection | nothing drawn |
| in-world time / season (`D060`) | no projection | nothing drawn |
| equipped tool | no projection | nothing drawn |
| durability | **no such concept anywhere in the repo** | nothing drawn |
| Core charges (`D072`) | no projection | nothing drawn |
| death bag (`D073`) | no projection | nothing drawn |

Shapes are in `docs/survival/ux/A6_DATA_AUTHORITY_AND_BLOCKED_OWNER_CONTRACTS_20261031.md`.
A6 will not fabricate any of them, and `a6_data_authority_consumer_test.gd` fails the
build if an A6 file grows its own copy.

## 5. Exact handoff — A7

What A7 should independently check, and what it should refuse:

1. **Refuse** any claim that the workshop controls work because `pressed.emit()` was
   called. Only real pointer events count; `a6_workshop_gui_input_test.gd` is the shape
   to copy, and its deliberate negative is that it skips cards half-hidden by the clip
   edge rather than clicking through them.
2. **Refuse** `parse OK` as compile evidence. Run `tools/review/script_symbols.py`
   first; it catches dropped helpers and dropped inner classes.
3. **Check** that a refusal is never phrased as success and never prints an owner token.
4. **Check** the recipe identity invariant against the live catalog, not a fixture:
   36 recipes, 30 distinct first-output ids, `Recipe_burn_charcoal_*` present,
   `Recipe_charcoal_*` absent.
5. **Do not** accept the home-walk gate as green on an idle frame. The only pass is real
   displacement in both directions.

## 6. Remaining scope, stated plainly

* **Not done:** the wallet row, durability, Core charges, bag recovery and the in-world
  clock — all blocked on owner projections, all drawn as absent rather than faked.
* **Not done:** grade 1/2 armour appearance (D051 source-approval gate; the consumer
  keeps the same character at grade 0 and names the gate).
* **Not mine:** the home locomotion failure above.
* **Inspected this round at 1×:** `world_economy_1280x720.png` from run 41221642100
  (`a5d1d407`), the build that carries the gutter scrollbar: the bar is visible in its own
  gutter, the list keeps its full width, the footer is on parchment rather than on the
  border, and the fourth card is still clipped by the clip edge — which is the plain
  overflow cue, not a layout fault, and is option 2 in the choice table above.
* **Not inspected this round at 1×:** `world_economy_2560x1440.png` and
  `world_economy_3840x2160.png` from the same run. They are rendered and published, so
  they can be read, but no one has looked at them yet and they are not claimed as seen.

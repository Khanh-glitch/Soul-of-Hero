# A6 Round 12 — art-directed survival interface

Branch `arena/05e0328d-soul-of-hero`. Baseline `fbe8b2940adbf0ded5f2e009c09309b51a539eb4`
(Round 11, all four jobs green on run `41162133383`).

Status of this document: **in progress**. Every claim below is marked with what was
actually run. Anything not yet run says `NOT_TESTED`; nothing is reported as passing
because it looked plausible.

---

## 1. What was wrong

The survival interface was built from `StyleBoxFlat` rectangles, `ColorRect` bars and
hard-coded colours: a dark translucent plate with a 1px border, a 6px amber bar, three
8px counters in developer shorthand (`CAMPS 2/7   FINDS 5/12   WAYS 1/3`). The
creator's words for it were "a developer dashboard with sprites on top", and the
screens disagreed with each other because each built its own palette.

The art existed. `assets/a6_ui` now holds 8 nine-sliced panels and 21 icons cut from
two licensed CraftPix packs that ship with the project's asset branches, and the
survival screens are dressed from them.

## 2. Source inventory (verified, reproducible)

| pack | branch | commit | archive bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `255216` UI kit | `Khanh-glitch-patch-6` | `bf11a0cecfda43beca510062bd5d9dc1a8573cc5` | 939 979 | `91f20fe9d45c84006c12f5ef0364fee0addc03406c0a1d49068fd78cb9ccbd16` |
| `994534` icon set | `Khanh-glitch-patch-3` | `a960f0945b36614c9754d8dbf2d3e6ec367d449f` | 1 118 313 | `076cac89a70746d3cd3b59bbb0652b88047bd06bddb952b2a5cf0959cfaed660` |

`tools/fetch_a6_ui_sources.sh` fetches exactly those two archives at those commits,
asserts ZIP magic and the SHA-256 above, and refuses anything else. It has been run
live on this branch: `A6 UI SOURCES VERIFIED (2 packs)`.

Raw artwork is **not** committed. Only the cut panels, the cut icons and a receipt are
(`assets/a6_ui/PROVENANCE.json`, schema `soh.a6.ui_art_receipt.v1`), each entry
carrying the pack, commit, member path, source rectangle, nine-slice margins and the
SHA-256 of the file on disk. `tools/import_a6_ui_art.py --verify` re-hashes all 29
exported files against the receipt; it currently prints
`A6 UI ART RECEIPT VERIFIED (29 assets, 0 problems)`.

### 2.1 What was measured, not guessed

Frames were located by connected-component analysis of each sheet, not by eye:

* `Inventory.png` holds three identical 98×101 window frames at x = 7, 119, 231. The
  first crop of this round was 103×158, which dragged the *next* panel's slot grid and
  its baked "INVENTORY" title into the art; the nine-slice stress sheet showed the
  ghost immediately and the crop was re-measured rather than patched.
* The teal title band is rows 0–13, so the top slice margin is 15: the band stays in
  the unstretched strip and is only repeated horizontally, where it is one flat
  colour. No authored pixel is ever stretched.
* `Buttons.png` has 8 small state squares (22×22/23 at x = 13, 61, 109, 157; y = 12/13
  and 60/61). Its wide pills carry baked words — "DECLINE", "RESUME", "EQUIPMENT" —
  and are therefore unusable as generic art. Only the squares are used.
* `Action_panel.png` y = 13 is a plain five-colour plank with a lit top edge: used as
  the bar. The 168×20 island below it is a strip of nine slots, so it is **not** used
  as a bar.
* The empty slot is the 16×16 wood-framed socket at (96, 80) in `Action_panel.png`. The
  16×16 tan squares in the inventory grid are flat fill with no frame and read as
  blobs when scaled.
* `Equipment.png` / `Craft.png` frames are complete mock screens with baked words and
  a baked character silhouette, so they were **rejected** as generic windows.

### 2.2 Icon bindings, re-verified twice

Bindings are stored by *member name* (`Icon19_1`), never by index, so an upstream
re-sort cannot silently shift them. Every binding was rendered at 8× and looked at
(`docs/survival/reviews/a6_bound_icons_recheck.png`).

That check found two wrong bindings from the earlier numbered-sheet pass:

* `Icon42_1` is a **lit lantern**, not a roof. The pack has no building art at all, so
  the `shelter` binding is deleted and the lantern becomes `camp_light`, used only for
  the camps counter it actually depicts. The title screen and the identity step no
  longer put a lantern beside "build a shelter".
* `Icon47_1` is a **metal ring**, not a cauldron. `furnace_kit` now uses `Icon102_1`
  (a cauldron on hot coals).

Deliberately unbound, because the packs have nothing honest for them: bone, the
ore-vs-scrap distinction, warning signs, and any building. Rows for those items show
their name and no icon.

## 3. The design decision

Two candidates were defined against the same content:

* **A — Crafted Survival Fantasy**: 255216 parchment/teal windows, wood planks,
  GrenzeGotisch display + Handjet body, torn pixel corners. Warms against the forest
  and dungeon palettes, keeps the existing TravelBook nine-patch language.
* **B — Expressive Cartoon Adventure**: 994534's saturated icon language with rounded
  2px flat surfaces, no parchment, VT323 throughout.

**A was chosen.** B cannot supply surfaces at all — 994534 is an icon set with no
frames — so a "B" interface would have been a flat-panel interface with cartoon
icons, which is the exact failure being replaced. A also survives the constraint that
matters most for readability: dark ink on parchment reaches high contrast on forest,
stone, night and Gold frames, where cream-on-dark needs a per-frame outline to stay
legible. What is retained from B is its icon vividness: item icons are used at native
16/32px, unfiltered.

No StyleBoxFlat remains in any survival surface except the tooltip background; every
panel, button, slot and bar is a `StyleBoxTexture` or a `NinePatchRect` over authored
art.

## 4. What changed, per screen

| screen | file | change |
| --- | --- | --- |
| title | `game/ui/screens/title/title_screen.tscn` | Survival promise replaces the hero-switching tagline; title sits on the authored parchment ribbon; Knight silhouette removed; Continue/New Game contract, node paths, TravelBook CTA icons and A0 reset semantics untouched. |
| identity step | `game/ui/screens/avatar_choice/*` | Real animated sheets (idle/walk at the manifest's own fps) via `A6AvatarPreview`; CraftPix ids (`555940`, `419402`) and "(art chưa cài)" removed from player copy; SaveService write path unchanged. |
| overworld HUD | `game/overworld/overworld_hud.gd` | Parchment field card, plank prompt, authored death card with keyboard focus; camps/finds/ways as icon chips; pack capacity from `SaveService.get_inventory_capacity_snapshot()`; small corner footprint. |
| build strip | `game/survival/survival_build_system.gd` | Authored plank + cream ink; node names, three wrapped slot rows and the `[9]` contract preserved. |
| workshop | `game/survival/economy/economy_panel.gd` | Station headers, icon rows for recipes/research, exact costs, concrete shortfall ("short 2 Iron Scrap"), job progress bars with COLLECT/CANCEL; `Recipe_*`/`Technology_*` names and cost strings preserved. |
| chest | `game/survival/chest_inventory_panel.gd` | Bag/chest lists with icons, catalog names, quantities, pack capacity, empty states, and honest "no art" for ids without a picture. |
| refusal copy | `game/overworld/chapter1_overworld.gd` | A refused placement names the missing material from `SurvivalService.missing_for()` instead of "Not enough materials." |

### 2.3 Final icon table (21 bindings)

| concept / item id | member | reads as |
| --- | --- | --- |
| `oak_wood` | `Icon75_1` | bundle of split logs |
| `stone_chunk` | `Icon19_1` | faceted grey rock |
| `iron_scrap` | `Icon20_1` | lump of grey metal-bearing rock |
| `iron_ingot` | `Icon21_1_2` (32px) | cast silver ingot |
| `reed_fibre` | `Icon99_1` | green leaf cluster |
| `fire_wood` | `Icon27_1` | glowing golden fuel bundle |
| `crystal_shard` | `Icon29_1` | blue crystal cluster |
| `frost_shard` | `Icon16_1` | cold blue gem cluster |
| `moonleaf_seed` | `Icon73_1` | sapling |
| `furnace_kit` | `Icon102_1` | cauldron on coals |
| `workbench_kit` | `Icon54_1` | hammer |
| `research_kit` | `Icon25_1` | spark of insight |
| `garden_kit` | `Icon74_1` | potted plant |
| `station_kit` | `Icon53_1` | pickaxe |
| `knife` | `Icon57_1` | short blue blade |
| `field_meal` | `Icon92_1` | bowl of stew |
| `health` | `Icon1_1` | red cross |
| `camp_light` | `Icon42_1` | lit lantern |
| `time_dawn` | `Icon49_1` | hourglass |
| `capacity` | `Icon48_1` | pouch |
| `travel` | `Icon44_1` | compass |

## 4.4 Round 12 continuation — the four defects CT reproduced

CT inspected the native frames independently and found failures this document had
already marked as passing plumbing. All four were real; three were bugs in this
work, one was the linter being blind.

**1. `avatar_choice_screen.gd` declared `_manifest_has_staged_art()` twice.** A
duplicate function is a hard GDScript parse error, so the script never attached and
the New Game identity step never opened: the whole path into Home was dead. Fixed in
`a0b17fd8`; the file is written whole rather than patched, and the count is asserted.
The deeper problem is that `parse()` accepted it — gdtoolkit's grammar is happy with
duplicate declarations, so "parses clean" had been treated as "is a valid script".
`tools/review/scene_lint.py` now has a semantic pass for duplicate func/const/var
across `game/` and `tests/`, with a fixture that proves it fails.

**2. The identity screen clipped at 720p.** The previous scene spent more than 400 of
the 324 usable layout units, so the headline left the top of the window and the
NAM/NỮ captions fell below the bottom edge, around oversized and mostly empty
parchment cards. Rebuilt against the budget (12 + 11 + 30 + 186 + 12 + 24 + 6×4 ≈
299 of 324): every band has an explicit size, the previews keep their source art and
aspect, and the captions live inside the cards. Inspected at 720p and 2160p — nothing
is clipped at either, and the honest "no art in this build" line replaces the blank
card instead of pretending.

**3. The frame labelled `title` was the legacy SOUL FORGE loading screen.** The
current published frames show the real title: wordmark, season line, and the profile
panel with Tiếp tục / Chơi mới. The legacy boot screen is no longer what a capture of
the title lands on.

**4. The return cards were stacked on each other.** In the published
`return_digest` frame the guidance panel covered the run card: five guidance steps
measure ~320 of the 360 authored units, so the card was pushed to the top edge and
drawn over its neighbour. `layout_rects()` clamped cards onto the screen but never
separated them, and its test fed sizes that always fit, so it agreed with itself.
The first repair shrank the lower card — which the capture harness then rejected
with `text overflow: guidance: 'Chưa ghi nhận: 3 bước' leaves the viewport`, because
a card given less than its own minimum is clamped back up by the engine and its text
falls out of the window. The shipped fix moves the upper card toward the top edge
instead of clipping the lower one, keeps the step list in a scroll container so its
natural height stays bounded, and reflows the moment content outgrows its rect. The
layout test now runs the real 640×360 case, the oversized case, and asserts no card
is clipped under its minimum or pushed off screen.

## 5. Gates

Exact commit at the time of writing: `452d4d74` (frames and results are added as they
arrive; the commit that a result belongs to is stated with it).

| gate | what it checks | status |
| --- | --- | --- |
| R0 source provenance | fetch script asserts commits + SHA-256; receipt re-hashed | **PASS** (local, `29 assets, 0 problems`) |
| R1 art fidelity | nine-slice stress sheet at 2–3× inspected by eye; two bad crops and two bad icon bindings found and fixed | **PASS** (local) |
| R2 project integrity | `tools/review/scene_lint.py` over 315 scenes/resources/scripts: 0 problems, 4 notes (all pre-existing); gdtoolkit syntax pass over every changed script; semantic duplicate-declaration pass added this round | **PASS** (local, `340af5c7`) |
| R2b UI layer test | `tests/survival/ui/a6_ui_layer_test.tscn` | **PASS** — `A6 UI LAYER PASSED`, in the render job) |
| R3 native gameplay suites | A0/A3/A6 headless suites | **PARTIAL** — `Import and headless runtime tests` and `Xvfb rendered gameplay captures` pass on `ec033bc1`; only the pre-existing "original main baseline comparison" job fails |
| R4 native renders 720/1440/2160 | `a6-survival-ui-render.yml` publishes frames to `docs/survival/reviews/native/` | **PASS for the sets published on `ec033bc1`** — 15 frames, dimensions asserted per frame. The return set is being re-rendered for `340af5c7` |
| R5 visual acceptance by eye | inspection of R4 frames at each resolution | **PARTIAL** — avatar 720/2160 and title 720 inspected: clipping fixed, real title screen, honest no-art state. Return digest inspected: overlap found, fixed, re-render pending. Avatar frames still show the fail-closed state because this workflow stages no art |

Frames are now committed into the repository and were read by eye, so they are
usable evidence. They are still not a claim that a *player* did anything: the
avatar frames come from a job that stages no private art, so they show the honest
fail-closed screen, not the dressed one.

## 6. Evidence policy and why the render job changed

Previous A6 rounds captured frames into CI artifacts. Artifact downloads are blocked
from the review sandbox (`302` then `SSL_ERROR_SYSCALL`), so the frames were
effectively unreadable and "inspected by eye" kept degrading into "the PNG had the
right dimensions".

`.github/workflows/a6-survival-ui-render.yml` fixes that at the root: after rendering
at 1280×720, 2560×1440 and 3840×2160, it commits the frames to
`docs/survival/reviews/native/` with `[skip ci]`, so they are reviewable in the
repository and diffable against the next round. The job refuses to run headless
(`RENDERER REQUIRED`, exit 2), asserts every frame's native dimensions, and requires
each screen's own layout to fit the window it was drawn in.

## 7. Known gaps and handoffs

* **Season / day clock on the HUD** — nothing exposes it to the overworld. The HUD
  shows no clock rather than inventing one. *Handoff A0: `SaveService` needs a season
  projection the overworld can read.*
* **Equipped item / quick-use** — survival has no equipment state to read; the HUD
  does not draw an empty weapon slot to imply one. *Handoff A3.*
* **Items without art** — 28 of the 49 item ids in the survival data have no honest
  icon (notably `binding_cloth`, `knowledge_spares`, `iron_ore`, `coal`, `charcoal`,
  `clay`, `grain`, `wild_berries`, `core_*`, `venom_extract`, `moonleaf`). They show
  their name and an explicit "no art" marker. *Handoff A6/A3: source or commission an
  icon pass, or accept text-only rows.*
* **Death bag / bed respawn** — the authored death card exists; the bag and bed
  mechanics remain A0's and are untouched.
* **Continue locomotion (§4)** — the separate-process Continue frames still reported
  `idle` in run `41162133383`. This round did not fix it and does not claim to: the
  fix needs real position/velocity/displacement assertions after Continue, with and
  without a pending death, and a diagnosis of input versus capture harness. Marked
  **NOT_TESTED**, not passed.
* **Return-after-offline UI** — the season chip is now authored parchment, but the
  guidance/digest/record panels keep their older surfaces; judging them needs the
  published frames.
* **Blackletter headings with Vietnamese diacritics** — the display face
  (Grenze Gotisch) covers all 50 Vietnamese glyphs tested, so this is not a missing
  glyph, but at 26 layout units the dot-below marks sit on the hairline and
  `BẠN LÀ AI?` reads poorly. Changing the display face changes the identity of every
  screen, so it is recorded here rather than changed silently.
* **No standalone pack screen.** §3C's list view exists in the chest (bag side) and
  the workshop (costs and outputs), but there is no full-screen pack browser, because
  the only free key (`I`/`TAB`) is already bound to `field_codex` and inventing a
  second binding for the same key would be a gameplay change nobody asked for. Pack
  contents, capacity and empty/full state are all visible; browsing every stack as a
  grid is the remaining piece. *Handoff A0: an input action for a pack surface, or a
  decision to reuse `field_codex` in the overworld.*

## 8. Commits

| commit | what |
| --- | --- |
| `9afb7c8c` | art-directed survival interface: kit, theme, identity step, HUD, workshop, chest, render workflow |
| `78a11963` | title screen rewritten for the survival run |
| `fe3c9da3` | build strip on authored wood; shortfall named on refusal |
| `452d4d74` | icon bindings re-verified against members; two wrong bindings fixed |
| `83f23828` | HUD pack snapshot sampled at 4 Hz |
| `3b86a3cc` | season card on parchment; return frames included in the published set |
| `e88f2cee` | mechanical UI layer test + lint/parse jobs in CI |
| `8b39f756` | HUD built directly on its CanvasLayer |
| `a0b17fd8` | avatar screen parse error fixed; identity step rebuilt to the 640×360 budget; linter learns to see duplicate declarations |
| `ec033bc1` | return layout resolves a shared column instead of stacking cards |
| `340af5c7` | return cards move instead of being clipped; immediate reflow; real 640×360 layout tests |

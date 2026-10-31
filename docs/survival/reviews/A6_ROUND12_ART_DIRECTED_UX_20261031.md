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

## 5. Gates

Exact commit at the time of writing: `452d4d74` (frames and results are added as they
arrive; the commit that a result belongs to is stated with it).

| gate | what it checks | status |
| --- | --- | --- |
| R0 source provenance | fetch script asserts commits + SHA-256; receipt re-hashed | **PASS** (local, `29 assets, 0 problems`) |
| R1 art fidelity | nine-slice stress sheet at 2–3× inspected by eye; two bad crops and two bad icon bindings found and fixed | **PASS** (local) |
| R2 project integrity | `tools/review/scene_lint.py` over all 134 scenes/resources: 0 problems; every `game/**/*.gd` and `tests/**/*.gd` parses under gdtoolkit | **PASS** (local, `452d4d74`) |
| R3 native gameplay suites | A0/A3/A6 headless suites | **NOT_TESTED** — queued on GitHub runners at the time of writing |
| R4 native renders 720/1440/2160 | `a6-survival-ui-render.yml` publishes frames to `docs/survival/reviews/native/` | **NOT_TESTED** — queued |
| R5 visual acceptance by eye | inspection of R4 frames at each resolution | **NOT_TESTED** — depends on R4 |

No screenshot is claimed as evidence yet: §6 explains why, and what replaces it.

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
* **Return-after-offline UI** — its cards are still skinned with `StyleBoxFlat`
  button shells (`a6_run_card.tscn`). Replacing them is the next visual step; the
  frames from `a6-return-ui-render.yml` are the place to judge the replacement.

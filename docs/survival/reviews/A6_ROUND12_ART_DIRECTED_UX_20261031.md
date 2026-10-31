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
across `game/` and `tests/`, with a fixture that proves it fails. The same round then
proved the lesson twice: a refactor left a call to `_needs_reflow()` behind with the
function gone, which the parser also accepts and the engine also refuses, so the
linter now flags a private helper that no script in the repository declares. Both
rules are exercised by temporarily reintroducing the defect.

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

### 4.5 What the frames caught that the checks could not

Each of these passed every automated gate and was still visibly wrong:

* **Cards stacked on each other** — the digest frame drew the guidance panel over
  the run card. Found by looking at the published frame; fixed in `ec033bc1`.
* **A card clipped its own text** — after the overlap was gone, `Hết mùa 12/11` was
  cut in half by the run card's own plate. The card is a `Button`, and a `Button`
  takes no minimum size from its children; the harness only asks whether text is
  inside the *viewport*, not inside the card holding it. Fixed in `a81fe20f`, with a
  native assertion that the card is at least as tall as its content.
* **Text pushed off screen by a card that could not shrink** — a `PanelContainer`
  is sized by its content, so assigning it less height made the engine clamp it back
  and drop the footnote below the window (`text overflow: guidance: 'Chưa ghi nhận:
  3 bước' leaves the viewport`). Fixed in `36a97453` by making the card body
  scrollable so the card's own minimum is a height the screen can always give it.

### 4.6 Legibility finding, not yet fixed

The published return frame reads `Đấu vết`, `Có tiếng đống` and `Tính đầy` where
the source says `Dấu vết`, `Có tiếng động` and `Tỉnh dậy với 1 máu`. The strings are
NFC-normalised and correct in `a6_site_cue_chip.gd` and `a6_return_digest.gd`; all
three bundled faces carry every Vietnamese codepoint. What fails is the *rendering*
of stacked marks (circumflex plus acute on `ấ`, hook above on `ỉ`) at UI sizes: the
mark either merges with the letter above it or drops out, so the glyph reads as a
different letter. This is the same reason `BẠN LÀ AI?` is hard to read in the
blackletter headline. Fixing it means changing the type system — face or size — and
re-inspecting every screen, so it is recorded with evidence rather than changed
silently in the middle of another fix.

## 4.7 Round 12 continuation — WP1 field card and WP5 typography

Implementation `5a85ef4a`; frames published from it in `43cb0f66`. Both items were
built in the production scenes, not in a mockup, and inspected at 720p and 2160p.

**WP5 — the type system.** Every bundled face carries all 50 Vietnamese codepoints, so
the `Đấu vết / Có tiếng đống / Tính đầy` readings were a rendering failure, not a copy
error (confirmed earlier: source strings are NFC-correct). Rasterising the four real
strings in all three faces at 9, 11, 13 and 16 px shows the cause plainly: Handjet
merges the stacked marks — circumflex plus acute on `ấ`, hook above on `ỉ` — so `Dấu`
turns into a letter that reads as `Đấu`, while VT323 keeps both marks distinct from
9 px upward and Grenze Gotisch stays loose below 16 px.

So body, captions, numbers, warnings and headings are now VT323; the return panels —
which render the words CT inspected — were pointing at the shared
`living_arsenal_theme`, and since Godot themes do not inherit, A6 now owns
`game/survival/ui/return/a6_return_theme.tres`, a copy of that theme with the same
functional body face, and the four return scenes point at it. The decorative
blackletter survives only as `A6Wordmark`, used for the Latin `SOUL OF HERO` wordmark
where no accent can be lost. No correctly spelled string was edited to hide anything.

**WP1 — the field card.** The old card pinned itself to 214x46 and drew a
45-character region name past its own parchment (visible in the before frame as a
heading running into the border with a dead parchment band underneath). It now pins
only its width and grows to its rows; the region line is trimmed with an ellipsis
instead of widening the card; vitals join provisions as an icon + bar + number row;
the three `0/0` counters are hidden until the world has something left to find; and
the key legend is Vietnamese and legible over a bright sand tile.

Vitals needed a real seam rather than a placeholder: the character emits
`GameEvents.player_health_changed` only when health *changes*, so a fresh session
showed nothing until the first hit. The overworld now pushes the character's own
health at the same 250 ms sampled cadence it already uses for the pack snapshot, and
the signal keeps it current afterwards. A player without a health property leaves the
row hidden; an empty bar would be invented and a full one would be a lie.

The bar fill was inset two units inside a seven-unit track, which left a three-unit
band that read as a scratched line rather than a gauge; it now sits one unit in.

**Evidence, inspected by eye:**

| frame | what it shows |
| --- | --- |
| `world_fresh_world_1280x720.png` | the real overworld after the change: health 100/100 and provisions 80/100 as filled gauges, `TÚI 1/50`, live counters, Vietnamese legend, nothing clipped |
| `survival_ui_hud_field_3840x2160_half.png` | the shipped HUD close-up at maximum resolution: accents resolve correctly (`chuyển`, `tác`, `dựng`, `chế tạo`, `rút lui`) |
| `world_fresh_world_*` before (`11bc3a15` set) vs after (`43cb0f66` set) | before: heading clipped by its own card, dead parchment band, `0/0 0/0 0/0`, English legend, no health |

**Still absent, and why.** Season/day guidance and equipment/Core have no owner
projection to read, so they are not drawn at all rather than approximated — *handoff
A0: a season projection the overworld can read; A3: equipped-item state*. Threat
information stays out by D061 (no omniscient radar); the HUD shows an engagement line
only if the world ever emits one. Prompt copy in the world is still English
(`Stand near a chest to choose items.`) because it is A0-owned copy, not HUD copy.

## 4.8 A6 purposeful resume — avatar consumer, staged-art evidence, locomotion truth

Implementation `6f0a6df2`, building on `6d71410a`. Four things were finished, and one
long-standing claim was finally put to the test and **failed on the evidence**.

### The avatar consumer existed; its contract did not

`player_avatar_presenter.gd` (413 lines, under `game/survival/player/`) was already
mounted on both production actors and already read A0 correctly. What was missing was
anything an owner could point at: no injectable seam, no headless proof, no document.

- The presenter now resolves its appearance authority through one `_owner()` seam —
  `/root/SaveService` in the game, an injected object in a test. It still only reads.
- `tests/survival/ui/player_avatar_consumer_contract_test.tscn` proves the entire
  blocker matrix **on a public clone with no licensed art and no renderer**: the
  SaveService fallback, an owner without the projection method, an empty projection
  (`NO_IDENTITY`, proxy actor stays visible), a claimed identity without staged art
  (`SOURCE_BLOCKED`, proxy actor hidden, diagnostic visible), an unlicensed garment
  grade, `player_avatar_changed` re-resolution without restarting, and the published
  state shape. It runs in the public-clone CI job and gates on the result.
- `docs/survival/ux/A6_PLAYER_AVATAR_CONSUMER_CONTRACT.md` is the one-page mount
  contract, verified field-by-field against `save_service.gd` at these SHAs.

Writing the contract found two real drifts, which is what a contract test is for: the
test assumed a null seam meant "no owner" (the seam deliberately falls back to
SaveService), and the document promised a boolean `ready` the presenter never
published. Both are fixed; the presenter now publishes `ready`.

### The licensed-art frames were never reviewable

The avatar workflow uploaded its frames to CI artifacts only. Artifact downloads are
blocked from this sandbox, so every "native visual evidence" claim about the licensed
adventurers was really a claim about a green job. A publish job now commits the
rendered game frames to `docs/survival/reviews/native/avatar/` (with half-size viewing
copies for 4K); source ZIPs and extracted sheets stay runner-only and are never
committed. It needed `permissions: contents: write` on its own job, which the
workflow-level read-only token had been silently denying.

Inspected by eye at 720p: `male_720p_05_05_overworld_avatar_idle.png` is the authentic
male Adventurer standing in the real overworld with the Knight proxy removed and the
A6 HUD above him. Identity persists across a separate process.

### Continue locomotion: the claim was false, and now says why

Frames named `23_continue_overworld_walk` had been reporting `action=idle` for rounds.
Every frame now records the actor's position, velocity, whether the input is visible
and - when a walk assertion fails - which modals the gate is consulting.

The first honest run produced:

```
23_continue_overworld_walk: displaced 0.00 px  pressed=true permitted=false
  modals=["OverworldDeath"] velocity=(0.0,0.0) route=overworld dead=false
21_continue_home_walk:      displaced 0.87 px  pressed=true permitted=no-gate
  modals=[] velocity=(112.0,0.0) route=home
```

Two different failures, separated by evidence that did not exist before:

1. **Overworld — harness bug, now fixed.** A0 restores the pending death across
   processes together with the death card the previous process opened. The harness
   respawned the actor directly and left the card up; the card is a registered gameplay
   modal, so A0's input gate correctly suppressed every press. The character was never
   broken. Recovery now presses the card's own answer button and fails if the card
   survives the answer (`6f0a6df2`).
2. **Home — still open, and it is not A6's.** The home actor holds `velocity=(112,0)`
   while displacing 0.87 px, i.e. `move_and_slide()` is being blocked immediately after
   the move. That is collision or a movement bound in A0's home scene, not the avatar
   and not the harness. It is recorded as a named blocker with the measurement rather
   than papered over; the walk frame remains a real failure.

The gate structure was also split so a failing step cannot hide the rest of the
evidence: each render step is allowed to fail so its frames still exist, and a final
step fails the job unless all six succeeded. The job is still red on the real bug.

### What A0 still has to provide

| need | status |
| --- | --- |
| `get_player_appearance_projection()` / `set_player_avatar()` / `player_avatar_changed` | **present and verified** at `6f0a6df2` |
| licensed art for equipment grades 1 and 2 | **absent** — a source-approval gate, not an API gap; consumer keeps the same character at grade 0 and names the gate |
| season/day clock projection for the HUD | **absent** — the HUD shows no clock rather than inventing one |
| equipped tool, durability, Core possession | **absent** — no such projection exists; the HUD draws nothing |
| home-actor movement after Continue | **blocked** — `velocity` held while position is static, see above |


### 4.9 Final state of this pass — `5716930c`

**What is proven, with frames inspected by eye:**

| claim | evidence |
| --- | --- |
| the selected character is the one on screen | `avatar/male_720p_05_05_overworld_avatar_idle.png`, `avatar/female_1440p_05_05_overworld_avatar_idle.png` — two visibly different authentic Adventurers in the real overworld, Knight proxy removed, A6 HUD above |
| identity survives a separate process | Continue frames in `avatar/*_continue_*`, and the identity assertion inside `private-staged-art` |
| all three resolutions render | 68 published frames: 14 male 720p, 14 female 720p, 14 female 1440p, 28 male 2160p (plus native + half-size copies) |
| death is a real prompt, not a debug box | `avatar/male_720p_12_09_overworld_death.png` — parchment card, heading and message inside the panel, `TỈNH DẬY` action |
| the HUD reports real health and capacity | `world_fresh_world_1280x720.png`, `survival_ui_hud_field_3840x2160_half.png` |
| Continue locomotion in the overworld | `23_continue_overworld_walk` now displaces a measured distance and reports it in the run log |

**What still fails, and whose it is:**

| failure | measured state | owner |
| --- | --- | --- |
| home actor does not walk after Continue | both directions move 1.0–2.5 px then `velocity=(0.0,0.0)`, no modal, no gate — the home screen's walkable-position resolution pins the restored actor | **A0** (`game/ui/screens/home/**`); A6 measures and reports it, does not edit it |
| equipment grade 1/2 appearance | `GRADE_n_APPEARANCE_SOURCE_BLOCKED`, same character kept at grade 0 | **source-approval gate**, not an API gap |
| season clock, equipped tool, durability, Core possession in the HUD | no projection exists; the HUD draws nothing rather than inventing | **A0** API gap |

**The five integration facts A0 needs** are in
`docs/survival/ux/A6_PLAYER_AVATAR_CONSUMER_CONTRACT.md`; the executable half runs on a
public clone in the `public-clone-fail-closed` job.

**Two false claims this pass killed.** First, that Continue locomotion had been
captured: frames named "walk" reported `idle` and were accepted anyway. Second, that
licensed-art visuals were verified: they were uploaded to unreadable CI artifacts. Both
are now measurable, and the second now publishes inspectable frames with each run.

### 4.10 WP3 — the workshop, rebuilt as a shopping list

Implementation `d31de790`; frames published from it.

The crafting screen asked the player to parse one long sentence per recipe, in orange
on green, with no icons and no sense of how close they were:

```
Field Meal — needs 2 grain, 1 wild berries — fuel nothing — makes 2 field meal
— 6s active — short 2 grain
```

Each recipe is now a card. The result icon sits in an authored socket; the action is
the result name and its exact cost list in ink on the plate (cream on green was the
same low-contrast habit the old design had, merely relocated); below it sits one chip
per ingredient carrying that ingredient's own icon and `owned/required`, amber and
numerically short when it cannot be paid; fuel is shown as the same chips; the
duration is stated once; and the state column names the concrete blocker — *station
offline*, *queue full*, the shortfall, or *all materials* — derived only from the
owner's own answers.

Jobs are separated the same way: a claimable job gets the authored plate, a gold
`COLLECT` and a gold status word; a running one stays quiet; paused and cancelled read
amber. A finished job can no longer be mistaken for a busy one at a glance.

**What is deliberately absent.** Durability, station tier and fuel efficiency are not
rendered because the economy data does not carry them. Inventing those numbers would
be worse than their absence; they are an A3 handoff, not an A6 omission.

**Contract preserved.** Node names `Recipe_<id>_<station>` and
`Technology_<id>_<station>` still live in the scroll, and the button text still ends
in the exact cost list that `survival_research_clock_ui_test.gd` asserts. The
orchestration oracles (`Import and headless runtime tests`, `Xvfb rendered gameplay
captures`) pass on the rebuilt panel.

**Inspected by eye** at 720p in `world_economy_1280x720.png`, before and after; the
first rebuild render is what caught the contrast, the 9 px chips and the clipped
shortfall, all fixed in `d31de790`.

## 5. Gates

Exact commit at the time of writing: `452d4d74` (frames and results are added as they
arrive; the commit that a result belongs to is stated with it).

| gate | what it checks | status |
| --- | --- | --- |
| R0 source provenance | licensed archives fetched from pinned refs; receipt re-hashed; `license_review.status = VERIFIED_GAME_USE`; no source ZIP or sheet committed | **PASS** — `git ls-files private_art` empty, asserted in CI |
| R1 art fidelity | the chosen Adventurer is on screen in the real overworld, Knight proxy removed; frames inspected at 720p | **PASS** (male). Female captured by the same job; its frames publish from the same run |
| R2 project integrity | `scene_lint.py` 317 files: 0 problems, 4 pre-existing notes; gdtoolkit syntax on every changed script; YAML of both workflows parsed | **PASS** (`6f0a6df2`) |
| R2b UI layer test + avatar consumer contract | layer test, and the new headless contract on a public clone | **PASS** — "Public clone fails closed" job green including the contract |
| R3 native gameplay suites | avatar identity journeys, headless runtime, Xvfb captures | **PARTIAL** — staged-art identities, public-clone fail-closed, return UI, import/headless and Xvfb all **PASS**; the Continue *home* walk **FAILS** with a measured collision-bound cause owned by A0 |
| R4 native renders 720/1440/2160 | both render workflows publish into the repo | **PASS** — 68 staged-art frames published across male/female at 720p, female at 1440p and male at 2160p, plus the survival and return sets |
| R5 visual acceptance by eye | inspection at each resolution | **PARTIAL** — inspected: male + female overworld, death prompt, HUD close-up, return digest. The home walk frame is published and labelled as a measured failure rather than accepted |

### Nine-gate verdict, this round

| gate | verdict | evidence / why |
| --- | --- | --- |
| RESEARCH_PROVENANCE | **PASS** | consumer verified field-by-field against `save_service.gd`; type decision measured on rasters; D045/D046 untouched |
| ARCHITECTURE | **PASS** | one read-only seam, one owner; no second inventory, save or appearance authority; no A0/A1/A3/A8 file edited |
| CODE_RUNTIME | **PARTIAL** | every changed script parses and lints; the public-clone contract passes; the Continue walk fails on measured state |
| TEST_ORACLE | **PARTIAL** | the contract test is adversarial (fake owners, absent API, unstaged art); the walk assertion now measures displacement and names the blocker instead of trusting a label |
| VISUAL_UX | **PARTIAL** | authentic male Adventurer verified on screen at 720p; female and 4K frames not yet produced |
| SYSTEM_VALUE | **PARTIAL** | identity survives a process restart and the HUD reports real health and capacity; season, equipment and durability still have no projection to show |
| SAVE_MIGRATION | **NOT_APPLICABLE** | no persisted schema changed; identity still written only by A0 |
| INTEGRATION | **PARTIAL** | presenter already mounted on both production actors; the executable handoff exists; the home-actor movement blocker and grade-1/2 art gate remain |
| BALANCE_REPLAY | **NOT_TESTED** | nothing here changes costs, durations or rewards |

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
| `abf0f49a` | restore a helper a refactor deleted; linter flags undefined private calls and no longer misses `static func` |
| `36a97453` | guidance card body scrolls, so the card can be given a height that fits |
| `a81fe20f` | run card measures itself by its content; native test asserts it |
| `744db254` | functional Vietnamese type (VT323) with A6-owned return theme; field card rebuilt; HUD close-up capture |
| `5a85ef4a` | vitals pushed from the character at a sampled cadence; bar fill reads as a gauge |
| `3a76f6fa` | walk frames assert real displacement and record actor motion; avatar frames get a publish path |
| `7359d5c4` | injectable owner seam + headless avatar consumer contract |
| `e98f35f2` | A0 mount contract document |
| `a33a3783` | contract test corrected against the real fallback; presenter publishes `ready` |
| `bb9ffe50` | publish job gets write permission; capture failures emit annotations |
| `b60d17d4` | evidence gathering split from the gate |
| `6f0a6df2` | pending-death card answered the way a player does |
| `18d72ffc` | recovery settles before deciding, and again before the press |
| `e00daa11` | find the death card where it actually lives (child of the HUD layer) |
| `b2507d04` | death card under the themed root in a centring container; layer test asserts structure |
| `5716930c` | walk where there is room; a bounded actor stopped at its edge is not a broken character |
| `aa38d1d0` | workshop recipes rebuilt as cards with ingredient chips and owner-derived states |
| `d31de790` | workshop contrast, chip size and shortfall wrapping fixed from the render |

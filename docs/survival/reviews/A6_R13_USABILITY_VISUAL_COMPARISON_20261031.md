# A6 R13 — creator visual comparison and handoffs

Round: **R13-A6-USABILITY (continuation)**. Branch `arena/05e0328d-soul-of-hero`.
Scope is presentation only: no A3 business logic, no A0 movement, no merge, and no
self-declared visual acceptance.

Authority read from `origin/feature/survival-rpg-foundation-20261029`
(`CURRENT_PRODUCT_CONTRACT.md`, `DECISIONS.md` D051–D074, `ACCEPTANCE.md` P1–P8,
`INDEPENDENT_DEEP_REVIEW_PROTOCOL.md`) plus the R13 ledger in issue #9 and the joint
audit comment `6546555828`, which accepted the pointer/rebuild/focus/recipe-identity
work as scoped and asked for this round to stay narrow: localisation, legibility,
hierarchy, and **two strongly contrasted 1× views of the same scene**.

## 1. The five defects the creator named, and what answered each

| what the creator saw at 1× | cause | what changed | evidence |
| --- | --- | --- | --- |
| every recipe was the same green button | the row **was** the `Button`, so the authored green button texture painted every row identically | rows are plates now. State is stated three ways: a coloured tag or word, a one-word verdict (`CHẾ` / `THIẾU` / `ĐẦY` / `TẮT` / `ĐÃ BIẾT`), and the spine/edge of the plate. The green survives only where it means "press me": `ĐÓNG`, `CHỌN`, `HUỶ` | `survival_ui_workshop_queued_dir{a,b}_1280x720.png` |
| English nouns in a Vietnamese panel (`Field meal`, `Furnace kit`, `Stone pick`, `Workbench kit`) | the panel printed the A3 catalog's English `label` | `game/survival/ui/a6_vietnamese_names.gd`: one display table for all **56** catalog items, all **36** recipe outputs and **5** station kinds, keyed by the catalog's own ids. Unknown ids fall back to the catalog label, then to the raw id — nothing is invented. A3 data is untouched | `Bữa ăn dã chiến`, `Bộ lò rèn`, `Cuốc đá`, `Bộ bàn thợ` in the same frames |
| Vietnamese pixel text was muddy | **measured, not guessed** — see §2 | the body face is VT323 in both directions, and the smallest type on these surfaces went from 8–10 canvas units to 11–13 | §2 |
| the missing-ingredient text was tiny and pushed to the right | it was the right-hand "state" column, at 10 units, aligned right | the shortfall is now the **first thing on the cost line**, left-aligned, at 11 units, in warn colour; the cost chips beside it carry the requirement only | `workshop_*` frames, `Thiếu …` rows |
| queue rows could not be read at a glance | one bar, a 9-unit status word and `COLLECT`/`CANCEL` in English-ish words | the queue now sits **above** the catalog, names the product (through the catalog's own recipe→output table), draws its progress, states its status in Vietnamese, and offers exactly one action | `survival_ui_workshop_queued_*` |
| two empty avatar card frames | an unstaged `TextureRect` and a caption that said `(chưa có hình)` | a deliberate seal: accent band per identity, framed slot, the word being chosen, and a tag that states the truth. Still no Knight, still no stand-in character | `survival_ui_avatar_choice_dir{a,b}_1280x720.png` |

Two smaller defects the new frames exposed and this round also fixed: a row said `ĐẦY`
on **every** row whenever the station queue was full (hiding the payability answer — the
header states queue fullness once now), and the cost chips read `4/2`, which made the
player work out which number was which (the chip carries the requirement; the colour and
the shortfall sentence carry whether the bag covers it).

## 2. Why the font changed — the measurement, not a preference

Both faces ship in the repo with their OFL licences. Rendering the same Vietnamese
string with the same string at the same pixel size, offline, with the shipped TTFs:

| face | 20 px | 22 px | 24 px | 28 px | 32 px |
| --- | --- | --- | --- | --- | --- |
| Handjet-SemiBold | unreadable | unreadable | unreadable | unreadable | unreadable |
| VT323-Regular | clean | clean | clean | clean | clean |
| GrenzeGotisch-SemiBold | partial | partial | use as display only | — | — |

Handjet's precomposed glyphs for **stacked** marks (`Bữa`, `XƯỞNG`, `Thiếu`, `NỮ`)
overlap into one blob at every raster size — growing the type does not fix it, which is
why "make the font bigger" was not the answer. This is visible in the previous build's
own published frame: at 3840×2160 the workshop title is still a blocky smear, because
the engine rasters at canvas size (640×360), not at window size.

Consequences applied to both directions: the survival theme's default, `Button`, `Label`
and `RichTextLabel` faces are VT323; the HUD's region/carry/number/prompt type went
8–12 → 11–13 units; the workshop's name/cost/caption type went 11/10/9 → 15/13/12.

**What this does not claim:** VT323 is not a pixel-art *design* decision for the whole
game — it is the smallest change that makes Vietnamese legible at the sizes this
interface needs. If the creator wants Handjet's narrower voice back, the only honest
route is to drop diacritics, which this project will not do.

## 3. Two directions, same scene, same content

`A6_VISUAL_DIRECTION` selects the take; the CI matrix renders **both** per resolution, in
separate processes and with separate save files, so neither take inherits the other's
state.

| | **A — "SỔ TAY DÃ NGOẠI"** (field ledger) | **B — "BẢNG KHẮC"** (carved board) |
| --- | --- | --- |
| surface | the authored parchment window, thrown open as a ledger | a dark walnut plate with a warm hairline edge |
| rows | pale plates with an ink hairline under each: a register | dark plates with a 3-unit state-coloured spine |
| names | VT323, ink on paper, quiet | Grenze Gotisch, cream, louder |
| verdict | a coloured **word**, ink-on-paper | a filled coloured **tag** |
| stations | the authored wooden bar, cream label | a dark bar with a gold rule and gold label |
| feel | a notebook you keep while working | a board hanging in the shop |

Both keep the same layout budget, the same node names, the same input behaviour and the
same numbers. The frames are paired by state name: `…_dira_…` and `…_dirb_…`.

**Recommendation: A (ledger).** Reasons, in order of weight:

1. A keeps the parchment and the wooden station bar that the rest of the survival
   surfaces (HUD card, build strip, return card) already use; B would introduce a second
   material language the other seven A6 screens do not have.
2. At 1× the ledger's ink-on-pale-plate wins on the smallest text (the cost chips), while
   B's cream-on-dark needs one more step of contrast to reach the same legibility on the
   smallest line.
3. B's gold tags are the most striking element on the surface, which is *good* for a
   collectible queue and *bad* for a list where five of eight rows can be unabtainable;
   A's colour is confined to the word that states the verdict.

That is a recommendation, **not a decision**: D054 keeps the art language with the
creator.

## 4. Frames (native 1×, published by CI)

All frames are at `docs/survival/reviews/native/`, at **1280×720**, **2560×1440** and
**3840×2160** (with a `_half` viewing copy for the 4K ones).

| frame | what it shows | source of the data |
| --- | --- | --- |
| `survival_ui_workshop_queued_dira/dirb_*` | workshop with one **real** A3 job in the queue, real bag totals, real affordability | production overworld, production `economy_session` |
| `survival_ui_workshop_refused_dira/dirb_*` | the same surface after the session refused a second queue (queue full) — the notice is the production refusal sentence | production session answer |
| `survival_ui_avatar_choice_dira/dirb_*`, `..._avatar_female_*` | New Game's identity step, male/female focused, unstaged art | real screen, real manifest |
| `survival_ui_hud_field_dira/dirb_*` | HUD over the authored **dark** backdrop | production `overworld_hud.gd` |
| `world_fresh_world_1280x720_dira/dirb`, `…_2560x1440_…`, `…_3840x2160_…` | HUD on the **bright** live world | A0's native world driver |
| `world_economy_*_dira/dirb` | workshop opened through the real world | A0's native world driver |
| `world_build_*`, `world_roof_*` | build strip, roof fade — unchanged surfaces, re-rendered to prove they did not regress | A0's native world driver |

**Evidence class.** `world_*` frames are production components on the real scene.
`survival_ui_*` frames are production components driven by fixtures — the workshop ones
run on the production overworld with the production session, and their inventory is
granted through `SaveService.grant_inventory_item` with a transaction key, which is this
repo's established fixture pattern. They are not a claim that a player earned those
numbers, and they are not a human playtest.

**Not captured this round, and not claimed:** a job in the `ready`/`LẤY` state. The CI
window is unfocused, so the A3 session is given no clock and a queued job never
completes; the frame that was going to show it showed the same queue twice, so it was
replaced with the refusal state instead. The collect affordance is therefore
**NOT_TESTED at 1×** this round.

## 5. Input, identity and scroll: unchanged, and re-proved

The R13 GUI acceptance is not re-litigated here. The same suite ran at the same three
resolutions on the redesigned surface:

```text
A6 WORKSHOP GUI INPUT PASSED (19 checks) at 1280x720 (canvas 640x360)
A6 WORKSHOP GUI INPUT PASSED (19 checks) at 2560x1440 (canvas 640x360)
A6 WORKSHOP GUI INPUT PASSED (19 checks) at 3840x2160 (canvas 640x360)
```

Real pointer motion, press and release, real wheel events, across a list rebuild:
one click queues one job, a rebuild under a stationary pointer queues nothing, a click
after a wheel scroll queues the row under the pointer, an unaffordable row does not
queue, a refusal is never phrased as success and never prints an owner token, and focus
never survives on a freed node. Node names (`Recipe_<recipe_id>_<station>`) and the
pressed handler are unchanged, which is why the suite still passes after the row was
rebuilt.

One assertion *was* changed, deliberately and in the open: `economy_recipe_identity_test`
asserted `text.begins_with("Charcoal")`, i.e. it pinned the old English headline. It now
asserts `begins_with("Than củi")` **and** `not contains("burn_charcoal")`, which is the
same fact (the headline names the product, never the recipe id) expressed in the
interface's language. It is not weaker: it now also fails if the id leaks through.

## 6. Data: what the frames really draw

| value in these frames | really connected? | producer |
| --- | --- | --- |
| bag totals, capacity (`TÚI 6/30`) | **yes** | A0 `SaveService.get_inventory_capacity_snapshot` |
| recipe list, costs, durations, station, queue capacity | **yes** | A3 catalog + `economy_session` |
| affordability per row | **yes**, derived from the two above | A6, read-only |
| jobs, status, elapsed/duration | **yes** | A3 `economy_session.jobs()` |
| refusals | **yes** | A3 command result → A6 Vietnamese mapping |
| HUD vitals / provisions / carry / counts | **yes** | A0 signals + `SaveService` |
| secured wallet `soh.a6.account_wallet.v1` | **no** — contract + validator, no owner projection | drawn as absent |
| in-world clock / season (D060) | **no** — no projection | absent |
| equipped tool | **no** — no projection | absent |
| durability | **no such concept in the repo** | absent |
| Core charges (D072) | **no** — no projection | absent |
| death bag (D073) | **no** — no projection | absent |
| region name | yes, but it is **A0's English string** (`THE HOLLOW MARCHES · WESTERN FOUNDRY QUARTER`), trimmed with an ellipsis | A0 fixture string, not an A6 label |

`a6_data_authority_consumer_test.gd` fails the build if an A6 file grows its own copy of
any of the missing projections.

## 7. The one external blocker (recorded once, not re-run)

The avatar art cannot be staged in CI, and the reason is access, not code:

```text
$ git ls-remote https://github.com/Khanh-glitch/APEX-CHAOS.git
remote: Write access to repository not granted.
fatal: unable to access ...: The requested URL returned error: 403
$ gh api repos/Khanh-glitch/APEX-CHAOS                       → 403 Resource not accessible by integration
$ gh api repos/Khanh-glitch/APEX-CHAOS/contents?ref=<pin>    → 403
$ codeload.github.com/Khanh-glitch/APEX-CHAOS/tar.gz/<pin>   → 404
```

Exhausted before concluding that: every remote branch was searched
(`git ls-tree -r` for `unarmed|craftpix|555940|419402|avatar_art`), both pinned commits
were looked up in this repository (`git cat-file` → absent), and no `private_art/`
staging directory exists in this checkout. So `a6-native-avatar-validation.yml` fails at
*Fetch the licensed source archives*, and every dressed-avatar frame is **NOT_TESTED**,
not failed and not passed.

| owner | what would unblock it |
| --- | --- |
| asset repository | make `Khanh-glitch/APEX-CHAOS` readable by the workflow identity, or add a read-only `A6_ASSET_TOKEN` secret (the fetch script already uses it) |
| nobody | no A6, A0 or A7 change unblocks it |

What is unaffected: the **no-art state fails closed** — no Knight, no substitute
character, no claimed identity, and now a deliberate seal instead of two empty frames.

## 8. What the creator actually has to decide

1. **Direction: A (ledger) or B (board)?** Recommendation above is A; both are already
   built, so the choice is one constant.
2. **Body face: VT323 for the survival interface (both directions).** If you want
   Handjet's narrower voice back anywhere, say which words may lose their diacritics —
   this round will not drop them.
3. **Technology rows keep the catalog's English cost list** (`4 knowledge spares`,
   `3 iron scrap`) because A0's research gate asserts those exact substrings. Localising
   them needs a one-line change on A0's side:
   `tests/survival_research_clock_ui_test.gd:66` → assert the Vietnamese names instead.
   Do you want me to hand that patch to A0?
4. **Queue above the catalog** (what is running first) — keep, or put recipes first?
5. **The refusal line lives in the header notice** — keep, or flash the offending chip?
6. **`ĐANG CHẾ` as the queue heading** — or `HÀNG ĐỢI`?

## 9. Not done, and not claimed

* No merge, no `VISUAL_ACCEPTED`, no "product integrated". The branch is a review branch.
* No A3/A0/A7 change: `economy_panel.gd` (A6 surface), `overworld_hud.gd` type sizes and
  the A6 theme's faces only.
* The `LẤY` (collect) state is not captured — see §4.
* Region names, prompt strings and world labels that come from A0 data are still English;
  they are A0's strings, not A6 labels, and this round did not touch them.
* Grade 1/2 armour appearance stays blocked on D051; the consumer keeps grade 0 and names
  the gate.
* A0's `21_continue_home_walk` failure (1.80 px / 2.07 px against a 4.0 px floor) is
  unchanged and is not A6's to fix; the handoff is
  `docs/survival/ux/A6_A0_HOME_LOCOMOTION_HANDOFF_20261031.md`.

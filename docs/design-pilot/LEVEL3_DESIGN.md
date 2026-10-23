# Chapter 1 Level 3 Design Brief — *Thư Khố Giao Hỏa* (Crossfire Archive)

## 1. Level Fantasy & Core Gameplay Verb

- **Level Fantasy:** A collapsed subterranean **Forbidden Scriptorium & Crossfire Archive** (*Thư Khố Giao Hỏa*) — staggered timber folio stacks, iron-banded stone lecterns, sapphire ink basins, and sunken archive trenches held by ranged **Skeleton Reaper** (*Tử Thần Xương*) anchors behind melee bone-vanguard screens.
- **Core Gameplay Verb:** **Read the Reaper sightline, break boomerang line-of-sight on solid archive stacks, peel the melee screen out of crossfire, and close inside the Reaper's `82 px` minimum kite threshold.**
- **Physics Grounding in Live Engine Code (`advanced_enemy.gd` + `spectral_disc.gd`):**
  - `SkeletonReaper` (`Archetype.BONE_REAPER`) engages at `detection = 205 px` (`12.8 tiles`), maintains `preferred_min..preferred_max = 82..150 px` (`5.1..9.4 tiles`), telegraphs a cyan aiming beam for `0.56s`, fires a returning `SpectralDisc` out to `188 px` (`11.75 tiles`), and pauses in `State.RECOVER` for `0.72s`.
  - Crucially, `SpectralDisc._physics_process` casts a physics ray against **Collision Mask `1` (`Geometry`)** every frame (`PhysicsRayQueryParameters2D.create(..., 1)`) and **immediately aborts forward flight (`_begin_return()`) upon hitting any `Geometry` wall or solid cover pier**.
  - Every solid **Archive Book-Stack Pier** (`2×2` to `3×2` `Geometry` plinths topped with slatted timber book-crates `[18, 25..26]` and iron-banded folio coffers `[6, 6]`) is therefore placed at **measured `5–9 tile` (`80–144 px`) intervals** from each Reaper perch — turning cover-stepping from flavor text into literal projectile interception.

---

## 2. How Level 3 Differs Structurally & Visually from Level 2 (*Ngã Rẽ Xương Trắng*)

| Dimension | Accepted Level 2 (*Ngã Rẽ Xương Trắng*) | Redesigned Level 3 (*Thư Khố Giao Hỏa*) |
|---|---|---|
| **Spatial Topology** | Vertical **E → W → E switchback** with symmetrical North/South fork halls and wide colonnaded naves | Three **W → E staggered crossfire galleries** built from **asymmetric diagonal book-stack islands, sunken chasm firing trenches, and flanking cloisters** |
| **Color & Prop Palette (`0x72` Atlas)** | **Crimson `[1,2]` vs Sapphire `[2,2]`** fork standards, white ossuary columns, skull pedestals | **Emerald `[1,3]` & Amber-Gold `[2,3]`** archive standards, **slatted timber book-stacks (`[18,25..26]`)**, **iron-banded folio coffers (`[6,6]`, `[19,25]`)**, **sapphire ink fountains (`[4..6,3..4]`)**, **reagent vials (`[19..21,21..22]`)** |
| **Primary Threat & Decision** | Pure melee skeleton packs (`15` skeletons, `0` reapers) + short spiked branch vs longer clean branch | **Ranged crossfire (`15` skeletons + `5` `SkeletonReaper` anchors)**: choose between **exposed fast firing lanes** vs **protected sightline-broken flanking aisles** (`+9` to `+15` tiles) + **4-of-5 optional vault sigil routing** |

---

## 3. ASCII Floor Footprint (`116 × 96` Grid, Three Door-Linked Floors, Zero Inter-Floor Camera Bleed)

```text
FLOOR 1 (y = 1..25, W -> E): COLLAPSED SCRIPTORIUM, SECRET FOLIO VAULT & TWIN-PERCH CAMP 1
                                   [l3_f1_hidden_cache: Optional Sigil #1]
                                          +-----[Vault Door]-----+
  [Spawn Vestibule]       +--North Cloister--+  Anchor(60,10)    +--> North Stack Flank --+
  (10,13) ===Bridge===> ==|  [Stack]  ====Chasm====  [Stack]    |   [Stack]      Reaper01 |
                          |  ===Direct Center Firing Line====   |=====[Lectern]  Sigil #2 |==> Door F1->F2
                          +--South Exposed Ledge [Chest 320pt]--+   [Stack]      Reaper02 |     (112,14)
                                                                 +--> South Stack Flank --+

FLOOR 2 (y = 30..58, W -> E): HERRINGBONE TRENCH GALLERY (`mid`), SECRET RELIQUARY & PINCER CAMP 2
  [Safe Landing]          +--North Bridge----+                   +--North Protected Flank (isolates Reaper02)--+
  Door(9,42) -> CP(16,42) |  [Chest 360pt]   |== Diagonal Chasm =|   [Bastion]    Reaper02(Pulpit)             |
                          |  [Stack Piers]   |== South Bridge  ==|==== Direct Center Pincer Line === Sigil #4  |==> Door F2->F3
                          +------------------+--------+----------+   [Bastion]    Reaper01(SE Perch)           |     (112,46)
                                                [l3_f2_hidden_reliquary: Optional Sigil #3]

FLOOR 3 (y = 61..80, W -> E): SPLIT-BASTION ARCHIVE SPINE & SEAL EXIT CHAMBER (`end`)
  [Safe Landing]          +=== North Fast Exposed Firing Lane (Reaper01 LOS) ===> Reaper01 + Sigil #5 ==+
  Door(9,72) -> CP(16,72) |    ###### Central Book-Stack Spine + Chasm (2 Cross-Over Gaps) ######       |==> [l3_f3_exit]
                          +=== South Protected Flank (Zero Reaper LOS until East Gap) ==================+     Exit(104,71)
```

---

## 4. Target Encounter Beats, Sightline Loops & Route Choices

| Floor | Main Route vs Protected Flank / Optional Discovery | Reaper Anchor Placement & Sightline Break |
|---|---|---|
| **Floor 1** | **Center Crossfire Line** (`~98 tiles`) cuts straight across twin trench bridges; **North Archive Cloister + Hidden Folio Vault** (`+12 tiles`) secures **Optional Sigil #1 (`l3_sigil_crossfire_cache`)** behind vault doors; **South Line-of-Fire Ledge** rewards **`l3_chest_line_of_fire` (`320 pts`)**. | `l3_c1_reaper_01` `(104, 9)` & `l3_c1_reaper_02` `(104, 19)` hold elevated east back-wall perches (`< 82 px` backstop stops infinite kite) behind two staggered `3×2` book-stack piers at `x = 91..93` (`11 tiles` sightline, broken at `6 tiles` by center lectern pier `x = 97..98`). |
| **Floor 2** | **Direct Pincer Cut** (`~96 tiles`) crosses south trench bridge straight into Camp 2; **North Protected Flank** (`~109 tiles`, `+13 tiles`) wraps above solid book-stack bastions to isolate `l3_c2_reaper_02` out of `l3_c2_reaper_01`'s range; **West Scholar Pocket** grants **`l3_chest_ring` (`360 pts`)**; **South Secret Reliquary (`l3_f2_hidden_reliquary`)** grants **Optional Sigil #3 (`l3_sigil_ring_cache`)**. | `l3_c2_reaper_02` `(94, 42)` commands the central pulpit while `l3_c2_reaper_01` `(105, 48)` cross-fires diagonally from the SE corner; staggered piers at `x = 85..87` and `x = 99..101` let players block one Reaper's boomerang completely while punishing the other. |
| **Floor 3** | **North Fast Lane** (`~94 tiles`) sprints straight toward `l3_sigil_final` (`(77, 70)`) and `l3_exit` (`(104, 71)`) under `l3_c3_reaper_01`'s barrel; **South Protected Flank** (`~106 tiles`, `+12 tiles`) runs behind a continuous book-stack & chasm spine with mid/east cross-over gaps, emerging `4 tiles` beside `l3_c3_reaper_01`. | `l3_c3_reaper_01` `(74, 67)` locks down the upper lane (`11.75-tile` disc reach across north bridge), zero LOS into the south aisle until `x = 70`. |

---

## 5. Preserved Immutable Contracts & Pacing Target

- **Preserved Contracts (Zero Drift):**
  - Grid `116 × 96` (`>= 12-tile` black abyss gaps between floors so `640×360` world cameras show zero adjacent-floor pixel bleed), `camera_bounds = [0, 0, 1856, 1536]`, `required_sigils = 4` (`5` authored sigils), `density_cadence_anchor = [968, 168]` (`Vector2i(60, 10)` on `collision_clear` floor).
  - Final footprint metrics: **`3,415` `Backdrop` floor cells** (`[1027, 1267, 1121]` vs `5,004` bloated baseline — `-31.8%` empty filler removed), **`1,632` `Geometry` cells**, **`97` `Decor` cells**, **`2,929 / 2,929` (`100.0%`) non-spike capsule-clear cells reachable**, `Baseline sym_diff = 4,791` (`Jaccard = 0.275`), `Min diff vs other 9 maps = 2,641`.
  - All **77 original entity IDs** preserved with exact types (`1` `player`, `15` `skeleton`, `5` `skeleton_reaper`, `4` reciprocal `floor_door`, `5` `sigil`, `2` `checkpoint`, `2` `chest` `[320, 360]`, `18` `spikes`, `1` `exit_gate`, `12` `torch`, `12` `coin`) + justified environment polish (`l3_torch_13..22`, `l3_coin_13..18` = **93 total entities**).
  - All **11 room IDs**, **3 `combat_camps` IDs & enemy memberships**, **3 `safe_zones`**, and **`l3_optional_sigil_pair` special zone** preserved.
- **Measured Capsule-Safe Runtime Window (`118 px/s = 7.375 tiles/s` live Knight move speed):**
  - Pure continuous safe walk across all 3 floors: **`282.7 tiles` (`4,523 px`, `38.3s`)** via direct crossfire lanes vs **`313.1 tiles` (`5,010 px`, `42.5s`)** via protected sightline-broken flanks & optional vault sigils.
  - Full combat clear (`15` skeletons + `5` Reapers across 3 cover-based camps + `4/5` sigils + `2` chests): **`~115–170 seconds` (`1.9–2.8 minutes`)**.

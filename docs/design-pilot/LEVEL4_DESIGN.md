# Chapter 1 Level 4 Design Brief — *Thánh Tích Xoắn Ốc* (Spiral Reliquary)

## 1. Level Fantasy & Core Gameplay Verb

- **Level Fantasy:** A consecrated molten-lit **Subterranean Spiral Reliquary** (*Thánh Tích Xoắn Ốc*) built in concentric stone coils around sacred central shrines, illuminated by molten-amber fire braziers and guarded by rhythmic iron trap gates and elite **Skeleton Reaper** crossfire pins.
- **Core Gameplay Verb:** **Sight the central shrine from the outer ring, commit to the spiral's rhythmic trap-and-breather cadence, use radial spokes to out-rotate elite pins, and converge on the inner sanctum without backtracking slog.**

---

## 2. How Level 4 Differs Fundamentally from BOTH Level 2 and Level 3

| Dimension | Level 2 (*Ngã Ba Cốt Trắng*) | Level 3 (*Thư Khố Giao Hỏa*) | Redesigned Level 4 (*Thánh Tích Xoắn Ốc*) |
|---|---|---|---|
| **Macro & Camera Silhouette** | Symmetrical **Bone Cathedral** vertical switchback (`E → W → E`) with twin fork halls | Asymmetric **Crossfire Scriptorium** with parallel bridges over deep chasms, staggered timber stacks & hinged secret vaults | **True Concentric Coiling Spirals & Radial Pinwheels** winding around **visible central bullseye shrines** on every floor |
| **Visual Palette (`0x72` Atlas)** | Crimson `[1,2]` + Sapphire `[2,2]` banners, white skull columns | Emerald `[1,3]` + Amber `[2,3]` archive standards, wooden book-stacks `[18,25..26]`, sapphire ink fountains `[4..6,3..4]` | **Molten-Amber Fire Braziers (`[4..6,1..2]`)**, **Gold Reliquary Standards (`[2,3]`)**, **Carved Spiral Steps (`[5,12]`)**, **Dormant Iron Grate Fore-Telegraphs (`[1..2,12]`)**, **Iron Mechanisms (`[5..6,13]`)** |
| **Primary Gameplay Experience** | Pure melee pack kiting + north/south risk-reward fork choice | Ranged sightline breaking on solid cover stacks + **4-of-5** optional vault sigil routing | **Processional spiral progression (`4/4` required sigils)** with **early landmark visibility, rhythmic grate-telegraphed trap gates, radial return spokes, and elite rotational pins** |

---

## 3. ASCII Floor Footprint (`116 × 100` Grid, Zero Inter-Floor Camera Bleed)

```text
FLOOR 1 (y = 2..29, W -> E): GREAT DOUBLE-HELIX RELIQUARY SPIRAL -> SPIRAL RELEASE SANCTUM
                       +================ North Clockwise Coil (Rhythmic Gates 1-2) ================+
                       |                                                                           |
  [Spawn Sanctuary] ===+   +---------- Inner Coil (Gate 3) ----------+                             v
    (11,15)            |   |    [CENTRAL SHRINE: l4_sigil_spiral]    |==[Spoke Return Cut]==> [Camp 1 Release]
                       |   +-----------------------------------------+     (saves 28t!)       4 Skel + 1 Reaper
                       +=== South Treasure Coil [l4_chest_spiral 420pt] ===========================+  Sigil #2 + Door F1->F2

FLOOR 2 (y = 41..65, W -> E): ELITE PIN COUNTER-COIL -> THREE-RING BULLSEYE PINWHEEL (`mid`)
  [Safe Breather]     +--- Outer Ring ---+        +============== Outer Pinwheel Ring [Chest 460pt] ==============+
  Door(9,52)->CP      | [l4_camp_2_pin]  |=======>|  +----------- Middle Coil (Grate-Telegraphed Gates) --------+ |
                      | 3 Skel + 2 Reap  |        |  |   [BULLSEYE HEART: door_l4_f2_f3_down(91,53)]            | |
                      | + Sigil #3       |        |  +----------------------------------------------------------+ |
                      +------------------+        +===============================================================+

FLOOR 3 (y = 77..98, W -> E): BROKEN-CROSS RADIAL CLIMAX -> CEREMONIAL HALF-SPIRAL EXIT (`end`)
  [Safe Breather]     +------ North Radial Arm (Reaper02 Diagonal) ------+       +=== Ceremonial Spiral Ring ===+
  Door(9,88)->CP ====>|  West Spoke === [Consecrated Altar Core] === East|======>|  [Molten Core] => Exit(101,88)|
                      +------ South Radial Arm (Reaper01 Diagonal) ------+       +==============================+
                                                             Sigil #4 (81,88)
```

---

## 4. Target Spiral Loops, Landmark Sightlines & Trap Rhythm

| Floor | Long-Range Landmark Read | Rhythmic Trap & Recovery Cadence (`21` Total `spikes`) | Loop / Shortcut Payoff |
|---|---|---|---|
| **Floor 1** | Stepping onto the West Spiral Mouth `(25, 15)` frames **`l4_sigil_spiral` `(45, 16)` glowing right inside the Central Shrine `20 tiles` ahead** across concentric stone rings. | **3 rhythmic grate-framed gates** (`[1, 12]` iron plates fore-telegraph live spikes by `2 tiles`) separated by `10-tile` safe breather pockets before releasing into `l4_camp_1_spiral_release`. | After spiralling inward to claim `l4_sigil_spiral`, an **East Sanctum Spoke Cut** exits straight toward Camp 1 in **`14 tiles` instead of `42 tiles`**, eliminating backtracking slog. |
| **Floor 2** | Entering `l4_f2_relay_ring` (`mid`) frames **all three concentric spiral coils + `door_l4_f2_f3_down` `(91, 53)` at the dead bullseye center of the `1280×720` screen**. | **`l4_camp_2_elite_pin`** tests rotational movement around an octagonal reliquary core (`3` skeletons + `2` cross-firing Reapers), followed by **3 rhythmic pinwheel timing gates** into the central stairwell. | Outer NE coil rewards **`l4_chest_pinwheel` (`460 pts`)** before spiralling directly into the inner stairwell with zero dead-end turnaround. |
| **Floor 3** | Crossing from `l4_f3_landing` reveals the **Broken-Cross Central Altar**, **`l4_sigil_camp_3` `(81, 88)`**, and the **Molten Reliquary Exit Ring** along one continuous processional axis. | **Broken-Cross Pin (`3` skeletons + `2` diagonal Reapers)** uses radial stone buttresses for Layer-1 Reaper disc cover, ending in a ceremonial half-coil procession around the molten shrine to **`l4_exit` `(101, 88)`**. | Circular outer ring + four cardinal spokes allow continuous clockwise/counter-clockwise rotation to break twin Reaper crossfire. |

---

## 5. Preserved Immutable Contracts & Pacing Target

- **Preserved Contracts (Zero Drift):**
  - Grid `116 × 100` (`>= 12-tile` inter-floor void + crisp `3`-column black abyss channels separating all concentric spiral coils), `camera_bounds = [0, 0, 1856, 1600]`, `required_sigils = 4` (`4/4` required sigils), **`density_cadence_anchor` strictly omitted** (`null` contract in `tests/chapter_1_map_design_test.gd`).
  - Final footprint metrics: **`4,008` `Backdrop` floor cells** (`[1292, 1310, 1406]` vs `4,582` hollow rectangle baseline — `-12.5%` bloat converted into crisp concentric spiral architecture), **`1,825` `Geometry` cells**, **`56` `Decor` cells**, **`3,454 / 3,454` (`100.0%`) non-spike capsule-clear cells reachable**, `Baseline sym_diff = 5,432` (`Jaccard = 0.225`), `Min diff vs other 9 maps = 3,010`.
  - All **74 original entity IDs** preserved with exact types (`1` `player`, `10` `skeleton`, `5` `skeleton_reaper`, `4` reciprocal `floor_door`, `4` `sigil`, `2` `checkpoint`, `2` `chest` `[420, 460]`, `21` `spikes`, `1` `exit_gate`, `12` `torch`, `12` `coin`) + authored molten braziers & coil breadcrumbs (`l4_torch_13..24`, `l4_coin_13..20` = **94 total entities**).
  - All **9 room IDs**, **3 `combat_camps` IDs & enemy memberships**, **3 `safe_zones`**, and **`l4_full_spiral_commitment` special zone** preserved.
- **Measured Capsule-Safe Runtime Window (`118 px/s = 7.375 tiles/s` live Knight move speed):**
  - Floor 1 Spiral Commitment Proof: bypassing the inner coil would take `100.6 tiles` (`13.6s`), whereas winding all three concentric turns into the visible Central Bullseye Shrine (`l4_sigil_spiral` at `(49, 13)`) and releasing into `l4_sigil_camp_1` takes **`188.0 tiles` (`3,008 px`, `25.5s`)** — genuine multi-turn spiral traversal with zero backtracking slog.
  - Pure continuous safe walk across all 3 spirals (`4/4` required sigils): **`446.5 tiles` (`7,144 px`, `60.5s`)** critical path (`+both optional chests`: `502.9 tiles`, `68.2s`).
  - Full combat + rhythmic trap clear (`10` skeletons + `5` elite Reapers + `21` grate-telegraphed spikes + `4/4` sigils + `2` chests): **`~135–195 seconds` (`2.2–3.2 minutes`)**.

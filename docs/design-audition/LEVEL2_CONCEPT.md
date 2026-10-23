# Level 2 Design Concept — *Ngã Ba Cốt Trắng* (Ossuary Fork)

- **Target Level:** `data/levels/chapter_1_level_2.json` (`chapter_1_level_2`, Stage 2)
- **Pinned Audition Baseline:** `1c21a49c2eb3775c4b421dab86d057c7256f5964` (`112 × 80` tiles, `4,460` floor cells)
- **Implemented Canvas & Scale:** `120 × 97` tiles (`1920 × 1552` px, `tile_size = 16`, `movement_mode = "top_down"`), engineered specifically for the live `640 × 360` world-space viewport (`40.0 × 22.5` tiles upscaled `2×` to `1280 × 720`, `camera_bounds = [0, 0, 1760, 1552]`) with `11`-tile vertical obsidian void buffers (`y = 26..37` and `y = 61..71`) eliminating all cross-floor camera bleed.
- **Core Spatial Thesis:** Transform *Ngã Ba Cốt Trắng* from three stacked left-to-right rectangular boxes into a **three-story cathedral ossuary switchback descent** (`West → East` on Floor 1, `East → Radial Crucible → West` on Floor 2, `West → Dual Nave Convergence → East Sanctum` on Floor 3) where **every route split changes geometry, sightlines, cover density, hazard interaction, and approach angle into combat**.

---

## 1. Critique of the Pinned Baseline (`1c21a49c`)

Inspecting `data/levels/chapter_1_level_2.json` alongside real `640 × 360` camera framing reveals four structural weaknesses in the procedural baseline:

1. **Repeated Three-Floor Formula (`Left Box → Central Box → Right Box`):**
   Every floor repeats the exact same west-to-east caterpillar silhouette (`x = 4..107` on Floor 1, `x = 4..108` on Floor 2, `x = 4..107` on Floor 3), with arbitrary cross-map teleports jumping `> 1,500 px` diagonally backward from east exit (`x = 103`) to west entry (`x = 9`) at each transition.
2. **Cosmetic, Mirror-Cloned Branching on Floor 1:**
   `l2_f1_north_reliquary` (`[64, 3, 18, 13]`) and `l2_f1_south_reliquary` (`[64, 18, 18, 11]`) are **mirrored rectangular boxes** connected by 4-tile straight tubes. Neither route changes sightlines, pillar cover, enemy engagement angle, or downstream position.
3. **Camera-Blind Landmark & Encounter Framing (`40 × 22.5` Tiles):**
   - At `spawn` (`[136, 200]`), the player stands inside an empty `16 × 12` grey box; the eponymous "fork" lies `22+` tiles east, completely off-screen.
   - Because inter-floor gaps are only `4–5` tiles (`y = 26..30` and `y = 53..59`) while camera height is `22.5` tiles, walking along Floor 1's lower branch or Floor 2's upper wing exposes disembodied wall strips from adjacent floors floating in black void.
   - Every room uses a 1-tile `source: 1` low-wall outline, uniform floor noise, and zero freestanding columns or gargoyle shrines—producing flat rectangles devoid of ossuary identity.
4. **Disconnected End-Arena Pacing:**
   Floor 3 separates `l2_f3_gauntlet` (`x = 34..76`) from `l2_f3_exit` (`x = 86..107`) across a barren `10`-tile hallway, turning the finale into cleanup followed by an empty walk.

---

## 2. Three-Floor Switchback Architecture & Annotated Traversal Graph

To abolish the repeated `left → center → right` formula, the three floors form a **vertically coherent 3D cathedral descent** whose macro-orientation alternates on every floor so stairs align physically in world space (`East Stair` connects F1 East `(75,14)` to F2 East `(85,50)`; `West Stair` connects F2 West `(25,51)` to F3 West `(23,84)`):

```text
====================================================================================================
FLOOR 1 — TIỀN ĐƯỜNG PHÂN CỐT (The Ossuary Narthex & White-Bone Bifurcation)   [Flow: WEST ──▶ EAST]
y = 4..26 (23 tiles high) | Focal Landmark: Đài Phân Cốt (Central Bone-Pylon & Twin Gargoyle Basins)
====================================================================================================

                                  ┌── [ROUTE A: CRIMSON VAULT BREACH — High Risk / High Reward] ──┐
                                  │  l2_f1_north_reliquary (Compact 7-tile vault, 4 neutral       │
                                  │  Spikes, Sigil #1 l2_sigil_choice_north, Chest #1 (+220),     │
                                  │  Sentry Skeleton #1; drops onto Watchpost Overlook (50,13))   │
 [SPAWN (15,15)]                  ▼                                                               ▼
 l2_f1_entry ──▶ [ĐÀI PHÂN CỐT] ──┼── Monumental Pylon (x=25..29, y=14..18)           l2_f1_convergence
 (Safe Narthex,   (Visible on     │   Crimson Blood-Basin (N) vs Azure Spirit-Basin (S)  (Shield-Wall Apse,
  Sealed Gate)     Frame 0!)      ▼                                                       Camp 1 + [DOOR]
                                  └── [ROUTE B: SAPPHIRE CLOISTER — Exploratory Flank] ┘  door_l2_f1_f2_down
                                     l2_f1_south_reliquary (Wide colonnade, 3-tile columns,    (75,14))
                                     Ossilegium coin alcove, 1v1 Vanguard pull, clean S-flank)    │
                                                                                                  │
            (11-tile pure obsidian camera buffer y = 27..37 — ZERO cross-floor bleed)             │
                                                                                                  ▼
====================================================================================================
FLOOR 2 — HUYỆT ĐÀI TRẦM CỐT (The Sunken Crucible Rotunda & Sanctuary Cloister) [Flow: EAST ──▶ WEST]
y = 38..60 (23 tiles high) | Focal Landmark: Huyệt Đài Trầm Cốt (Octagonal Rotunda & Bone Island)
====================================================================================================

              ┌── [EXPLORATORY SANCTUARY BYPASS — Safe Recovery + Checkpoint + Sigil #2] ─────────┐
              │  l2_f2_north_cache (Combat-free Azure Sanctuary, l2_checkpoint_floor_2,           │
              │  Sigil #2 l2_sigil_choice_south, dual high-ground drop-stairs into Rotunda)       │
              ▼                                                                                   │
 [DOOR F2→F3] l2_f2_convergence ◀── [HUYỆT ĐÀI TRẦM CỐT: l2_f2_ring (MID CAPTURE)] ◀─── l2_f2_landing
 door_l2_f2_f3_down  (West Stair     Octagonal Sunken Crucible + Bone Island + 4 Columns  door_l2_f1_f2_up
   (25,51)            Crypt)         Camp 2 (5 Skeletons), 4 ring Spikes, l2_sigil_ring     (85,50)
      │              ▲                                                                            │
      │              └── [DIRECT CATACOMB CUT — Fast High-Pressure Vault Slalom] ─────────────────┘
      │                 l2_f2_south_cache (Compact southern ossuary gallery, 2 spikes, coin cache)
      │
      │     (11-tile pure obsidian camera buffer y = 61..71 — ZERO cross-floor bleed)
      ▼
====================================================================================================
FLOOR 3 — THÁNH ĐƯỜNG HỘI CỐT (The Grand Convergence Cathedral & Exit Sanctum)  [Flow: WEST ──▶ EAST]
y = 72..95 (24 tiles high) | Focal Landmark: Khải Hoàn Môn Cốt Trắng (Twin-Column Triumphal Arch)
====================================================================================================

              ┌── [NORTHERN CHASM-BRIDGE SLALOM — Aggressive Direct Breach] ──┐
 [DOOR F3→F2] │  Elevated north nave lane, 2 neutral spikes leading to Camp 3 │
 door_l2_f2_f3_up                                                             ▼
   (23,84) ───┴─▶ [CONVERGENCE NAVE ARENA: l2_f3_gauntlet] ══▶ [TRIUMPHAL ARCH] ══▶ [EXIT SANCTUM: l2_f3_exit]
 l2_f3_landing     Cross-vaulted climax, Camp 3 (5 Skeletons),  Unites Crimson &     (END CAPTURE: frames live
 (Checkpoint #2)   3 cathedral Spikes, Sigil #4 l2_sigil_gauntlet Sapphire Banners    Camp 3 + Spikes + Sigil #4
              ▲                                                                      + Chest #2 + l2_exit Gate!)
              └── [SOUTHERN RELIQUARY TRANSEPT — Exploratory Vault Flank] ────┘
                 Wide south gallery leading to Vault Apse Chest #2 l2_chest_gauntlet (+280)
```

---

## 3. Route Decisions & Expected Player Behavior

### Decision 1 (Floor 1, `x = 21..29`, Visible Immediately on Frame 0 at `spawn`)
Right from `player_spawn` (`(15, 15)`), the central **White-Bone Bifurcation Monument (`Đài Phân Cốt`)** blocks direct center movement and frames **two visually contrasting worlds within the starting `40 × 22.5` camera view**:

| Attribute | Route A — *Huyết Lộ Xương Trắng* (`l2_f1_north_reliquary`) | Route B — *Hành Lang Tĩnh Cốt* (`l2_f1_south_reliquary`) |
|---|---|---|
| **Visual Signposting** | Crimson banners (`[1,2]`), flowing Crimson Gargoyle Blood-Basin (`[4..6, 0..2]`), smooth processional avenue, visible spikes, violet sigil, sentry & silver chest on Frame 0 | Sapphire/Amber banners (`[2,2]`, `[2,3]`), flowing Azure Spirit-Basin (`[4..6, 3..4]`), freestanding 3-tile columns, wide open arcade |
| **Corridor / Room Geometry** | Compact **7-tile-high vault gallery** (`63` tiles spawn-to-door path) | Expansive **L-shaped colonnaded gallery** with cover columns (`71` tiles spawn-to-door path) |
| **Hazard & Combat Profile** | **High Risk:** 4 neutral `spikes` surrounded by `3×3` floor islands, guarded by `l2_c1_skeleton_01` | **Tactical Control:** Zero entry traps; wide 360° kiting lanes around columns against lone vanguard `l2_c1_skeleton_02` |
| **Tangible Payoff** | **Sigil #1 (`l2_sigil_choice_north`)** + **Chest #1 (`l2_chest_risky_branch`, +220 score)** + 4 coins + **high-ground drop onto Watchpost `(50,13)`** | Safe 1v1 pull cadence + **Ossilegium Coin Alcove** + wide southern flanking sightline into `l2_f1_convergence` |

### Decision 2 (Floor 2, `x = 74..85`, East Overlook Threshold)
Emerging at `door_l2_f1_f2_up` (`(85, 50)`), players choose between **immediate central/southern pressure** vs. **northern sanctuary preparation & high-ground flanking**:

1. **Direct Crucible Cut (`l2_f2_landing → l2_f2_ring → l2_f2_south_cache → l2_f2_convergence`, `63` tiles):**
   Charges directly west into the **Octagonal Sunken Crucible Rotunda (`l2_f2_ring`)** where `l2_camp_2_ring_pressure` surrounds **Sigil #3 (`l2_sigil_ring`)** around a central Bone Reliquary Island, 4 freestanding columns, and 4 neutral ring spikes, before cutting through the southern catacomb vault (`2` spikes + bonus coins) to `door_l2_f2_f3_down` (`(25, 51)`).
2. **Sanctuary Cloister Bypass (`l2_f2_landing → l2_f2_north_cache → l2_f2_ring → l2_f2_convergence`, `95` tiles):**
   Detours north into the calm, combat-free **Azure Sanctuary (`l2_f2_north_cache`)** to activate **Checkpoint #1 (`l2_checkpoint_floor_2`)** beneath the Azure Gargoyle Fountain and claim **Sigil #2 (`l2_sigil_choice_south`)**, then drops down either flanking stair into the Rotunda to engage the pack on advantageous terms.

### Convergence Payoff (Floor 3, `x = 19..105`)
Landing at `door_l2_f2_f3_up` (`(23, 84)`) beside **Checkpoint #2 (`l2_checkpoint_floor_3`)**, players choose between the **Northern Chasm-Bridge Slalom** (`80` tiles to `l2_exit`) and the **Southern Reliquary Transept** (`90` tiles via **Chest #2 `l2_chest_gauntlet`, +280 score**) before both lanes **recombine inside the Cross-Vaulted Convergence Cathedral (`l2_f3_gauntlet` + `l2_f3_exit`)**, where **Sigil #4 (`l2_sigil_gauntlet`)** and the **Raised Exit Sanctum (`l2_exit` at `(96, 81)`)** align along a continuous ceremonial axis flanked symmetrically by **twin Azure & Crimson Gargoyle Fountains**.

---

## 4. Combat, Pressure & Rest Pacing Plan (`90–180s` Target Window)

Grounded in live `config/gameplay_tuning.json` physics (`move_speed = 112.0 px/s = 7.0 tiles/s`, `dash = 265 px/s × 0.18s` every `2.0s` → `~126 px/s` sprint) and Stage 2 encounter population (`15` authored `skeleton` + runtime `EncounterPackRules` bonus scouts including `density_cadence_anchor` at `(50, 13)`):

| Beat | Floor / Room | Intensity | Spatial Role & Pacing Hypothesis |
|---|---|---|---|
| **1. Orientation & Choice** | F1 `l2_f1_entry` + `l2_f1_fork` | **Calm (0%)** | `3–5s` safe read of the White-Bone Monument, Crimson vs. Sapphire signposting, visible spikes, sigil, sentry, and chest. |
| **2. Branch Execution** | F1 `l2_f1_north_reliquary` *or* `l2_f1_south_reliquary` | **Medium–High (65%)** *or* **Measured (40%)** | `10–18s`: either high-focus spike dodging/baiting + Vault Chest + Sigil #1 (North) or wide column kiting + Ossilegium coins (South). |
| **3. First Pack Convergence** | F1 `l2_f1_convergence` | **High (80%)** | `18–26s`: remaining Camp 1 Skeletons + live `density_cadence_anchor` Scout at `(50,13)` in columned apse; `3s` breath at East Stair (`door_l2_f1_f2_down`). |
| **4. Overlook Choice & Sanctuary** | F2 `l2_f2_landing` + `l2_f2_north_cache` | **Calm Recovery (10%)** | `4–12s` decompression beat: `l2_checkpoint_floor_2`, `l2_sigil_choice_south`, sightline scouting across balustrade into the Rotunda. |
| **5. Sunken Crucible Payoff** | F2 `l2_f2_ring` + `l2_f2_south_cache` + `l2_f2_convergence` | **Peak Mid-Level (85%)** | `24–36s`: Camp 2 Skeletons around the 4-column Bone Island + neutral spikes + `l2_sigil_ring`, followed by West Stair transition (`door_l2_f2_f3_down`). |
| **6. Pre-Climax Breath** | F3 `l2_f3_landing` | **Calm Recovery (10%)** | `4–6s` safe sanctuary landing with `l2_checkpoint_floor_3` and dual nave split preview. |
| **7. Grand Convergence Finale** | F3 `l2_f3_gauntlet` + `l2_f3_exit` | **Climax (95%) → Triumph (0%)** | `26–40s`: Camp 3 Skeletons across cross-vaulted columns + neutral spikes + `l2_chest_gauntlet` + `l2_sigil_gauntlet`, culminating through the Triumphal Arch at `l2_exit`. |

- **Projected Total Playthrough Hypothesis:**
  - *Aggressive Direct Route:* **`~94–118s`** (`206` tiles navigation = `3,296 px` = `~26–29s` pure travel + `~68–89s` combat/traps/loot).
  - *Tactical Flank Route:* **`~122–154s`** (`256` tiles navigation = `4,096 px` = `~33–37s` pure travel + `~89–117s` methodical pulls/sanctuary).
  - *100% Completionist Sweep:* **`~150–178s`** (`~312` tiles total including secondary branch sweep), squarely inside the **90–180s** target window.

---

## 5. Visual Identity & Real Asset Palette (Zero Custom Textures)

1. **9-Slice Perimeter Framing (`source: 1`) + 2-Row Interior Masonry Facades (`source: 0`, `Geometry`):**
   - Outer room perimeters use exact 9-slice autotiling (`atlas_walls_low.png` `[1..3, 0..2]`) for seamless mitered corners and crisp south cornices.
   - Interior north walls use 2-row `dungeon_tileset_ii.png` stone courses (`[1..3, 1]` coping over `[3, 2]` brick), eliminating double-cornice artifacts while supporting full-height wall landmarks.
2. **Seamless Multi-Tile Architectural Assemblies (`Geometry` + `Decor`):**
   - **Freestanding 3-Tile Columns:** Walkable `[5|6, 5]` capital above + solid `[3, 2]`/`[5|6, 6]` shaft center + walkable `[5|6, 7]` base below.
   - **3×3 Flowing Gargoyle Fountains:** `[4..6, 0..2]` (Crimson) and `[4..6, 0, 3..4]` (Azure) placed entirely in solid `Geometry`.
   - **Crypt Stair Archways & Heraldic Banners:** `[2..3, 15..16]` sealed gates, `[5..6, 15..16]` open stairwell arches over `[5, 12]` steps & `[3, 6]` hatches, plus Crimson (`[1, 2]`), Sapphire (`[2, 2]`), and Amber (`[2, 3]`) banners and skull grates (`[1..2, 12]`).
3. **100% Opaque High-Contrast Floor Paving (`Backdrop`):**
   - Smooth polished processional flagstones (`[1, 4]`) contrast against weathered antique slate (`[2..3, 4]`, `[1..3, 5]`, `[1..2, 6]`), while every `32 × 32` `scale = 2` `spikes` entity sits inside a full `3 × 3` pure-floor island so spikes never clip walls.

---

## 6. Legacy Objective Risks & Hard Compatibility Guarantees

| Potential Integration Risk | Mitigation & Exact Verification Contract |
|---|---|
| Missing/altered original entity IDs or types (`64` entities) | Preserve **all 64 baseline IDs and exact types** verbatim; document the `20` added ambient/breadcrumb entities (`l2_torch_11..22`, `l2_coin_11..18`) explicitly. |
| Hidden live spawn at `metadata.density_cadence_anchor` (`[808, 216]`) | Keep `density_cadence_anchor = [808, 216]` (`(50, 13)`) verbatim inside the open **Watchpost Overlook** with `>= 4` clear cardinal tiles. |
| Visual capture room targeting (`l2_f2_ring`, `l2_f3_exit`) & HUD safe zones | `chapter_1_campaign_level_visual_capture.gd` centers `mid` on `l2_f2_ring` and `end` on `l2_f3_exit`; all key props, fountains, chests, sigils, and `l2_exit` sit cleanly outside all 5 HUD panels. |
| `Knight` `BodyShape` (`12 × 16` at `(0, -8)`) & `Spikes` fairness | All `2,559 / 2,559` non-spike `collision_clear` cells are spike-free reachable (`0` unreachable cells), and all `15 / 15` spikes have `4 / 4` safe cardinal neighbors inside `3 × 3` floor islands. |
| Generator overwrite drift | `tools/generators/level_2_ossuary_fork_builder.gd` + `tools/generators/generate_chapter_1_levels_2_to_5.gd` regenerate `data/levels/chapter_1_level_2.json` with **0 byte diff** across Levels 1–5 (verified in CI). |

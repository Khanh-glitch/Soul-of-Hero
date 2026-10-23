# Chapter 1 Level 3 Design Brief — *Crossfire Archive* (`chapter_1_level_3.json`)

## 1. Architectural Concept: A Damaged Monastic Scroll Archive

Level 3 (*Crossfire Archive*) reads immediately as a **subterranean monastic archive and scriptorium** that has been breached through its masonry vaults — distinct in plan, tile grammar, prop vocabulary, and lighting from both Level 2 (*Ossuary Fork*) and Level 4 (*Spiral Reliquary*):

- **Purposeful Archival Storage (`armaria` Scroll Stacks):** Built from `14` structural `2`-row stone `armaria` bays (`[1, 10, 0]` horizontal stone cap over `[0, 1..2, 12]` scroll cubby alcoves flanked by solid brick piers), forming real reading aisles and solid projectile cover against `SkeletonReaper` `SpectralDisc` volleys.
- **Breached Masonry Vaults (`l3_vault_f1`, `l3_vault_f2`):** Framed in exterior north walls using complete `4×3` carved stone ironbound portal arches (`[2..3, 14] + [1..4, 15..16]`) behind breached masonry thresholds with collapsed rubble (`[5..6, 13]`) on the floor — reading honestly as sealed inner archive vaults whose outer antechambers were forced open.
- **Structural Chasm Bridges & Pilaster Halls:** Twin stone bridges span the Floor 1 and Floor 2 archive chasms using dual-box `0x72` masonry (`columns 1..3` hollow outer shells vs `columns 8..11` + `[4, 3]`/`[7, 3]` `256/256`-opaque solid stone piers), eliminating all vertical pillar-tooth caps and internal alpha slits.
- **Recessed Stairwell Portals & North Exit Sanctuary:** All four `FloorDoor` transitions sit directly beneath `4×3` carved dark-stone stairwell arches over dark `[5, 12]` threshold slabs, and `l3_exit` sits flush inside a `5`-wide recessed North Sanctuary Wall flanked by full `3`-part carved columns (`[5..6, 5] + [6, 6] + [5, 7]` plinths) and warm torches.

## 2. Preserved Gameplay & Entity Contract (`100%` Immutable IDs)

- **Dimensions:** `120 × 96` (`16px` tiles), `3` isolated physical floor components (`Floor 1`, `Floor 2`, `Floor 3`).
- **Live `Knight/BodyShape` Physics Reachability:** **`2,853 / 2,853` safe walkable floor cells reachable** (`0` dead pockets), `14/14` route targets verified.
- **Immutable Entities Preserved (`79` total — `100%` original IDs, types, camps, and rewards intact):**
  - `1` `player` (`(14, 8)`), `4` bidirectional `floor_door`s, `2` `checkpoint`s, `1` `exit_gate` (`l3_exit` at `(107, 81)`).
  - `21` enemies across `3` combat camps (`l3_camp_1_far_anchors`, `l3_camp_2_split_reapers`, `l3_camp_3_ gauntlet` — `15` `skeleton`s + `6` `skeleton_reaper`s).
  - `18` `spikes` hazards (`≥ 2` safe adjacent tiles and `≥ 3`-row corridor clearance throughout).
  - `2` `chest`s (`score_reward = 400` and `450`), `4` required `sigil`s, `13` coins, and `13` disciplined scriptorium torches.

## 3. Native `1280×720` Visual Proof

- Full `2×` identical-scale forensic close-ups: [`images/forensic_before_after_zoom_l3.png`](images/forensic_before_after_zoom_l3.png)
- Native `1280×720` `spawn` / `mid` / `end` side-by-side board: [`images/level3_godot47_side_by_side.png`](images/level3_godot47_side_by_side.png)
- Validated `1280×720` captures: [`captures/after_l3_spawn.png`](captures/after_l3_spawn.png), [`captures/after_l3_vault.png`](captures/after_l3_vault.png) (`(49, 10)`), [`captures/after_l3_combat.png`](captures/after_l3_combat.png) (`(91, 16)`), [`captures/after_l3_mid.png`](captures/after_l3_mid.png), [`captures/after_l3_end.png`](captures/after_l3_end.png).

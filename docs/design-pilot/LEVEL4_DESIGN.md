# Chapter 1 Level 4 Design Brief — *Spiral Reliquary* (`chapter_1_level_4.json`)

## 1. Architectural Concept: Three-Stage Ritual Procession

Level 4 (*Spiral Reliquary*) is authored as a **deliberate three-stage ceremonial procession** that escalates in architectural formality, warmth, sacred ornament, and combat pressure from perimeter to sanctum — eliminating mechanical motif repetition around every turn:

1. **Stage I — Austere Outer Pilgrim Coils (`Floor 1` Perimeter, `Floor 2/3` Landings):** Dark, severe stone channels with `0` banners, minimal threshold beacons, unbroken `[1, 8..11, 0]` horizontal stone parapets, and grounded `3`-part sanctum pilaster piers framing ritual switches and checkpoints.
2. **Stage II — Intermediate Counter-Coils & Ceremonial Trap Gates (`Floor 1` Counter-Coil, `Floor 2` Relay Ring):** Fore-telegraphed threshold `spikes` flanked by carved stone floor grates (`[0, 7, 4]`) and widened safe recovery pockets, replacing random floor clutter with readable hazard telegraphing.
3. **Stage III — Consecrated Inner Sanctums & Cathedral Exit Apse (`Spiral Core`, `Camp 1–3 Sanctums`, `l4_f3_exit`):** Warm golden beacon pools, crimson (`[0, 1, 2]`) and gold (`[0, 2, 3]`) standards reserved strictly for sanctum hearts (`13` total, down `-77%` from `56`), flush `3×3` molten fire braziers on exterior north walls (`6`), embedded dark-stone stairwell portals (`[5..6, 16]` under unbroken `[1, 10, 0]` sanctum roofs), and a projected **Consecrated North Cathedral Apse** enshrining `l4_exit` at `(104, 81)`.

## 2. Preserved Gameplay & Entity Contract (`100%` Immutable IDs)

- **Dimensions:** `120 × 100` (`16px` tiles), `3` isolated physical floor components (`Floor 1`, `Floor 2`, `Floor 3`).
- **Live `Knight/BodyShape` Physics Reachability:** **`3,409 / 3,409` safe walkable floor cells reachable** (`0` dead pockets), `13/13` route targets verified.
- **Immutable Entities Preserved (`76` total — `100%` original IDs, types, camps, and rewards intact):**
  - `1` `player` (`(11, 14)`), `4` bidirectional `floor_door`s, `2` `checkpoint`s, `1` `exit_gate` (`l4_exit` at `(104, 81)`).
  - `24` enemies across `3` combat camps (`l4_camp_1_spiral_release`, `l4_camp_2_elite_pin`, `l4_camp_3_broken_cross` — `10` camp `skeleton`s, `5` camp `skeleton_reaper`s, plus all original coil/gauntlet sentries).
  - `21` `spikes` hazards (`0` column/brazier/anchor overlaps), `2` `chest`s (`score_reward = 420` and `460`), `4` required `sigil`s, `1` `switch`, `12` coins, and `14` progressive ritual beacons.

## 3. Native `1280×720` Visual Proof

- Full `2×` identical-scale forensic close-ups: [`images/forensic_before_after_zoom_l4.png`](images/forensic_before_after_zoom_l4.png)
- Native `1280×720` `spawn` / `mid` / `end` side-by-side board: [`images/level4_godot47_side_by_side.png`](images/level4_godot47_side_by_side.png)
- Validated `1280×720` captures: [`captures/after_l4_spawn.png`](captures/after_l4_spawn.png), [`captures/after_l4_spiral.png`](captures/after_l4_spiral.png) (`(46, 13)`), [`captures/after_l4_combat.png`](captures/after_l4_combat.png) (`(50, 50)`), [`captures/after_l4_mid.png`](captures/after_l4_mid.png), [`captures/after_l4_end.png`](captures/after_l4_end.png).

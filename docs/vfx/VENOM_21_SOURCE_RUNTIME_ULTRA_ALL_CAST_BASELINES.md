# Venomwright Gold ULTRA — all 21 source-runtime baselines (not Godot acceptance)

Original user-provided archive SHA-256: `ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716`.
Executed original `World.step(1/60)` and each of the original `SKILL_BY_ID[1..21].run` functions **without changing their authored TS**, then `World.draw` into **two independent 1200×680 native Ultra RGBA8 buffers** (`k=2`) at three source ticks per skill. Source file `src/game/{world,pixel,fx,actors}.ts`, `src/game/skills/{s1,s2,s3,s4,index,lib}.ts` are unchanged. The original simulated player and three enemy actors are intentionally deterministic synthetic fixtures.

**This is only a canonical input baseline and proves no Godot port is complete.** It is also **pre-original-WebGL-post** and **does not draw the Gold floor**; never use it to mislabel a full Gold screenshot. Source frame and glow buffers are hashed with SHA-256. 21/21 authored source casts ran without runtime error across all three sampled ticks; the Godot game still has **0/21 fully playable skills accepted**.

Per-row mid-cast checkpoint below records native source tick, original active FX and particle counts, and 16 hex characters of the ORIGINAL **full** 64-digit whole RGBA scene SHA-256 for easy identification. Complete source SHA files remain in the source verification artifact; prefixes are **NOT** a sufficient final equality oracle. The real Gold original stage vs real Level2 matched visual gate remains mandatory, including dynamic enemy reaction, environmental aftermath, full shaders, 2K/4K, damage authority and performance.

| # | Gold skill | Tick | Source FX | Source particles | Whole-source RGBA SHA prefix |
|--:|---|--:|--:|--:|---|
| 01 | Glassfang Hunt | 150 | 34 | 77 | `e6dd375125135435` |
| 02 | Blooming Parasite | 240 | 48 | 173 | `2d26f42aff6335a7` |
| 03 | Leechwater Rush | 180 | 65 | 22 | `ec23586f14d398eb` |
| 04 | Porcelain Bastion | 360 | 6 | 26 | `eb2bc45c44ca7281` |
| 05 | Bellows Toad | 180 | 40 | 100 | `13938c47330d288b` |
| 06 | Graft Caravan | 240 | 66 | 96 | `cb44b03562b66497` |
| 07 | Hatchery Fall | 300 | 68 | 0 | `c4435ebc198a2b0d` |
| 08 | Brine Serpents | 240 | 36 | 0 | `26c179d392b2a767` |
| 09 | Molting Harvester | 270 | 47 | 95 | `24805b0e024a8535` |
| 10 | The Walking Crucible | 450 | 28 | 9 | `42e92d9e6f9b4b82` |
| 11 | Unsealed Catalyst | 120 | 10 | 54 | `c86178cc4a4ddb1b` |
| 12 | Verdigris Wake | 240 | 149 | 245 | `4a72490dcae2b56e` |
| 13 | Mercury Garden | 270 | 11 | 65 | `16ead1f9c7a6310f` |
| 14 | Reaction Cascade | 180 | 1 | 16 | `5b43df7587e15f21` |
| 15 | Breath of the Vat | 270 | 8 | 48 | `abe07f706ca6f324` |
| 16 | Crystal Rot | 210 | 36 | 183 | `cb4ee1f5785486e5` |
| 17 | Reverse Extraction | 210 | 14 | 109 | `5cd74142b5d2e574` |
| 18 | Bitter Rain | 270 | 14 | 108 | `7d8ecaccf85f30f6` |
| 19 | False Remedy | 210 | 9 | 86 | `9d5a71a26297bfdf` |
| 20 | Plague Cartography | 270 | 17 | 66 | `8f7c343a63907e1a` |
| 21 | The Last Distillation | 420 | 28 | 98 | `9751ee5b9fd944a2` |

### Shared original source physics port

A reusable GDScript component `prototypes/gold_pair/venom_source_particles_world.gd` now executes native source `Particles.add/update` rules: fixed 60Hz, drag, gravity, rotation, bubble expiry spark emission, droplet landing Splash, crystal shard Embed, bouncing, dead-swap array ordering and cleanup; it emits environment cues **without changing SOH enemy HP**.

[Native Godot CI 40651924815](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40651924815) PASS: eight independent checkpoints of the original 240-tick source physics fixture and landing aftermath. **No claim that every custom original Part.fn callback is ported**. Remaining authored particle kinds and custom callbacks must be ported and separately source-locked before full-game acceptance.

### Next full-skill path

Finish Glassfang as one unbroken, real 60Hz fully dynamic cast on Level2, including vial, all physical particles, enemy-bound corrode/crystal, ground FX, three pools with shared hit gating, collision floor mask, camera and shader. Gold-left vs Level2-right must be from real running Gold demo/native Godot at same tick, and show original Gold shader fidelity. Then apply source-coded engine and explicit acceptance to skill 02 through 21; group reports, no primitive-by-primitive messages. Preserve Gold Ultra image source semantics and optional smart map-only dim separately.

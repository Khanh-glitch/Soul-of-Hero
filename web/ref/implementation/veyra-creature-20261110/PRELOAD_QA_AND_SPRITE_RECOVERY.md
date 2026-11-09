# Source preload audit — 2026-11-10

The 13 original source files are preserved **byte-for-byte** and have independent SHA-256 checks matching the manifest. **Matching whole-file SHA does NOT prove each nested ZIP entry is readable.**

## Archive integrity results

- `VEYRA_FULL` / `veyra-world-art-upgrade (4).zip`: **0 invalid member(s)** — all members read OK.
- `ELDER_6` / `six-primordials-boss-lab (9).zip`: **0 invalid member(s)** — all members read OK.
- `VAMPIRE_1_3` / `craftpix-net-208004-free-vampire-4-direction-pixel-character-sprite-pack.zip`: **0 invalid member(s)** — all members read OK.
- `ORC_1_3` / `craftpix-net-363992-free-top-down-orc-game-character-pixel-art.zip`: **26 invalid member(s)** — use verified composite sheets below and intact source, avoid broken members.
- `SLIME_1_3` / `craftpix-net-788364-free-slime-mobs-pixel-art-top-down-sprite-pack.zip`: **57 invalid member(s)** — use verified composite sheets below and intact source, avoid broken members.
- `SAMURAI` / `EBros_Boss_Samurai.zip`: **0 invalid member(s)** — all members read OK.
- `ROCK` / `TopDown_RockBoss_EBrosAssets.zip`: **0 invalid member(s)** — all members read OK.
- `WATER` / `Water Warrior.zip`: **0 invalid member(s)** — all members read OK.
- `SCYTHE_CANDIDATE` / `craftpix-net-221601-free-enemy-pixel-pack-for-top-down-defense.zip`: **0 invalid member(s)** — all members read OK.
- `SWORDSMAN_RESERVE` / `craftpix-net-180537-free-swordsman-1-3-level-pixel-top-down-sprite-character.zip`: **0 invalid member(s)** — all members read OK.
- `WILDLIFE_5` / `craftpix-net-789196-free-top-down-hunt-animals-pixel-sprite-pack.zip`: **0 invalid member(s)** — all members read OK.

## Known broken members (root original source)

### ORC_1_3: 26

- `PNG/Orc3/With_shadow/orc3_attack_with_shadow.png` — Bad CRC-32 for file 'PNG/Orc3/With_shadow/orc3_attack_with_shadow.png'
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_attack_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_walk_attack_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_walk_attack_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_death_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_death_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_hurt_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_hurt_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_walk_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_walk_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_run_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_run_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/With_shadow/orc3_run_attack_with_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/With_shadow/._orc3_run_attack_with_shadow.png` — Bad magic number for file header
- `PNG/Orc3/Parts/orc3_run_attack_sword_back.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/Parts/._orc3_run_attack_sword_back.png` — Bad magic number for file header
- `PNG/Orc3/Parts/orc3_hurt_head.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/Parts/._orc3_hurt_head.png` — Bad magic number for file header
- `PNG/Orc3/Parts/orc3_run_attack_sword_front.png` — Bad magic number for file header
- `__MACOSX/PNG/Orc3/Parts/._orc3_run_attack_sword_front.png` — Bad magic number for file header
- `PNG/Orc3/Parts/orc3_run_sword_front.png` — Bad magic number for file header
- `PSD/Orc2/orc2_run.psd` — Bad CRC-32 for file 'PSD/Orc2/orc2_run.psd'
- `__MACOSX/PSD/Orc2/._orc2_run.psd` — Bad magic number for file header
- `PSD/Orc2/orc2_attack.psd` — Bad magic number for file header
- `__MACOSX/PSD/Orc2/._orc2_attack.psd` — Bad magic number for file header
- `PSD/Orc2/orc2_run_attack.psd` — Bad magic number for file header

### SLIME_1_3: 57

- `PNG/Slime2/Parts/Slime2_Attack_body.png` — Bad CRC-32 for file 'PNG/Slime2/Parts/Slime2_Attack_body.png'
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Attack_body.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Hurt_body.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Hurt_body.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Hurt.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Hurt.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Death_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Death_shadow.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Hurt_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Hurt_shadow.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Walk_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Walk_shadow.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Death_body.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Death_body.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Run_body.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Run_body.png` — Bad magic number for file header
- `PNG/Slime2/Parts/Slime2_Attack_shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Parts/._Slime2_Attack_shadow.png` — Bad magic number for file header
- `PNG/Slime1/Without_shadow/Shadows/Shadow_run.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime1/Without_shadow/Shadows/._Shadow_run.png` — Bad magic number for file header
- `PNG/Slime1/Without_shadow/Shadows/Shadow_slime1_attack.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime1/Without_shadow/Shadows/._Shadow_slime1_attack.png` — Bad magic number for file header
- `PNG/Slime1/Without_shadow/Shadows/Shadow_death.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime1/Without_shadow/Shadows/._Shadow_death.png` — Bad magic number for file header
- `PNG/Slime1/Without_shadow/Shadows/Shadow_walk.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime1/Without_shadow/Shadows/._Shadow_walk.png` — Bad magic number for file header
- `PNG/Slime1/Without_shadow/Shadows/Shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime1/Without_shadow/Shadows/._Shadow.png` — Bad magic number for file header
- `PNG/Slime3/Without_shadow/Shadows/Shadow_run.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime3/Without_shadow/Shadows/._Shadow_run.png` — Bad magic number for file header
- `PNG/Slime3/Without_shadow/Shadows/Shadow_death.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime3/Without_shadow/Shadows/._Shadow_death.png` — Bad magic number for file header
- `PNG/Slime3/Without_shadow/Shadows/Shadow_walk.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime3/Without_shadow/Shadows/._Shadow_walk.png` — Bad magic number for file header
- `PNG/Slime3/Without_shadow/Shadows/Shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime3/Without_shadow/Shadows/._Shadow.png` — Bad magic number for file header
- `PNG/Slime2/Without_shadow/Shadows/Shadow_run.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Without_shadow/Shadows/._Shadow_run.png` — Bad magic number for file header
- `PNG/Slime2/Without_shadow/Shadows/Shadow_death.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Without_shadow/Shadows/._Shadow_death.png` — Bad magic number for file header
- `PNG/Slime2/Without_shadow/Shadows/Shadow_walk.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Without_shadow/Shadows/._Shadow_walk.png` — Bad magic number for file header
- `PNG/Slime2/Without_shadow/Shadows/Shadow.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Without_shadow/Shadows/._Shadow.png` — Bad magic number for file header
- `PNG/Slime2/Without_shadow/Shadows/Shadow_attack_slime2.png` — Bad magic number for file header
- `__MACOSX/PNG/Slime2/Without_shadow/Shadows/._Shadow_attack_slime2.png` — Bad magic number for file header
- `__MACOSX/._PSD` — Bad magic number for file header
- `PSD/.DS_Store` — Bad magic number for file header
- `__MACOSX/PSD/._.DS_Store` — Bad magic number for file header
- `__MACOSX/PSD/._Slime1` — Bad magic number for file header
- `__MACOSX/PSD/._Slime3` — Bad magic number for file header
- `__MACOSX/PSD/._Slime2` — Bad magic number for file header
- `PSD/Slime1/Slime1_Walk.psd` — Bad magic number for file header
- `__MACOSX/PSD/Slime1/._Slime1_Walk.psd` — Bad magic number for file header
- `PSD/Slime1/Slime1_Run.psd` — Bad magic number for file header
- `__MACOSX/PSD/Slime1/._Slime1_Run.psd` — Bad magic number for file header
- `PSD/Slime1/Slime1_Attack.psd` — Bad magic number for file header

## Verified fallback PNGs: 60

`02_VERIFIED_SPRITES/` contains direct byte copies of verified, original, unshadowed composite PNG sheets, NOT recreated pixel art. Every PNG passed Pillow image verification and has original-member + SHA evidence in `00_HANDOFF/VERIFIED_SPRITES_MANIFEST.json`. These include all three Vampire, Orc, Slime species and the necessary movement/combat/death composites. Rebuild shadows using legal original shadow layer or in-engine lighting (not fake new source).

**Critical:** Use the original zip sources for source-of-truth/provenance; fallbacks are only a workaround for some unreadable ZIP local entries, not permission to discard sound animations, layers, or maps. The map and Elder ZIPs have zero internal ZIP entry errors in this review. If sprites beyond recovery are needed, prefer intact Aseprite originals or re-download through their verified Drive links.

## Scope and delivery

- The 13 original source files are in `01_ORIGINAL_SOURCE/`; no Mafia source is included.
- Future UI/UX/HUD Gold reference is deliberately **not included**, and its redesign is outside scope.
- Veyra and Elder final ZIPs originate from Creator chat uploads; neither has a verified standalone Drive URL. Supply THIS preload bundle directly to the Agent.
- The current source package by itself does not establish runtime integration, legality/redistribution rights, human playability, Godot pass or successful visual acceptance.

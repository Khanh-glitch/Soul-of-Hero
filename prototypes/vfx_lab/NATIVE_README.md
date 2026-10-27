# Native VFX Lab staging (2026-10-27)

Open `res://prototypes/vfx_lab/native_lab.tscn` with **Godot 4.7** and press **F6 (Play Current Scene)**.

Controls: 1/2/3 select K-Night #07 RV, Venomwright #16, Top-down Sword #01; Space pause/resume, Left/Right single 1/30s seek, +/- speed (0.25–4×), R reset, M moving enemy, C camera follow, WASD move caster, click retarget.

## What this proves (and what it does not)

- Scene presents three distinct native **behavioral approximations**, not final/fidelity-complete ports of the HTML originals: K-Night staged slash/ground split, Venomwright enemy-attached crystals, and Sword delayed rupture.
- Visual events are derived from the shared timeline `vfx_timeline.gd`; they do not call combat damage, mutate enemy HP, write tiles, save state or affect the campaign.
- Actor proxies are intentionally **not** the real Knight/Skeleton scenes. This stage tests pixel-space assumptions without coupling to the team's changing levels.
- It does **not** verify source-renderer parity, 2K/4K sharpness, real combat hit mapping, licensing, production frame timing or map clipping.
- The full five-source 155-entry audit and additional modular scene prototype are preserved in the existing `SOH_VFX_Lab_Gate0.zip` handoff. They have **not** all been copied into GitHub.
- No edits to game/, data/, assets/, levels/ or project.godot. Do not merge to main until scene runtime, image evidence, then actor/world adapter gates pass.

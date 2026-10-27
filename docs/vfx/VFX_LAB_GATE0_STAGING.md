# VFX Lab — Gate 0 staging

2026-10-27. Isolated from map production and from core gameplay.

This branch is a **staging branch**, not a native Godot-verified production port. The 5-bundle audit, full 155-row inventory and three pilot scene sources are delivered in the associated ChatGPT handoff archive `SOH_VFX_Lab_Gate0.zip`. Their source files are **not fully committed to this branch yet**; the branch currently contains the timeline / smoke skeleton. Avoid treating this as a ready-to-merge PR.

Source inventory: 21 Venomwright + 21 K-Night (RV only 7/8/17) + 72 ARCANA III + 21 Top-down Sword + 20 *planned/not implemented* ARCANA Fusion = 155 audit entries.

Native runtime verification is blocked in the authoring environment (Godot 4.7 executable unavailable). Archive integrity, inventory uniqueness and basic static checks passed. Do not claim scene visuals, frame rates or parity are verified.

The handoff ZIP contains an isolated Godot 4.7 test scene, input controls, timeline smoke, 155-row port matrix, SHA-256 provenance, design hazards, and a proposed CI workflow. Import the overlay at the root of an existing Soul-of-Hero checkout on this branch, then run its Godot smoke checks. No `game/`, `data/`, `assets/` or `project.godot` paths should be touched.

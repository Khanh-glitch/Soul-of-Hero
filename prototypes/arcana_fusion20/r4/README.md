# ARCANA Fusion20 — isolated R4 real-SOH-actor gate

This folder is an **additive, non-production** verification fixture for the Source-in-World R3→R4 handoff.

## Run

```bash
godot --headless --editor --path . --import --quit
godot --headless --path . --script res://prototypes/arcana_fusion20/r4/r4_native_headless_test.gd
```

The GitHub workflow `.github/workflows/arcana-fusion20-r4-native.yml` runs the same test in Godot 4.7.

## What the gate actually tests

- Instantiates SOH's existing `skeleton_enemy.tscn` without cloning it.
- Extracts the **current** atlas frame of its `AnimatedSprite2D` to PNG with original transparency and transform.
- Applies only explicitly test-authorized damage via SOH's `CombatDamage.apply_confirmed()`; captures `GameEvents.combat_hit_confirmed` synchronously.
- Rejects invalid, duplicate and post-mortem hit identities.
- Verifies the original enemy hurt/death states, second target, current animation frame and camera world-to-screen motion.

## What is NOT passed by this gate

- Original A source renderer is NOT ported to Godot; the bridge emits input data for it.
- Original B Furnace Wyrm / C Event Horizon renderers are not Godot-native yet. Their source-preserving web bridge is a separate R2/R3 deliverable.
- This fixture does NOT demonstrate source-Gold visual fidelity, world compositor fidelity or production acceptance.
- No production game scripts or save/economy code were modified.

Never merge until native CI is green and AVFX/A0/A7 owners approve the specific production integration.

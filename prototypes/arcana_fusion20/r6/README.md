# ARCANA #02 native B source pilot — single-skill scope

**Scope:** Keep original B authored source pixel buffers for #02 and test as a shader pass on actual `chapter1_overworld.tscn` with native SOH `SkeletonEnemy` and the real R4 `CombatDamage` gateway. No redrawn spells, demo-room floors, fake actors, or changes to Gold93.

**Start:** `res://prototypes/arcana_fusion20/r6/b02_soh_world.tscn` in Godot 4.7, or the CI workflow `arcana-b02-native-pilot.yml`.

**Native visual gate:** opening/peak/OUT screenshots must come from Godot 4.7 rendered source pass on the actual game world. `B02_RESULT PASS` shows scene/source-buffer availability ONLY; visual Gold parity requires independent frame comparison and human approval.

**Known blocker:** Original A on-body reaction renderer is not native-ported. R4 carries genuine SOH animated sprite frames and `combat_hit_confirmed` packets. This pilot does not claim #02 complete until original A fire/burn visuals work on SOH SkeletonEnemy and visual comparison is accepted.

**Source:** B original spell logic unchanged; source-authored native buffer bake at 30fps; no brightness keying. Atlas 3072 x 6264 consumes considerable VRAM. This is a pilot only, not a recommended production packing scheme.

Atlas B displacement channels are split losslessly into b_disp_x/y textures, rebuilding the original 16-bit XY values in the shader. No visual information is discarded by this split.

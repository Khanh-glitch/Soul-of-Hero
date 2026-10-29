class_name Venomwright05SourceNative
extends VenomwrightSourceModule

## Venomwright #05 — host-facing adapter over the source-native generator
## ported from the ORIGINAL `src/game/skills/s1.ts` / `s2.ts`. The whole
## authored cast runs through `venom_world` / `venom_engine`; this file only
## binds an original skill id to the shared adapter.


func _init() -> void:
	canonical_id = &"venomwright:005"
	family = &"venomwright"
	original_skill_id = 5

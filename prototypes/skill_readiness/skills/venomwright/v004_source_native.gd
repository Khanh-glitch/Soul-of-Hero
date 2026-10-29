class_name Venomwright04SourceNative
extends VenomwrightSourceModule

## Venomwright #04 — host-facing adapter over the source-native generator
## ported from the ORIGINAL `src/game/skills/s1.ts` / `s2.ts`. The whole
## authored cast runs through `venom_world` / `venom_engine`; this file only
## binds an original skill id to the shared adapter.


func _init() -> void:
	canonical_id = &"venomwright:04"
	family = &"venomwright"
	original_skill_id = 4

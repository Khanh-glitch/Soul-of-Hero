class_name Venomwright14SourceNative
extends VenomwrightSourceModule

## Venomwright #14 (Reaction Cascade) -- host-facing adapter over the SOURCE-NATIVE
## generator ported from the ORIGINAL authored TypeScript. The whole cast runs
## through `venom_world` / `venom_engine` via the shared `VenomwrightSourceModule`;
## this file only binds the original skill id. It adds no logic of its own.
## Verified against the original TypeScript in `parity/index.json`.


func _init() -> void:
	canonical_id = &"venomwright:014"
	family = &"venomwright"
	original_skill_id = 14

class_name Venomwright15SourceNative
extends VenomwrightSourceModule

## Venomwright #15 (Vat) -- host-facing adapter over the SOURCE-NATIVE
## generator ported from the ORIGINAL authored TypeScript. The whole cast runs
## through `venom_world` / `venom_engine` via the shared `VenomwrightSourceModule`;
## this file only binds the original skill id. It adds no logic of its own.
## Verified against the original TypeScript in `parity/index.json`.


func _init() -> void:
	canonical_id = &"venomwright:015"
	family = &"venomwright"
	original_skill_id = 15

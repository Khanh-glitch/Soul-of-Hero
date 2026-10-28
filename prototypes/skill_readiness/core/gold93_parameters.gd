class_name Gold93SkillParameters
extends RefCounted

## User-owned configuration envelope handed to every native Gold cast.
##
## HARD RULE: every GAMEPLAY slot stays `null` until the project owner supplies
## an approved value. The runtime must FAIL CLOSED (refuse to apply combat) and
## never synthesise damage, cooldown, mana, range, input binding or unlock rules.
##
## Presentation / technical slots (seed, clock, raster density, preview aids)
## are engine concerns, not balance decisions, so they carry neutral defaults.
## Any value a laboratory invents for preview is stamped `lab_only = true` and
## MUST NOT be presented as approved gameplay configuration.

## Slots that belong to combat design and therefore require user approval.
const GAMEPLAY_SLOTS: Array[String] = [
	"input_binding",
	"input_mode",
	"aim_policy",
	"target_policy",
	"mana_cost",
	"cooldown_seconds",
	"range",
	"damage",
	"stagger",
	"status_rules",
	"unlock_rules",
]

## -1 means "inherit the family's original authored value"; never guess.
var source_seed: int = -1
var source_hz: float = -1.0
var native_raster_density: int = -1

## Empty string means "derive from CastContext aim/drag/target data only".
var aim_policy: String = ""

## True when any value in this packet was produced by the LAB for preview.
var lab_only: bool = true

## Cosmetic-only knobs: backdrop readability aid, debug overlays, capture flags.
## These may never rewrite Gold FX pixels, hero/enemy art or the HUD.
var presentation: Dictionary = {
	"backdrop_readability_aid": false,
	"backdrop_dim": 0.0,
	"show_source_cursor_overlay": false,
	"capture_frames": false,
}

## User-approved combat rules. Empty until supplied by the owner.
var gameplay: Dictionary = {}

## Human readable provenance of the packet, recorded into cast evidence.
var provenance: String = "LAB_DIAGNOSTIC"


func _init(from_lab: bool = true) -> void:
	lab_only = from_lab
	provenance = "LAB_DIAGNOSTIC" if from_lab else "UNCONFIGURED"


static func diagnostic(family: String = "") -> Gold93SkillParameters:
	## Explicit TEST_ONLY packet. It renders a skill so it can be inspected;
	## it is never a balance decision and never production configuration.
	var p := Gold93SkillParameters.new(true)
	p.provenance = "TEST_ONLY_LAB_PREVIEW"
	if family == "venomwright":
		p.source_hz = 60.0
		p.native_raster_density = 2
	elif family == "arcana_iii":
		p.source_hz = 60.0
		p.native_raster_density = 2
	return p


func set_gameplay(patch: Dictionary, approved: bool) -> bool:
	## Rejects partial or unapproved gameplay packets so a native cast can never
	## silently fall back to invented combat numbers.
	if not approved:
		return false
	for slot in GAMEPLAY_SLOTS:
		if not patch.has(slot) or patch[slot] == null:
			return false
	gameplay = patch.duplicate(true)
	lab_only = false
	provenance = "USER_APPROVED"
	return true


func unconfigured_gameplay_slots() -> PackedStringArray:
	var missing := PackedStringArray()
	for slot in GAMEPLAY_SLOTS:
		if not gameplay.has(slot) or gameplay[slot] == null:
			missing.append(slot)
	return missing


func is_gameplay_configured() -> bool:
	return unconfigured_gameplay_slots().is_empty()


func resolved_source_hz(family_default: float) -> float:
	return family_default if source_hz <= 0.0 else source_hz


func resolved_density(family_default: int) -> int:
	return family_default if native_raster_density <= 0 else native_raster_density


func resolved_seed(context_seed: int) -> int:
	return context_seed if source_seed < 0 else source_seed


func clone() -> Gold93SkillParameters:
	var out := Gold93SkillParameters.new(lab_only)
	out.source_seed = source_seed
	out.source_hz = source_hz
	out.native_raster_density = native_raster_density
	out.aim_policy = aim_policy
	out.presentation = presentation.duplicate(true)
	out.gameplay = gameplay.duplicate(true)
	out.provenance = provenance
	return out


func to_diagnostic_row() -> Dictionary:
	return {
		"provenance": provenance,
		"lab_only": lab_only,
		"source_seed": source_seed,
		"source_hz": source_hz,
		"native_raster_density": native_raster_density,
		"aim_policy": aim_policy,
		"unconfigured_gameplay_slots": Array(unconfigured_gameplay_slots()),
		"gameplay_configured": is_gameplay_configured(),
	}

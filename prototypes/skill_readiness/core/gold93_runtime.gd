class_name Gold93SkillRuntime
extends RefCounted

## Entry point of the native Gold-93 library:
##     var handle = Gold93SkillRuntime.cast("venomwright:001", ctx, params)
##
## Design rule: the runtime NEVER fabricates a skill. If a canonical id has no
## module whose ORIGINAL authored generator is source-locked, `cast()` returns a
## BLOCKED handle carrying the precise reason. Registering 93 catalog rows must
## never be mistaken for 93 playable native spells.

const VENOM_FAMILY = preload("res://prototypes/skill_readiness/families/venom_family_runtime.gd")
const ARCANA_FAMILY = preload("res://prototypes/skill_readiness/families/arcana_family_runtime.gd")

## Only modules whose authored generator was actually ported from the original
## source may appear here. Adding an entry is a fidelity claim, not a TODO item.
const MODULE_PATHS: Dictionary = {
	"venomwright:001": "res://prototypes/skill_readiness/skills/venomwright/v001_glassfang_hunt.gd",
}

## Human-readable reason recorded for every id without a source-locked module.
## This is a real material blocker: the original ZIP bytes are stored in neither
## this repository nor this execution environment, so the authored generators
## cannot be re-derived without inventing algorithms.
const DEFAULT_BLOCKER: String = ("ORIGINAL_SOURCE_ARCHIVE_UNAVAILABLE: the "
	+ "original Gold ZIP bytes are not present in this repository or execution "
	+ "environment, so this skill's authored generator cannot be source-locked. "
	+ "Infrastructure, ports, lifecycle and acceptance harness are ready; supply "
	+ "the pinned original archive to add the module without porting again.")

var catalog
var _families: Dictionary = {}
var _overrides: Dictionary = {}
var _blockers: Dictionary = {}


func _init(catalog_instance = null) -> void:
	catalog = catalog_instance
	if catalog == null:
		catalog = load("res://prototypes/skill_readiness/core/gold_skill_catalog.gd").new()


func family_runtime(family: String) -> Gold93FamilyRuntime:
	if _families.has(family):
		return _families[family]
	var runtime: Gold93FamilyRuntime = null
	if family == "venomwright":
		runtime = (VENOM_FAMILY as GDScript).new() as Gold93FamilyRuntime
	elif family == "arcana_iii":
		runtime = (ARCANA_FAMILY as GDScript).new() as Gold93FamilyRuntime
	if runtime != null:
		_families[family] = runtime
	return runtime


## Registers an override module script for a canonical id. Used when the owner
## supplies a source-locked module later; no core change is required.
func register_module(canonical_id: String, script_path: String) -> bool:
	if not catalog.has_skill(canonical_id):
		return false
	if not ResourceLoader.exists(script_path):
		return false
	_overrides[canonical_id] = script_path
	_blockers.erase(canonical_id)
	return true


func module_path_for(canonical_id: String) -> String:
	if _overrides.has(canonical_id):
		return String(_overrides[canonical_id])
	return String(MODULE_PATHS.get(canonical_id, ""))


func blocker_for(canonical_id: String) -> String:
	if _blockers.has(canonical_id):
		return String(_blockers[canonical_id])
	if module_path_for(canonical_id).is_empty():
		return DEFAULT_BLOCKER
	return ""


## Instantiates the module only when its generator reports source lock.
func module_for(canonical_id: String):
	if not catalog.has_skill(canonical_id):
		return null
	var path := module_path_for(canonical_id)
	if path.is_empty() or not ResourceLoader.exists(path):
		return null
	var script: GDScript = load(path) as GDScript
	if script == null:
		return null
	var instance = script.new()
	if not instance is Gold93SkillModule:
		return null
	var module := instance as Gold93SkillModule
	if not module.has_source_locked_generator():
		return null
	return module


## True only when a real native cast can run for this id right now.
func can_cast(canonical_id: String) -> bool:
	return module_for(canonical_id) != null


func cast(canonical_id: StringName, ctx, params: Gold93SkillParameters = null):
	var id := String(canonical_id)
	var entry: Dictionary = catalog.skill(id)
	if entry.is_empty():
		var blocked := Gold93SkillHandle.new(canonical_id, null, null, ctx, params, null)
		blocked.block_reason = "UNKNOWN_CANONICAL_ID"
		return blocked
	if params == null:
		params = Gold93SkillParameters.diagnostic(String(entry.get("family", "")))
	var family_id := String(entry.get("family", ""))
	var family: Gold93FamilyRuntime = family_runtime(family_id)
	var module = module_for(id)
	if module == null or family == null:
		var h := Gold93SkillHandle.new(canonical_id, null, null, ctx, params, null)
		h.block_reason = blocker_for(id)
		return h
	if ctx != null and ctx.has_method("ensure_ports"):
		ctx.ensure_ports()
	module.bind_context(ctx)
	var bus = Gold93Intents.Bus.new(StringName(id))
	var handle := Gold93SkillHandle.new(canonical_id, module, family, ctx, params, bus)
	return handle


## Machine-readable readiness roll-up, kept strictly separated per axis.
func readiness_report() -> Dictionary:
	var report: Dictionary = {
		"scope": 93,
		"native_port_ready": [],
		"blocked": [],
		"blocked_reasons": {},
		"gold_visual_approved": [],
		"gameplay_configured": [],
		"production_integrated": [],
	}
	for id in catalog.ids():
		if can_cast(id):
			report["native_port_ready"].append(id)
		else:
			report["blocked"].append(id)
			report["blocked_reasons"][id] = blocker_for(id)
		var entry: Dictionary = catalog.skill(id)
		if bool(entry.get("gold_visual_approved", false)):
			report["gold_visual_approved"].append(id)
		if bool(entry.get("gameplay_configured", false)):
			report["gameplay_configured"].append(id)
		if bool(entry.get("production_integrated", false)):
			report["production_integrated"].append(id)
	return report


func summary_line() -> String:
	var r := readiness_report()
	return ("X/%d NATIVE_PORT_READY, Y/%d SOURCE_VISUAL_APPROVED, "
		% [r["native_port_ready"].size(), r["gold_visual_approved"].size()]) + (
		"Z/%d PRODUCTION_INTEGRATED, %d/%d SOURCE_MATERIAL_BLOCKED"
		% [r["production_integrated"].size(), r["blocked"].size(), 93])

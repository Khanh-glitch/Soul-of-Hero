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
	# 002-006 are cast through `VenomwrightSourceModule`, which drives the
	# source-native `venom_world` / `venom_engine` port of the original engine
	# instead of the older `prototypes/gold_pair` component set that 001 uses.
	"venomwright:002": "res://prototypes/skill_readiness/skills/venomwright/v002_source_native.gd",
	"venomwright:003": "res://prototypes/skill_readiness/skills/venomwright/v003_source_native.gd",
	"venomwright:004": "res://prototypes/skill_readiness/skills/venomwright/v004_source_native.gd",
	"venomwright:005": "res://prototypes/skill_readiness/skills/venomwright/v005_source_native.gd",
	"venomwright:006": "res://prototypes/skill_readiness/skills/venomwright/v006_source_native.gd",

	# 009-012, 014, 017-019 and 021 are verified against the original TypeScript
	# (parity/index.json, first_divergent_tick -1) and reuse the same shared adapter.
	# 008 is verified by CI (run 41000928886 at 5023485) and 015 by runtime run
	# 41005700842 job 123913467489 at 4bf0769. 007, 013, 016 and 020 are NOT registered: their parity is unresolved.
	"venomwright:008": "res://prototypes/skill_readiness/skills/venomwright/v008_source_native.gd",
	"venomwright:009": "res://prototypes/skill_readiness/skills/venomwright/v009_source_native.gd",
	"venomwright:010": "res://prototypes/skill_readiness/skills/venomwright/v010_source_native.gd",
	"venomwright:011": "res://prototypes/skill_readiness/skills/venomwright/v011_source_native.gd",
	"venomwright:012": "res://prototypes/skill_readiness/skills/venomwright/v012_source_native.gd",
	"venomwright:013": "res://prototypes/skill_readiness/skills/venomwright/v013_source_native.gd",
	"venomwright:014": "res://prototypes/skill_readiness/skills/venomwright/v014_source_native.gd",
	"venomwright:015": "res://prototypes/skill_readiness/skills/venomwright/v015_source_native.gd",
	"venomwright:016": "res://prototypes/skill_readiness/skills/venomwright/v016_source_native.gd",
	"venomwright:007": "res://prototypes/skill_readiness/skills/venomwright/v007_source_native.gd",
	"venomwright:020": "res://prototypes/skill_readiness/skills/venomwright/v020_source_native.gd",
	"venomwright:017": "res://prototypes/skill_readiness/skills/venomwright/v017_source_native.gd",
	"venomwright:018": "res://prototypes/skill_readiness/skills/venomwright/v018_source_native.gd",
	"venomwright:019": "res://prototypes/skill_readiness/skills/venomwright/v019_source_native.gd",
	"venomwright:021": "res://prototypes/skill_readiness/skills/venomwright/v021_source_native.gd",
}

## Registry of the SOURCE-NATIVE engine: canonical id -> ORIGINAL skill id as
## ported in `native/venom/venom_skills.gd`. This is a DIFFERENT execution
## domain from `MODULE_PATHS`:
##
##   MODULE_PATHS  -> HOST_ADAPTER_CASTABLE. A `Gold93SkillModule` the host can
##                    drive through CastContext, emitting typed intents.
##   SOURCE_NATIVE -> SOURCE_NATIVE_EXECUTABLE. The ported original engine
##                    (`venom_world` / `venom_engine`) runs the authored
##                    generator. This is the domain the differential oracle
##                    diffs against the original TypeScript.
##
## They are counted separately on purpose. Adding them together would let a
## skill that is only reachable through one path masquerade as verified in the
## other, which is exactly the discrepancy the lifecycle test caught.
const SOURCE_NATIVE_IDS: Dictionary = {
	"venomwright:001": 1,
	"venomwright:002": 2,
	"venomwright:003": 3,
	"venomwright:004": 4,
	"venomwright:005": 5,
	"venomwright:006": 6,
	"venomwright:008": 8,
	"venomwright:009": 9,
	"venomwright:010": 10,
	"venomwright:011": 11,
	"venomwright:012": 12,
	"venomwright:013": 13,
	"venomwright:014": 14,
	"venomwright:015": 15,
	"venomwright:007": 7,
	"venomwright:020": 20,
	"venomwright:016": 16,
	"venomwright:017": 17,
	"venomwright:018": 18,
	"venomwright:019": 19,
	"venomwright:021": 21,
}

const SOURCE_NATIVE_SKILLS = preload("res://prototypes/skill_readiness/native/venom/venom_skills.gd")

## Human-readable reason recorded for every id without a source-locked module.
##
## CORRECTED 2026-10-28: this used to claim the original ZIP bytes were absent.
## They are not. Both original archives have been recovered, decrypted and
## SHA-256 verified, and the extracted TypeScript engine is what the oracle in
## `docs/vfx/skill_readiness/oracle/` is generated from. The escrow (encrypted
## ZIPs plus the decryption tool) lives in
## `prototypes/skill_readiness/source_escrow/`; the private key and the
## plaintext sources are deliberately NOT committed and are held outside the
## repository.
##
## The remaining blocker is therefore honest and actionable: the authored
## generator has simply not been ported to GDScript yet.
const DEFAULT_BLOCKER: String = ("GENERATOR_NOT_YET_PORTED: the original "
	+ "source archive for this skill HAS been recovered and verified, and the "
	+ "original generator is available; it has not been ported to a native "
	+ "GDScript module yet. This is pending implementation work, not missing "
	+ "input material.")

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


## True when the SOURCE-NATIVE port of the original engine can actually run
## this skill's authored generator. This EXECUTES the generator inside a real
## `venom_world`; it is not a table lookup, so it cannot claim a generator
## exists while the port is broken.
## Memoised per process. `readiness_report()` walks all 93 ids and is called
## several times per test run; un-cached, each pass re-executed a full
## 30-tick world probe per source-native id, which stacked up to minutes.
var _source_native_cache: Dictionary = {}


func source_native_executable(canonical_id: String) -> bool:
	if not SOURCE_NATIVE_IDS.has(canonical_id):
		return false
	if _source_native_cache.has(canonical_id):
		return bool(_source_native_cache[canonical_id])
	print("GOLD93_PROBE begin %s" % canonical_id)
	var ok: bool = bool(SOURCE_NATIVE_SKILLS.probe_native(
			int(SOURCE_NATIVE_IDS[canonical_id])))
	print("GOLD93_PROBE end %s ok=%s" % [canonical_id, str(ok)])
	_source_native_cache[canonical_id] = ok
	return ok


## True when a host cast can be driven end to end: a registered
## `Gold93SkillModule` loads, reports source lock, and exposes the module
## contract. Distinct from source-native execution and from source parity.
func host_adapter_castable(canonical_id: String) -> bool:
	return can_cast(canonical_id)


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
	# Reject adapters whose embedded id disagrees with the catalog id.
	# The previous v002-v006 wrappers silently used 2-digit ids.
	if String(module.canonical_id) != canonical_id:
		push_error("GOLD93_RUNTIME: adapter id mismatch: requested %s, module declares %s" % [canonical_id, String(module.canonical_id)])
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


## Readiness of a single skill, separated per axis.
##
## `can_cast()` answers only "does a native module load and run". That is
## `native_executable`. It is NOT source parity and it is NOT visual approval,
## and reporting it as `native_port_ready` made a scaffolded module look
## finished. The three axes are reported independently and `native_port_ready`
## is their strict conjunction.
func status_for(canonical_id: String) -> Dictionary:
	var entry: Dictionary = catalog.skill(canonical_id)
	var executable := can_cast(canonical_id)
	var source_native := source_native_executable(canonical_id)
	var parity := Gold93ParityRegistry.is_source_parity_verified(canonical_id)
	var visual := bool(entry.get("gold_visual_approved", false))
	var parity_status := Gold93ParityRegistry.status_for(canonical_id)
	return {
		"canonical_id": canonical_id,
		## `native_executable` is retained as the HOST-ADAPTER predicate because
		## that is what `cast()` actually needs; the new explicit name says so.
		"native_executable": executable,
		"host_adapter_castable": executable,
		"source_native_executable": source_native,
		"source_parity_verified": parity,
		"source_parity_status": parity_status,
		"gold_visual_approved": visual,
		"native_port_ready": executable and parity and visual,
		"blocked": not executable,
		"block_reason": blocker_for(canonical_id) if not executable else "",
		"gameplay_configured": bool(entry.get("gameplay_configured", false)),
		"production_integrated": bool(entry.get("production_integrated", false)),
	}


## Machine-readable readiness roll-up, kept strictly separated per axis.
##
## `native_port_ready` is retained for historical consumers but is now the
## strict conjunction of native-executable AND source-parity-verified AND
## gold-visual-approved. Use `native_executable` when you mean "a cast runs".
func readiness_report() -> Dictionary:
	var report: Dictionary = {
		"scope": 93,
		"native_executable": [],
		"host_adapter_castable": [],
		"source_native_executable": [],
		"source_parity_verified": [],
		"source_parity_status": {},
		"native_port_ready": [],
		"blocked": [],
		"blocked_reasons": {},
		"gold_visual_approved": [],
		"gameplay_configured": [],
		"production_integrated": [],
		"counts": {},
	}
	for id in catalog.ids():
		var st := status_for(id)
		if bool(st["native_executable"]):
			report["native_executable"].append(id)
		else:
			report["blocked"].append(id)
			report["blocked_reasons"][id] = st["block_reason"]
		if bool(st["host_adapter_castable"]):
			report["host_adapter_castable"].append(id)
		if bool(st["source_native_executable"]):
			report["source_native_executable"].append(id)
		if bool(st["source_parity_verified"]):
			report["source_parity_verified"].append(id)
		report["source_parity_status"][id] = st["source_parity_status"]
		if bool(st["gold_visual_approved"]):
			report["gold_visual_approved"].append(id)
		if bool(st["native_port_ready"]):
			report["native_port_ready"].append(id)
		if bool(st["gameplay_configured"]):
			report["gameplay_configured"].append(id)
		if bool(st["production_integrated"]):
			report["production_integrated"].append(id)
	report["counts"] = {
		"native_executable": report["native_executable"].size(),
		"host_adapter_castable": report["host_adapter_castable"].size(),
		"source_native_executable": report["source_native_executable"].size(),
		"source_parity_verified": report["source_parity_verified"].size(),
		"gold_visual_approved": report["gold_visual_approved"].size(),
		"native_port_ready": report["native_port_ready"].size(),
		"gameplay_configured": report["gameplay_configured"].size(),
		"production_integrated": report["production_integrated"].size(),
		"blocked": report["blocked"].size(),
	}
	return report


func summary_line() -> String:
	var r := readiness_report()
	var c: Dictionary = r["counts"]
	return ("%d/%d HOST_ADAPTER_CASTABLE, %d/%d SOURCE_NATIVE_EXECUTABLE, "
		% [c["host_adapter_castable"], 93, c["source_native_executable"], 93]) + (
		"%d/%d SOURCE_PARITY_VERIFIED, "
		% [c["source_parity_verified"], 93]) + (
		"%d/%d SOURCE_VISUAL_APPROVED, %d/%d NATIVE_PORT_READY, "
		% [c["gold_visual_approved"], 93, c["native_port_ready"], 93]) + (
		"%d/%d GAMEPLAY_CONFIGURED, %d/%d PRODUCTION_INTEGRATED"
		% [c["gameplay_configured"], 93, c["production_integrated"], 93])

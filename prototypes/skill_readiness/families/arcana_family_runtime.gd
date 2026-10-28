class_name ArcanaFamilyRuntime
extends Gold93FamilyRuntime

## Native adapter for the ORIGINAL ARCANA III engine family.
##
## Original provenance: `ARCANA_III_V2_72_SKILLS_FULLFX_2X.zip`
##   SHA-256 8402633cbc9666b6f628f1b6101acc6123d67af0a1797a229ea02aa5d440677d
##   480x270 logical PixiJS8 WebGL multipass scene, own camera (default 0.5x),
##   own RNG (`src/engine/util.ts rand()`), per-skill reseed.
##
## IMPORTANT: the ARCANA headless 30 Hz *diagnostic mock-draw* run recorded in
## the ChatGPT handoff had NO real PixiJS/WebGL renderer and is therefore NOT
## proof of source rendering clock or visual parity. The 11 fusion candidates
## #302..312 additionally have no independent Gold visual approval.

const SCAR_CANVAS = preload("res://prototypes/gold_pair/arcana_source_scar_canvas.gd")
const CRACK_SCAR = preload("res://prototypes/gold_pair/arcana_source_crack_scar.gd")
const DRAW_LEDGER = preload("res://prototypes/gold_pair/arcana_source_scar_draw_ledger.gd")
const RNG = preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")

const LOGICAL: Vector2i = Vector2i(480, 270)
const SOURCE_HZ: float = 60.0

var scar_canvas = null
var rendered_ticks: int = 0
var last_mark_commands: int = 0
var last_glow_commands: int = 0


func family_id() -> StringName:
	return &"arcana_iii"


func logical_size() -> Vector2i:
	return LOGICAL


func default_hz() -> float:
	return SOURCE_HZ


func default_density() -> int:
	# Archive is authored FULLFX_2X: 480x270 logical presented at 2x.
	return 2


func arcana_zero_seed_policy() -> bool:
	# ARCANA src/engine/util.ts rand() maps a zero seed to 1.
	return true


func make_rng(source_seed: int) -> GoldMulberry32Rng:
	var rng := (RNG as GDScript).new(source_seed) as GoldMulberry32Rng
	rng.reseed(source_seed, true)
	return rng


## --- surfaces ---------------------------------------------------------------

func build_surfaces(parent: Node) -> bool:
	_release_nodes()
	scar_canvas = (SCAR_CANVAS as GDScript).new() as Node2D
	scar_canvas.name = "ArcanaSourceScarGround"
	scar_canvas.z_index = 0
	parent.add_child(scar_canvas)
	owns(scar_canvas)
	return true


func set_source_to_map_transform(xform: Transform2D) -> void:
	if is_instance_valid(scar_canvas):
		scar_canvas.set_source_to_map_transform(xform)


func release_cast(_cast_id: StringName) -> int:
	var released: int = 0
	if is_instance_valid(scar_canvas):
		scar_canvas.release_source_scar()
		released += 1
	last_mark_commands = 0
	last_glow_commands = 0
	rendered_ticks = 0
	return released


func _release_nodes() -> void:
	detach()


## --- rendering ---------------------------------------------------------------

func render_tick(module: Gold93SkillModule, tick: int) -> void:
	if not attached or not is_instance_valid(scar_canvas):
		return
	var payload: Dictionary = module.frame_payload()
	var scars: Array = payload.get("scars", []) if payload.has("scars") else []
	if scars.is_empty():
		scar_canvas.release_source_scar()
		return
	for scar in scars:
		if not scar is Dictionary:
			continue
		var s: Dictionary = scar
		var source_age: float = float(s.get("age", float(tick) / SOURCE_HZ))
		scar_canvas.begin_source_scar(
				int(s.get("seed", 1)),
				float(s.get("x", 240.0)),
				float(s.get("y", 135.0)),
				int(s.get("branches", 5)),
				float(s.get("length", 40.0)),
				float(s.get("life", 5.0)),
				int(s.get("color", 0xff5a1f)))
		scar_canvas.render_source_frame(source_age, float(s.get("alpha", 1.0)))
		last_mark_commands = int(scar_canvas.get("last_ink"))
	rendered_ticks += 1


## --- source-locked primitive probe (headless safe) ---------------------------

## Reproduces the original `crackScar()` geometry and `draw.ts` command stream
## through the source-locked components. Used by CI as numeric evidence that the
## ARCANA ground layer is the ORIGINAL algorithm, not an invented shape.
func scar_probe(source_seed: int, x: float, y: float, branches: int,
		length: float, life: float, ages: Array) -> Dictionary:
	var rows: Array = []
	for age in ages:
		var scar = (CRACK_SCAR as GDScript).new()
		scar.configure(source_seed, x, y, branches, length, life)
		var ledger = (DRAW_LEDGER as GDScript).new()
		ledger.configure(source_seed, x, y, branches, length, life, 0xff5a1f)
		var alpha: float = clampf(1.0 - float(age) / maxf(life, 0.0001), 0.0, 1.0)
		rows.append({
			"age": float(age),
			"geometry_sha256": scar.geometry_sha256(float(age)),
			"draw_sha256": ledger.draw_sha256(float(age), alpha),
			"geometry_commands": scar.geometry_trace(float(age)).size(),
			"draw_commands": ledger.draw_trace(float(age), alpha).size(),
		})
	return {
		"family": String(family_id()),
		"seed": source_seed,
		"logical": [LOGICAL.x, LOGICAL.y],
		"rows": rows,
	}


func headless_probe(source_seed: int, ticks: int) -> Dictionary:
	var rng := make_rng(source_seed)
	var acc: float = 0.0
	for _i in range(ticks):
		acc += rng.next()
	return {
		"family": String(family_id()),
		"seed": source_seed,
		"ticks": ticks,
		"rng_sum": acc,
		"rng_state": rng.state,
		"zero_seed_policy": "ARCANA_0_MAPS_TO_1",
	}

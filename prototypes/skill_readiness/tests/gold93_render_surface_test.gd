extends SceneTree

## Render-path gate for BOTH original engine families.
##
## The per-skill harness attaches the family render surfaces, which is how two
## real defects were found in the Venomwright renderer (an untyped `[]` passed
## where the source component declares `Array[Vector4]`, killing every render
## tick, and a monotonic per-cast surface clock that was never rearmed). Neither
## was visible to any test that only ticked the numeric source runtime.
##
## This gate therefore drives `render_tick()` — the real `Image`/`ImageTexture`
## /`Sprite2D` passes — on both families while they are attached, and asserts:
##
##   * every Venomwright surface (environment, particles, actor, display post)
##     renders without a single script error,
##   * the ARCANA ground layer renders its source-locked `crackScar()` geometry
##     through the real mark/glow passes,
##   * ink actually lands (a silent no-op render is a failure, not a pass),
##   * `release_cast()` re-arms the per-cast clock so a SECOND cast on the same
##     attached family renders instead of being rejected as time travel,
##   * `detach()` frees every owned node.
##
## The ARCANA fixture below is a RENDER-PATH FIXTURE, not a skill: it replays
## the exact scar parameters that the source-locked `scar_probe()` audit uses.
## It is deliberately NOT registered in the runtime module table and can never
## make any ARCANA skill castable.

const RUNTIME_GD = preload("res://prototypes/skill_readiness/core/gold93_runtime.gd")
const CONTEXT = preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")
const PARAMS = preload("res://prototypes/skill_readiness/core/gold93_parameters.gd")
const PORTS = preload("res://prototypes/skill_readiness/core/gold93_ports.gd")
const VENOM_FAMILY = preload("res://prototypes/skill_readiness/families/venom_family_runtime.gd")
const ARCANA_FAMILY = preload("res://prototypes/skill_readiness/families/arcana_family_runtime.gd")
const MODULE_GD = preload("res://prototypes/skill_readiness/core/gold93_skill_module.gd")
const INTENTS = preload("res://prototypes/skill_readiness/core/gold93_intents.gd")

const SOURCE_SEED: int = 20261028

var _failures: Array[String] = []
var _checks: int = 0


## Render-path fixture: replays the audit scar spec through the ARCANA ground
## layer. Not a playable skill; `has_source_locked_generator()` stays false so
## the runtime can never cast it.
class ArcanaScarFixture extends Gold93SkillModule:
	func _init() -> void:
		canonical_id = &"fixture:arcana_scar_render"
		family = &"arcana_iii"
		original_skill_id = 0

	func original_name() -> String:
		return "RENDER PATH FIXTURE — not a skill"

	func source_hz() -> float:
		return 60.0

	func has_source_locked_generator() -> bool:
		# Deliberately false: this fixture may never be cast as a skill.
		return false

	func source_material_blocker() -> String:
		return "RENDER_PATH_FIXTURE_NOT_A_SKILL"

	func step_source_tick(_targets: Array, _aim: Dictionary) -> void:
		_source_tick += 1

	func frame_payload() -> Dictionary:
		# Exactly the parameters the source-locked scar_probe() audit uses.
		return {"scars": [{
			"seed": 20261027,
			"x": 240.0,
			"y": 135.0,
			"branches": 5,
			"length": 40.0,
			"life": 5.0,
			"color": 0xff5a1f,
			"age": float(_source_tick) / 60.0,
		}]}


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error("GOLD93_RENDER: " + message)


func _stage(name: String) -> Node2D:
	var node := Node2D.new()
	node.name = name
	root.add_child(node)
	return node


func _context(stage: Node2D) -> Gold93CastContext:
	var caster := Node2D.new()
	caster.name = "RenderCaster"
	caster.global_position = Vector2(200.0, 170.0)
	stage.add_child(caster)
	var ctx := CONTEXT.new()
	ctx.initialize(caster, Vector2(200.0, 170.0), SOURCE_SEED, true)
	ctx.set_source_to_world(Transform2D.IDENTITY)
	ctx.set_world_aim(Vector2(340.0, 170.0))
	var bundle := PORTS.Bundle.new(true)
	bundle.targets.set_actors([
		{"id": 1, "x": 340.0, "y": 170.0, "r": 8.0, "exists": true, "dying": 0.0},
		{"id": 2, "x": 430.0, "y": 215.0, "r": 7.0, "exists": true, "dying": 0.0},
	])
	ctx.set_ports(bundle)
	return ctx


func _venom_render_passes(family, stage: Node2D, ticks: int) -> Dictionary:
	var runtime = RUNTIME_GD.new()
	var module = runtime.module_for("venomwright:001")
	_check(module != null, "venomwright:001 module must resolve for the render gate")
	if module == null:
		return {}
	var ctx := _context(stage)
	module.bind_context(ctx)
	var bus = INTENTS.Bus.new(StringName("venomwright:001"))
	var handle := Gold93SkillHandle.new(StringName("venomwright:001"), module, family,
			ctx, PARAMS.diagnostic("venomwright"), bus)
	_check(not handle.is_blocked(), "the render-gate handle must be READY")
	_check(handle.start(), "start() must succeed for the render gate")
	handle.tick_source(ticks)
	# `render_frame` is the source component's OWN monotonic counter: it only
	# advances when the particle raster actually accepted the tick. Without the
	# rearmed per-cast clock the second cast would log "clock moved backwards"
	# and silently stop drawing while `rendered_ticks` kept counting.
	var particle_frame: int = -1
	if is_instance_valid(family.get("particles_canvas")):
		particle_frame = int(family.get("particles_canvas").get("render_frame"))
	var out: Dictionary = {
		"rendered_ticks": int(family.get("rendered_ticks")),
		"ink_pixels": int(family.get("last_ink_pixels")),
		"owned_nodes": int(family.stats().get("owned_nodes", 0)),
		"particle_render_frame": particle_frame,
	}
	_check(particle_frame == ticks,
			"the source particle raster must accept every tick, got render_frame %d of %d"
			% [particle_frame, ticks])
	_check(out["rendered_ticks"] == ticks,
			"every tick must reach the Venomwright render pass, got %d of %d"
			% [out["rendered_ticks"], ticks])
	handle.dispose()
	return out


func _initialize() -> void:
	# --- 1. Venomwright: the real module through the real render passes -------
	var venom_stage := _stage("VenomRenderStage")
	var venom_family = VENOM_FAMILY.new()
	_check(venom_family.attach(venom_stage, 2), "Venomwright surfaces must attach")
	venom_family.set_source_to_map_transform(Transform2D.IDENTITY)

	var venom_run: Dictionary = _venom_render_passes(venom_family, venom_stage, 120)
	_check(int(venom_run.get("owned_nodes", 0)) >= 4,
			"Venomwright must own environment, particles, actor and post surfaces")
	_check(int(venom_run.get("ink_pixels", 0)) > 0,
			"the Venomwright environment pass must actually ink pixels")

	# A SECOND cast on the SAME attached family must render, not be rejected as
	# a backwards clock. This is the regression guard for the rearmed clock.
	_check(venom_family.release_cast(&"render_gate") > 0,
			"release_cast must release the Venomwright surfaces between casts")
	# A deliberately DIFFERENT length: if the per-cast surface clock were not
	# rearmed, the source raster would reject every tick of the second cast as
	# time travel and `render_frame` would stay stuck at the first cast's 120.
	var second_run: Dictionary = _venom_render_passes(venom_family, venom_stage, 90)
	_check(int(second_run.get("rendered_ticks", 0)) == 90,
			"a second cast on one attached family must still render every tick")
	_check(int(second_run.get("ink_pixels", 0)) > 0,
			"the second cast must still ink the environment pass")

	# --- 2. ARCANA: source-locked scar geometry through the real passes -------
	var arcana_stage := _stage("ArcanaRenderStage")
	var arcana = ARCANA_FAMILY.new()
	_check(arcana.attach(arcana_stage, 2), "ARCANA surfaces must attach")
	arcana.set_source_to_map_transform(Transform2D.IDENTITY)
	var fixture = ArcanaScarFixture.new()
	var bus = INTENTS.Bus.new(&"fixture")
	fixture.begin(&"fixture:scar", bus, PARAMS.diagnostic("arcana_iii"))
	for _i in range(120):
		fixture.step_source_tick([], {})
		arcana.render_tick(fixture, int(fixture.source_tick()))
	_check(int(arcana.get("rendered_ticks")) == 120,
			"every tick must reach the ARCANA render pass")
	_check(int(arcana.get("last_mark_commands")) > 0,
			"the ARCANA mark layer must actually draw source crack geometry")
	var released: int = arcana.release_cast(&"fixture:scar")
	_check(released > 0, "ARCANA release_cast must release its surfaces")

	# The ARCANA fixture may never become a castable skill.
	var runtime = RUNTIME_GD.new()
	_check(not runtime.can_cast("fixture:arcana_scar_render"),
			"a render-path fixture must never become a castable skill")
	_check(not fixture.has_source_locked_generator(),
			"a render-path fixture must not claim a source-locked generator")

	# --- 3. teardown ----------------------------------------------------------
	_check(arcana.detach() > 0, "ARCANA detach must free its owned nodes")
	_check(int(arcana.stats().get("owned_nodes", 0)) == 0,
			"ARCANA must own no nodes after detach")
	_check(venom_family.detach() > 0, "Venomwright detach must free its owned nodes")
	_check(int(venom_family.stats().get("owned_nodes", 0)) == 0,
			"Venomwright must own no nodes after detach")

	DirAccess.make_dir_recursive_absolute("res://.artifacts/gold93")
	var file := FileAccess.open(
			"res://.artifacts/gold93/render_surface.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({
			"schema": "gold93/render-surface/v1",
			"venomwright": {
				"first_cast": venom_run,
				"second_cast_same_surfaces": second_run,
			},
			"arcana_iii": {
				"rendered_ticks": int(arcana.get("rendered_ticks")),
				"mark_commands": int(arcana.get("last_mark_commands")),
				"glow_commands": int(arcana.get("last_glow_commands")),
				"note": "source-locked crackScar geometry through the real mark/glow passes; render-path fixture, not a castable skill",
			},
		}, "  ") + "\n")
		file.close()

	venom_stage.free()
	arcana_stage.free()

	if _failures.is_empty():
		print("GOLD93_RENDER: PASS / %d checks / both families render every tick / ink lands / re-cast re-arms the surface clock / clean teardown" % _checks)
		quit(0)
	else:
		print("GOLD93_RENDER: FAIL / %d problem(s)" % _failures.size())
		quit(1)

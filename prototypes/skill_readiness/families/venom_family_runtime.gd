class_name VenomFamilyRuntime
extends Gold93FamilyRuntime

## Native adapter for the ORIGINAL Venomwright engine family.
##
## Original provenance: `venomwright-combat-vfx-design (4).zip`
##   SHA-256 ab0dba56055f1d81b558fef658e2ce99b7b460d87cb732c29eec1bd0dd2fd716
##   600x340 logical world, native Ultra k2 -> 1200x680, authored 60 Hz,
##   CPU procedural raster (shadow / ground / air / lit / glow), own RNG.
##
## The render surfaces below are the source-locked components produced by the
## Gold factory branch (`prototypes/gold_pair/**`), which stays READ-ONLY. This
## file only owns and orchestrates them; it does not duplicate or alter them.

const ENV_CANVAS = preload("res://prototypes/gold_pair/venom_glassfang_environment_canvas.gd")
const PARTICLES_CANVAS = preload("res://prototypes/gold_pair/venom_source_particles_canvas.gd")
const FANG_CANVAS = preload("res://prototypes/gold_pair/venom_source_fang_canvas.gd")
const POST = preload("res://prototypes/gold_pair/venom_source_display_post.gd")
const RNG = preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")

const LOGICAL: Vector2i = Vector2i(600, 340)
const SOURCE_HZ: float = 60.0

var env_canvas = null
var particles_canvas = null
var fang_canvas = null
var post_node = null
var live_environment = null
var rendered_ticks: int = 0
var last_ink_pixels: int = 0
## True once the source Fang layers exist, i.e. once the authored cast actually
## spawned the predator. Guards teardown of an uninitialised source component.
var _fang_rendered: bool = false


func family_id() -> StringName:
	return &"venomwright"


func logical_size() -> Vector2i:
	return LOGICAL


func default_hz() -> float:
	return SOURCE_HZ


func default_density() -> int:
	# Native Gold Ultra is k2; Classic k1 is kept available for comparison only.
	return 2


func arcana_zero_seed_policy() -> bool:
	# Venomwright src/game/pixel.ts Rng keeps seed 0 as 0.
	return false


func make_rng(source_seed: int) -> GoldMulberry32Rng:
	var rng := (RNG as GDScript).new(source_seed) as GoldMulberry32Rng
	rng.reseed(source_seed, false)
	return rng


## --- surfaces ---------------------------------------------------------------

func build_surfaces(parent: Node) -> bool:
	_release_nodes()
	live_environment = load("res://prototypes/gold_pair/venom_glassfang_live_environment.gd").new()

	env_canvas = (ENV_CANVAS as GDScript).new() as Node2D
	env_canvas.name = "VenomSourceEnvironment"
	env_canvas.set_source_density(density)
	parent.add_child(env_canvas)
	owns(env_canvas)

	particles_canvas = (PARTICLES_CANVAS as GDScript).new() as Node2D
	particles_canvas.name = "VenomSourceParticles"
	particles_canvas.set_source_density(density)
	particles_canvas.z_index = 2
	parent.add_child(particles_canvas)
	owns(particles_canvas)

	fang_canvas = (FANG_CANVAS as GDScript).new() as Node2D
	fang_canvas.name = "VenomSourceActor"
	fang_canvas.set_source_density(density)
	fang_canvas.z_index = 3
	parent.add_child(fang_canvas)
	owns(fang_canvas)

	post_node = (POST as GDScript).new() as Control
	post_node.name = "VenomSourceDisplayPost"
	parent.add_child(post_node)
	owns(post_node)
	_bind_post()
	return true


func set_source_to_map_transform(xform: Transform2D) -> void:
	if is_instance_valid(env_canvas):
		env_canvas.set_source_to_map_transform(xform)
	if is_instance_valid(particles_canvas):
		particles_canvas.set_source_to_map_transform(xform)
	if is_instance_valid(fang_canvas):
		fang_canvas.set_source_to_map_transform(xform)


func _bind_post() -> void:
	if not is_instance_valid(post_node) or not is_instance_valid(env_canvas):
		return
	var scene_tex: Texture2D = null
	var glow_tex: Texture2D = null
	if is_instance_valid(env_canvas.get_node_or_null("GoldEnvironment_scene")):
		scene_tex = (env_canvas.get_node("GoldEnvironment_scene") as Sprite2D).texture
	if is_instance_valid(env_canvas.get_node_or_null("GoldEnvironment_glow")):
		glow_tex = (env_canvas.get_node("GoldEnvironment_glow") as Sprite2D).texture
	post_node.bind_source_layers(scene_tex, glow_tex, density)
	post_node.size = Vector2(native_frame_size())


func release_cast(_cast_id: StringName) -> int:
	var released: int = 0
	if is_instance_valid(env_canvas):
		env_canvas.release_source_environment()
		released += 1
	if is_instance_valid(particles_canvas):
		particles_canvas.release_source_particles()
		particles_canvas.set("render_frame", 0)
		# The source component guards against a render clock that moves
		# backwards, which is correct WITHIN one cast. The surface is owned by
		# this adapter and is reused by the next cast, so the per-cast clock
		# must be rearmed here or every cast after the first is rejected.
		particles_canvas.set("rendered_count", 0)
		released += 1
	if is_instance_valid(fang_canvas):
		# Only safe once the fang layers actually exist: the source component
		# asserts on its initialised pass dictionary.
		if _fang_rendered:
			fang_canvas.release_source_actor()
			released += 1
	if live_environment != null:
		live_environment.reset()
	rendered_ticks = 0
	last_ink_pixels = 0
	_fang_rendered = false
	return released


func _release_nodes() -> void:
	detach()


## --- rendering ---------------------------------------------------------------

func render_tick(module: Gold93SkillModule, tick: int) -> void:
	if not attached:
		return
	var source = module.source_runtime() if module.has_method("source_runtime") else null
	if source == null:
		return
	# 1. Original cast-cue -> continuous native environment timeline.
	if live_environment != null and live_environment.has_method("capture"):
		live_environment.capture(source)
		var events: Array = live_environment.snapshot()
		if is_instance_valid(env_canvas):
			env_canvas.render_source_events(events)
			last_ink_pixels = _count_ink(events)
	# 2. Live CPU particle raster from the original source World buffers.
	if is_instance_valid(particles_canvas) and source.has_method("particles"):
		particles_canvas.render_source_world_particles(source.particles(), tick)
	# 3. Source actor (Fang) passes, driven by the live source actor object.
	if is_instance_valid(fang_canvas):
		var motion: Variant = source.get("motion") if source is Object else null
		var actor: Variant = null
		if motion != null and motion is Object:
			actor = (motion as Object).get("fang")
		if actor != null and actor is VenomSourceFang:
			fang_canvas.render_live_actor_frame(actor as VenomSourceFang,
					float(tick) / SOURCE_HZ)
			# The original Fang spawns after the vial throw; before that the
			# component has no layers yet, so releasing would assert.
			_fang_rendered = true
		elif _fang_rendered:
			fang_canvas.release_source_actor()
			_fang_rendered = false
	# 4. Original display post (scene+glow composite, shock, shake, grade).
	if is_instance_valid(post_node):
		var shake: Vector2 = _shake(module, tick)
		# `shock_world` is a TYPED Array[Vector4]; an untyped `[]` literal is
		# rejected at runtime, which silently killed the whole render pass.
		post_node.present_source_feedback(float(tick) / SOURCE_HZ, shake,
				_shocks(module), _flash(module), Vector4(0.0, 1.0, 0.0, 1.0))
	rendered_ticks += 1


func _shake(_module: Gold93SkillModule, _tick: int) -> Vector2:
	# Original display shake is authored per skill; sources that do not shake
	# must report zero instead of a decorative wobble.
	return Vector2.ZERO


## Authored screen-shock rings (original `Display.shock`), routed from the
## module's emitted camera intents. Empty until a ported source generator
## authors a real shock: nothing decorative is synthesised here.
func _shocks(module: Gold93SkillModule) -> Array[Vector4]:
	var out: Array[Vector4] = []
	if module == null or module.bus() == null:
		return out
	for intent in module.bus().emitted:
		if not intent is Dictionary:
			continue
		var d: Dictionary = intent
		if StringName(d.get("kind", &"")) != Gold93Intents.KIND_CAMERA:
			continue
		if String(d.get("op", "")) != "shock":
			continue
		if out.size() >= 4:
			break
		var extra: Dictionary = d.get("extra", {})
		var pos: Vector2 = d.get("source_pos", Vector2.ZERO)
		out.append(Vector4(pos.x, pos.y,
				float(extra.get("radius", 0.0)),
				float(d.get("strength", 0.0))))
	return out


## Authored RGBA flash (original `Display.flash`). Zero until a ported source
## generator authors one; the VFX never invents a flash of its own.
func _flash(_module: Gold93SkillModule) -> Vector4:
	return Vector4.ZERO


func _count_ink(events: Array) -> int:
	var total: int = 0
	for e in events:
		if e is Dictionary:
			total += int(roundf(float((e as Dictionary).get("radius", 0.0))))
	return total


## Headless / deterministic numeric surface used by CI when no GPU is present.
## It proves the family clock, RNG and physics advanced without depending on a
## render target.
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
		"zero_seed_policy": "VENOM_0_STAYS_0",
	}

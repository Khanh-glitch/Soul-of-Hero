class_name VenomPilotStage
extends RefCounted

## Venomwright pilot stage (GOLD-fidelity acceptance pilot, skills 006 and 010).
##
## Drives the SAME native pipeline that passed the original-source differential
## (`venom_world` + `venom_engine` + `venom_skills`), with the same seed, cast
## tick, aim, enemy formation, ground seed and fixed 60 Hz clock as the recorded
## GOLD oracle (`docs/vfx/skill_readiness/oracle/venomwright_NNN.json`).
##
## Nothing in this file redraws or fakes an effect: every pixel comes from the
## skill generator and the world's own `draw()` through the native `Layer`s.

const WORLD = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")
const ENGINE = preload("res://prototypes/skill_readiness/native/venom/venom_engine.gd")
const SKILLS = preload("res://prototypes/skill_readiness/native/venom/venom_skills.gd")

const F: float = 1.0 / 60.0
const SEED: int = 7
const DENSITY: int = 16
const CAST_TICK: int = 1
## Skills the pilot accepts. Other ids are rejected rather than approximated.
const PILOT_SKILLS: Array = [6, 10]

var skill_id: int = 0
var def: Dictionary = {}
var world = null
var layers: Dictionary = {}
var ground = null
var tick: int = 0
var cast_started: bool = false
var cast_obj = null
var overlay: bool = false


## Build a fresh world exactly as the oracle driver does. Returns false when the
## skill is not a pilot skill or has no native generator.
func start(sid: int, as_overlay: bool = false) -> bool:
	if not PILOT_SKILLS.has(sid) or not SKILLS.has_generator(sid):
		return false
	skill_id = sid
	overlay = as_overlay
	def = SKILLS.defs()[sid]
	world = WORLD.new(ENGINE.WW, ENGINE.WH)
	world.cfg["density"] = DENSITY
	world.reset_ids()
	world.uid = 1
	world.reset(SEED, true)
	world.lab = true
	world.stats = {"total": 0.0, "kills": 0, "hits": 0, "ev": []}
	var p = world.player
	p.form = "venom" if String(def["form"]) == "venom" else "vessel"
	p.venomT = 999
	p.cat = 100
	if String(def["form"]) != "venom":
		p.venomT = 0
	layers = ENGINE.build_gfx()
	ground = ENGINE.make_ground_buffer()
	tick = 0
	cast_started = false
	cast_obj = null
	_render()
	return true


## Advance the original fixed clock by `count` ticks. Casts on CAST_TICK.
func advance(count: int) -> void:
	for _i in range(count):
		if world == null:
			return
		world.step(F)
		tick += 1
		if tick == CAST_TICK and not cast_started:
			cast_started = true
			var r: Dictionary = ENGINE.auto_aim(world, def)
			cast_obj = ENGINE.cast(world, def, r, SKILLS.run_factory(skill_id))
		_render()


## Venom-world position of the caster (the origin of every effect).
func player_xy() -> Vector2:
	return Vector2(float(world.player.x), float(world.player.y))


func sim_time() -> float:
	return world.time if world != null else 0.0


func live_counts() -> Dictionary:
	if world == null:
		return {}
	return {
		"tick": tick,
		"time": snappedf(world.time, 0.001),
		"fx": world.fx.size(),
		"parts": world.parts.list.size(),
		"enemies": world.enemies.size(),
	}


## Scene raster: ground + effects exactly as the oracle hashes it (RGBA8).
func scene_bytes() -> PackedByteArray:
	return layers["s"].bytes


## Glow raster: the separate glow buffer the oracle also hashes (RGBA8).
func glow_bytes() -> PackedByteArray:
	return layers["l"].bytes


func scene_image() -> Image:
	return _to_image(layers["s"])


func glow_image() -> Image:
	return _to_image(layers["l"])


func _to_image(L) -> Image:
	return Image.create_from_data(L.W, L.H, false, Image.FORMAT_RGBA8, L.bytes)


## GOLD mode: scene <- ground, glow <- black, then the world draws both layers
## (identical to the differential test). Overlay mode: the scene starts black
## instead of the venom ground, so the effects can be added onto a real map.
func _render() -> void:
	if overlay:
		layers["s"].clear(0xFF000000)
	else:
		layers["s"].copy_from(ground)
	layers["l"].clear(0xFF000000)
	layers["s"].reset()
	layers["l"].reset()
	layers["t"] = world.time
	world.draw(layers)

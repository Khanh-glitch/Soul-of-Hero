extends Node
## Browser CI fixture: boots the real overworld, observes only its public/live
## state, and leaves all gameplay input to Chromium. Not a normal-save journey.
const WORLD := preload("res://game/overworld/chapter1_overworld.tscn")
var _world: Node

func _ready() -> void:
	_world = WORLD.instantiate()
	add_child(_world)
	_world.call(&"configure", {})

func _process(_delta: float) -> void:
	if not OS.has_feature("web") or _world == null:
		return
	var ready := bool(_world.call(&"is_world_ready"))
	var state := {"ready": ready, "build_stage": int(_world.get(&"build_stage")),
		"build_error": String(_world.get(&"build_error"))}
	if ready:
		var hero := _world.get(&"player") as CharacterBody2D
		var economy: Node = _world.get(&"economy_panel")
		var motion: Vector2 = hero.get(&"move_input")
		state.merge({"node_count": (_world.get(&"survival_nodes") as Dictionary).size(),
			"economy_open": bool(economy.call(&"is_open")),
			"modal": bool(_world.call(&"_has_gameplay_modal")),
			"move": [motion.x, motion.y],
			"position": [hero.global_position.x, hero.global_position.y],
			"action": String(hero.get(&"current_action"))})
	JavaScriptBridge.eval("window.__survivalWebProbe=" + JSON.stringify(state) + ";", true)

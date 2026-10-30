extends Node2D
## A0-owned physical interaction host for the A1 2951bf85 Waystation slice.
## It is inert until the actual composed world mounts it and supplies its real
## Knight and EconomySession. It does not own inventory, time or reward data.
const POINT = preload("res://game/survival/waystation_interactable.gd")
const POI := "poi_crown_waystation"
const POINTS := {
	"locker": {"cell": Vector2i(408, 198), "stand": Vector2i(408, 199), "action": "pry_locker", "instance": ""},
	"cache": {"cell": Vector2i(406, 203), "stand": Vector2i(406, 202), "action": "cache_restock", "instance": "node_waystation_cache"},
}
var _world: Node
var _hero: Node2D
var _session: Node
var _points := {}

func configure(world: Node, hero: Node2D, session: Node) -> bool:
	if world == null or hero == null or session == null or get_parent() != world or not _points.is_empty():
		return false
	_world = world
	_hero = hero
	_session = session
	for id: String in POINTS:
		var data: Dictionary = POINTS[id]
		var point := POINT.new() as Node2D
		point.name = id.capitalize()
		var cell: Vector2i = data.cell
		point.position = Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		point.call(&"configure", self)
		add_child(point)
		_points[id] = point
		# Existing SOH original prop atlas; not a generic collision or reward box.
		var physical_world := world.get(&"world") as OverworldWorld
		if physical_world != null:
			var sprite := physical_world.call(&"_make_sprite", "camp_crate") as Sprite2D
			if sprite != null:
				point.add_child(sprite)
	return true

func owns_point(point: Node) -> bool:
	return is_instance_valid(point) and point.get_parent() == self and _points.values().has(point)

func matches_interaction(point: Node, actor: Node) -> bool:
	if not owns_point(point) or actor != _hero or not is_instance_valid(_hero) or bool(_hero.get(&"dead")):
		return false
	var nav := _world.get(&"traversability") as OverworldTraversability
	if nav == null:
		return false
	for id: String in _points:
		if _points[id] != point:
			continue
		var data: Dictionary = POINTS[id]
		var cell: Vector2i = data.cell
		var expected := Vector2(cell.x * 16 + 8, cell.y * 16 + 8)
		return (point as Node2D).global_position.distance_to(expected) < 0.01 \
			and nav.cell_of(_hero.global_position) == data.stand \
			and _hero.global_position.distance_to(expected) <= 24.0
	return false

func request_for(point: Node) -> Dictionary:
	if not owns_point(point):
		return {}
	for id: String in _points:
		if _points[id] == point:
			var data: Dictionary = POINTS[id]
			var request := {"poi_id": POI, "action_id": String(data.action)}
			if not String(data.instance).is_empty():
				request["instance_id"] = String(data.instance)
			return request
	return {}

func interact_point(point: Node, actor: Node) -> void:
	if not is_instance_valid(_session):
		return
	var result: Dictionary = _session.call(&"try_waystation_interaction", point, actor)
	var message := "The Waystation could not record that action."
	if bool(result.get("ok", false)):
		if bool(result.get("duplicate", false)):
			message = "Already opened."
		elif String(request_for(point).get("action_id", "")) == "pry_locker":
			message = "Salvage access unlocked. The locker held no items."
		else:
			message = "Cache: 3 iron scrap and 2 knowledge spares."
	else:
		var reason := String(result.get("reason", ""))
		if reason == "OUT_OF_RANGE": message = "Stand next to the Waystation object."
		elif reason.begins_with("MISSING_CAPABILITY"): message = "Open the Waystation locker first."
		elif reason == "COOLDOWN": message = "Cache not restocked yet; active travel replenishes it."
		elif reason == "inventory_full": message = "Not enough bag space; nothing was taken."
		elif reason == "ALREADY_APPLIED": message = "Already opened."
	if is_instance_valid(_world) and _world.has_method(&"show_prompt"):
		_world.call(&"show_prompt", message)

extends Node2D
## A0-owned physical interaction host for the A1 2951bf85 Waystation slice.
## It is inert until the actual composed world mounts it and supplies its real
## Knight and EconomySession. It does not own inventory, time or reward data.
const POINT = preload("res://game/survival/waystation_interactable.gd")
const POI := "poi_crown_waystation"
const RELAY_POI := "poi_crown_relay_shed"
const POINTS := {
	"locker": {"cell": Vector2i(408, 198), "stand": Vector2i(408, 199), "action": "pry_locker", "instance": ""},
	"cache": {"cell": Vector2i(406, 203), "stand": Vector2i(406, 202), "action": "cache_restock", "instance": "si:r_ashen_crown:waystation_cache:01"},
	"ledger": {"cell": Vector2i(411, 202), "stand": Vector2i(410, 202), "action": "seal_ledger", "instance": ""},
	"deadfall": {"cell": Vector2i(398, 202), "stand": Vector2i(398, 201), "action": "gather_deadfall", "instance": "node_waystation_approach_deadfall"},
	"crank": {"cell": Vector2i(443, 234), "stand": Vector2i(442, 234), "poi": RELAY_POI, "action": "hand_crank_bypass", "instance": ""},
}
var _world: Node
var _hero: Node2D
var _session: Node
var _points := {}

func configure(world: Node, hero: Node2D, session: Node) -> bool:
	if world == null or hero == null or session == null or get_parent() != world or not _points.is_empty():
		return false
	if world.get(&"player") != hero or world.get(&"economy_session") != session:
		return false
	var mounted_world := world.get(&"world") as OverworldWorld
	if mounted_world == null or mounted_world.width != 448 or mounted_world.height != 256 or mounted_world.blocker_root == null:
		return false
	# The source and its cache body must already exist in the same live physics
	# projection; a caller-provided position or UI label is not authority.
	for name: String in ["obs_waystation_locker_bank_408_198", "obs_waystation_cache_crate_406_203", "obs_waystation_ledger_desk_411_202", "obs_waystation_deadfall_398_202", "obs_relay_crank_cabinet_443_234"]:
		var body := mounted_world.blocker_root.get_node_or_null(name) as StaticBody2D
		if body == null or body.collision_layer != 1 or body.is_queued_for_deletion():
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
			var frames := {"locker": "camp_rack", "cache": "camp_crate", "ledger": "camp_table", "deadfall": "tree_dead", "crank": "short_valve_closed"}
			var sprite := physical_world.call(&"_make_sprite", String(frames[id])) as Sprite2D
			if sprite != null:
				point.add_child(sprite)
	return true

func owns_point(point: Node) -> bool:
	return is_instance_valid(point) and point.is_inside_tree() and not point.is_queued_for_deletion() \
		and is_inside_tree() and point.get_parent() == self and _points.values().has(point)

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
			var request := {"poi_id": String(data.get("poi", POI)), "action_id": String(data.action)}
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
			match String(request_for(point).get("action_id", "")):
				"cache_restock": message = "Cache: 3 iron scrap and 2 knowledge spares."
				"gather_deadfall": message = "Gathered 2 oak wood."
				"seal_ledger": message = "Waystation seal recorded."
				"hand_crank_bypass": message = "Relay powered: used 2 scrap and 1 oak."
	else:
		var reason := String(result.get("reason", ""))
		if reason == "OUT_OF_RANGE": message = "Stand next to the Waystation object."
		elif reason.begins_with("MISSING_CAPABILITY"): message = "Open the Waystation locker first."
		elif reason == "COOLDOWN": message = "Not replenished yet; active travel restores this source."
		elif reason.begins_with("MISSING_ITEM:"): message = "Relay needs 2 iron scrap and 1 oak wood."
		elif reason == "inventory_full": message = "Not enough bag space; nothing was taken."
		elif reason == "ALREADY_APPLIED": message = "Already opened."
	if is_instance_valid(_world) and _world.has_method(&"show_prompt"):
		_world.call(&"show_prompt", message)

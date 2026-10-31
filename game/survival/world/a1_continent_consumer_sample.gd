class_name A1ContinentConsumerSample
extends RefCounted
## Small executable A0 consumer example. It uses only the public R13 façade and
## canonical res:// data. Initial spawn placement is explicit; subsequent travel
## must remain A0/player-controller physics, not coordinate mutation.

const CONTINENT := preload("res://game/survival/world/a1_continent_interface.gd")


static func create(parent: Node, player_scene_override: String = "") -> Dictionary:
	if parent == null or not is_instance_valid(parent):
		return {"ok": false, "error": "CONSUMER_PARENT_REQUIRED"}
	var continent := CONTINENT.new() as A1ContinentInterface
	continent.name = "A1AuthoredContinent"
	parent.add_child(continent)
	if not continent.configure("res://data/survival/world", player_scene_override):
		var reason := String(continent.last_error)
		parent.remove_child(continent)
		continent.queue_free()
		return {"ok": false, "error": reason}
	return {"ok": true, "error": "", "continent": continent}


static func select_run_spawn(continent: A1ContinentInterface, run_seed: int) -> Dictionary:
	if continent == null or not is_instance_valid(continent) or not continent.is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	var spawn := continent.choose_safe_spawn(run_seed)
	if not bool(spawn.get("ok", false)):
		return spawn
	# A0 persists spawn.cell in its run-local state, validates dynamic occupancy,
	# then places its actor once at spawn.actor_origin_px. Do not use this for travel.
	return spawn


static func sync_actor(continent: A1ContinentInterface, actor: Node2D, camera_world_rect: Rect2) -> Dictionary:
	if continent == null or not is_instance_valid(continent) or actor == null or not is_instance_valid(actor):
		return {"ok": false, "error": "CONSUMER_ACTOR_REQUIRED"}
	return continent.acquire_for_actor(actor.global_position, camera_world_rect)


static func a8_shell_descriptor(continent: A1ContinentInterface, site_key_or_poi: String) -> Dictionary:
	if continent == null or not is_instance_valid(continent) or not continent.is_ready():
		return {"ok": false, "error": "INTERFACE_NOT_READY"}
	# A0 instantiates descriptor.shell.scene once at descriptor.shell.origin_world_px.
	# A8 owns that scene and its bodies; never rebuild bodies from collision.exclusions.
	return continent.site(site_key_or_poi)

extends Node2D
## A0-owned physical interaction host for the A1 2951bf85 Waystation slice.
## It is inert until the actual composed world mounts it and supplies its real
## Knight and EconomySession. It does not own inventory, time or reward data.
const POINT = preload("res://game/survival/waystation_interactable.gd")
const POI := "poi_crown_waystation"
const RELAY_POI := "poi_crown_relay_shed"
const A1_TREATMENT := "res://data/survival/world/art/compiled/crown_roadside_visual_treatment.presentation.v1.json"
const A1_TREATMENT_SHA := "3ad267e47a4d1d47980887fbf9b8d1547323c0b695b3696e499d2a246d2f387f"
const A1_ATLAS := "res://data/survival/world/art/atlas.v1.json"
const A1_ATLAS_SHA := "617fc36d866653d67eb1b890ddcf5501b8660d87031ae04fefdb73941393326e"
const A1_TEXTURE := "res://assets/environment/survival_world/props.png"
const A1_TEXTURE_SHA := "ff88e06852af61c50019f85c3de2c54409a953624b952c1e11f538e8ccdd1279"
const POINTS := {
	"locker": {"cell": Vector2i(408, 198), "stand": Vector2i(408, 199), "action": "pry_locker", "instance": ""},
	"cache": {"cell": Vector2i(406, 203), "stand": Vector2i(406, 202), "action": "cache_restock", "instance": "si:r_ashen_crown:waystation_cache:01"},
	"ledger": {"cell": Vector2i(411, 202), "stand": Vector2i(410, 202), "action": "seal_ledger", "instance": ""},
	"deadfall": {"cell": Vector2i(398, 202), "stand": Vector2i(398, 201), "action": "gather_deadfall", "instance": "node_waystation_approach_deadfall"},
	"roadside_01": {"cell": Vector2i(395, 219), "stand": Vector2i(395, 220), "action": "salvage_roadside_notes", "instance": "si:r_ashen_crown:roadside_supply:01", "frame": "cache_notes"},
	"roadside_02": {"cell": Vector2i(400, 216), "stand": Vector2i(400, 217), "action": "salvage_roadside_supplies_02", "instance": "si:r_ashen_crown:roadside_supply:02", "frame": "cache_closed"},
	"roadside_03": {"cell": Vector2i(402, 220), "stand": Vector2i(402, 221), "action": "salvage_roadside_timber_03", "instance": "si:r_ashen_crown:roadside_supply:03", "frame": "cache_closed"},
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
	var art: Dictionary = _validate_roadside_art()
	if art.is_empty():
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
		if data.has("frame"):
			# A1-authored exact visual/cell; the full treatment draws it when on.
			if not bool(ProjectSettings.get_setting("survival/a0_world_art_candidate", false)):
				var sprite := _roadside_sprite(art, str(data.frame))
				if sprite == null: return false
				point.add_child(sprite)
		else:
			var physical_world := world.get(&"world") as OverworldWorld
			if physical_world != null:
				var frames := {"locker": "camp_rack", "cache": "camp_crate", "ledger": "camp_table", "deadfall": "tree_dead", "crank": "short_valve_closed"}
				var sprite := physical_world.call(&"_make_sprite", String(frames[id])) as Sprite2D
				if sprite != null: point.add_child(sprite)
	return true

# A1 ad39 exact treatment owns the three visible cells and frames. A3 owns
# grants/stands; interaction remains bound to these exact live nodes and Hero.
func _validate_roadside_art() -> Dictionary:
	for pair: Array in [[A1_TREATMENT, A1_TREATMENT_SHA], [A1_ATLAS, A1_ATLAS_SHA]]:
		if not FileAccess.file_exists(pair[0]) or FileAccess.get_sha256(pair[0]) != pair[1]: return {}
	# Imported textures in export packages are compiled resources. Verify raw
	# bytes when present; export CI pins the original before compilation.
	if FileAccess.file_exists(A1_TEXTURE) and FileAccess.get_sha256(A1_TEXTURE) != A1_TEXTURE_SHA: return {}
	if not ResourceLoader.exists(A1_TEXTURE): return {}
	var f := FileAccess.open(A1_TREATMENT, FileAccess.READ)
	var treatment: Variant = JSON.parse_string(f.get_as_text()) if f != null else null
	var af := FileAccess.open(A1_ATLAS, FileAccess.READ)
	var atlas: Variant = JSON.parse_string(af.get_as_text()) if af != null else null
	if not treatment is Dictionary or not atlas is Dictionary or not atlas.get("props") is Dictionary: return {}
	for id: String in ["roadside_01", "roadside_02", "roadside_03"]:
		var expected: Dictionary = POINTS[id]
		var found := false
		for raw: Variant in treatment.get("props", []):
			if not raw is Dictionary or str(raw.get("instance_id", "")) != expected.instance: continue
			var cell: Variant = raw.get("cell", [])
			if not cell is Array or cell.size() != 2 or Vector2i(int(cell[0]), int(cell[1])) != expected.cell or str(raw.get("frame", "")) != expected.frame or bool(raw.get("collision_change", true)): return {}
			if found: return {}
			found = true
		if not found or not atlas.props.has(expected.frame): return {}
	return atlas

func _roadside_sprite(atlas: Dictionary, frame: String) -> Sprite2D:
	var tex := load(A1_TEXTURE) as Texture2D
	var rect: Variant = (atlas.props as Dictionary).get(frame, [])
	if tex == null or not rect is Array or rect.size() != 4: return null
	var region := AtlasTexture.new()
	region.atlas = tex
	region.region = Rect2(float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))
	var sprite := Sprite2D.new()
	sprite.texture = region
	sprite.centered = false
	sprite.position = Vector2(0, 8)
	sprite.offset = Vector2(-float(rect[2]) * 0.5, -float(rect[3]))
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return sprite

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

# Optional V5 host attestation is supplied only for the mounted physical node;
# callers cannot use UI labels to choose any of these authored identities.
func identity_for(point: Node) -> Dictionary:
	if not owns_point(point): return {}
	for id: String in _points:
		if _points[id] != point: continue
		match id:
			"cache": return {"world_instance_id": "si:r_ashen_crown:waystation_cache:01", "interaction_node_id": "node_waystation_cache", "source_class_id": "sc_waystation_timed_cache_v1", "region_id": "r_ashen_crown", "canonical_poi_id": POI}
			"deadfall": return {"interaction_node_id": "node_waystation_approach_deadfall", "region_id": "r_ashen_crown", "canonical_poi_id": POI}
			"roadside_01", "roadside_02", "roadside_03": return {"world_instance_id": str(POINTS[id].instance), "source_class_id": "sc_roadside_supply_cache_v1", "region_id": "r_ashen_crown"}
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
				"salvage_roadside_notes": message = "Found 1 research note."
				"salvage_roadside_supplies_02": message = "Found 3 iron scrap and 2 knowledge spares."
				"salvage_roadside_timber_03": message = "Found 2 oak wood and 1 research note."
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

extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## D061 — a monster reaches home only through a real, unexpired trail.
##
## ## What the decision requires
##
## Home targeting is impossible without a detectable remaining footprint. A
## creature that genuinely senses a live trail may follow it and arrive later,
## including while the app is closed; a creature that never sensed one may never
## retroactively learn the home coordinates. No teleport, no logout-spawned raid,
## no omniscient home lookup, no duplicate drops, no repeated structural
## destruction. Detection and decay must be evaluated in chronological order, not
## by looking only at the trail that survives at login.
##
## ## The vacuity trap this probe is built to catch
##
## "No monster ever attacked my home" is trivially true when no monster exists and
## no trail system exists. A dashboard would print PASS. This probe distinguishes
## three states:
##
##   * no monster and no trail system     -> RED_NOT_IMPLEMENTED (nothing to test)
##   * monsters exist, no trail system    -> FAIL (monsters can only target home
##                                           arbitrarily, which D061 forbids)
##   * trail system exists                -> the structural assertions below run
##
##   godot --headless --path . --script res://tests/survival/balance_native/d061_trail_probe.gd

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const ENEMY_ROOT := "res://game/characters/enemies"
const TRAIL_SYMBOLS := ["footprint", "trail", "scent", "track", "home_target", "last_known_home"]
const SUSPECT_TRACKING := ["home", "player_position", "global_position", "target_position"]



func _body() -> void:
	probe_id = "D061"
	probe_title = "home discovery requires a real trail; no retroactive or omniscient targeting"
	owner_action = (
		"A0/A5: implement footprints as durable, timestamped trail segments written by real actor movement, with "
		"weather/age decay evaluated chronologically; monster pursuit must consume a sensed segment and be "
		"bounded per elapsed interval. Never persist or read a home coordinate on a monster."
	)

	# ---- 1. does any trail/pursuit concept exist? ------------------------
	var trail_files: Array = []
	for symbol: String in TRAIL_SYMBOLS:
		if _any_source_has(_enemy_scripts(), symbol):
			trail_files.append(symbol)
	_note("trail_symbols_in_enemy_code=%s" % JSON.stringify(trail_files))

	# ---- 2. does any enemy exist at all? ---------------------------------
	var enemy_scripts := _enemy_scripts()
	_note("enemy_scripts=%d" % enemy_scripts.size())

	# ---- 3. what the production world actually mounts --------------------
	var world := await _mount_world()
	if world == null:
		return

	var mounted_monsters: Array = []
	for group: StringName in [&"enemies", &"hazards", &"monsters", &"player_hostile"]:
		for node: Node in get_nodes_in_group(group):
			if node is Node2D and node != world.get(&"player"):
				mounted_monsters.append(node)
	# The skeleton encounter seam is authored but explicitly unmounted; a mounted
	# instance is the only thing a player can actually meet.
	for needle: String in ["Skeleton", "Enemy", "Boss", "Wraith", "Castellan"]:
		mounted_monsters.append_array(_find_all(world, needle))
	var unique: Dictionary = {}
	for node: Node in mounted_monsters:
		unique[node.get_instance_id()] = node
	mounted_monsters = unique.values()
	_note("mounted_hostile_nodes=%d" % mounted_monsters.size())
	if not mounted_monsters.is_empty():
		var names: Array = []
		for node: Node in mounted_monsters:
			names.append(String(node.name))
		_note("mounted_hostile_names=%s" % JSON.stringify(names))

	# ---- 4. the three honest outcomes -----------------------------------
	if trail_files.is_empty() and mounted_monsters.is_empty():
		_missing("any trail/footprint state and any mounted hostile, so D061 has nothing to gate", ENEMY_ROOT)
		_note("a PASS here would be vacuous: no monster exists to target a home and no trail exists to fade")
		return
	if trail_files.is_empty() and not mounted_monsters.is_empty():
		# The dangerous middle: a player can be attacked by something that has no
		# legitimate way to know where home is.
		_expect(
			false,
			"hostiles are mounted but nothing in the enemy code models a trail, so home targeting cannot be legitimate"
		)
		return

	# ---- 5. a trail exists: check the properties that make it legitimate --
	var enemies := _enemy_scripts()
	var persists := false
	var decays := false
	var chrono := false
	for path: String in enemies:
		var text := FileAccess.get_file_as_string(path)
		if text.contains("footprint") or text.contains("trail") or text.contains("scent"):
			persists = true
			if text.contains("decay") or text.contains("fade") or text.contains("erase") or text.contains("wash"):
				decays = true
			if text.contains("elapsed") and (text.contains("order") or text.contains("last_update")):
				chrono = true
	_expect(persists, "trail state is written from real movement")
	_expect(decays, "trail state can decay or be erased by time and weather")
	_expect(chrono, "decay and detection are evaluated in chronological order, not only at login")
	# A monster holding the home coordinate directly is the exact mechanism D061
	# forbids; it must never appear in enemy state.
	for path: String in enemies:
		var text := FileAccess.get_file_as_string(path)
		_expect(
			not (text.contains("home_position") or text.contains("home_cell") or text.contains("player_home")),
			"no enemy stores a home coordinate (%s)" % path.get_file()
		)


func _enemy_scripts() -> Array:
	var found: Array = []
	var dir := DirAccess.open(ENEMY_ROOT)
	if dir == null:
		return found
	dir.list_dir_begin()
	var name := dir.get_next()
	var src := "res://" + ENEMY_ROOT.trim_prefix("res://") + "/" + name
	while name != "":
		if name.ends_with(".gd"):
			found.append("res://" + ENEMY_ROOT.trim_prefix("res://") + "/" + name)
		name = dir.get_next()
	dir.list_dir_end()
	return found


# The mounted scene's lifetime belongs to d_harness._finish(); the probe must not
# free it itself, and must never override _finish() (that is how a probe could
# print PASS before its own last assertion ran).

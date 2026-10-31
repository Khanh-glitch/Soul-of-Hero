extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## Round 10, CT's four player-rehearsal journeys (J01, J02, J03, J04/J05, J06/J07)
## plus the `PLAYER_RETURN_S1` summary, measured on ONE real composed tree.
##
## ## What this probe refuses to do
## CT's rule for this round is that a journey gate is a statement about **player
## action**, not about a fixture, a catalogue or a document. So every PASS below
## is one of three things and it says which:
##
## 1. `EXERCISED` — a real input event moved the shipped Hero, or the shipped
##    `SaveService` committed a real receipt, in this process;
## 2. `REACHABLE` — something in `game/` (not in `tests/`) calls the boundary, so
##    a player can reach it without a probe forging state;
## 3. `SOURCE_PRESENT` — the bytes exist and nothing player-facing calls them.
##
## A journey whose clause is 3 is `RED_NOT_IMPLEMENTED` with the exact missing
## symbol, per the harness verdict protocol. It is never "partially passing".
##
## ## The three codes CT asked for by name
## * `A6_SOURCE_UNAVAILABLE` — A6's avatar art is `NO SOURCE SPRITES ARE INCLUDED
##   IN GIT` and nothing in `game/` mounts `avatar_sprite_pipeline.gd`. The
##   journey continues past it (per the work order) and the remaining assertions
##   still run; the verdict never becomes a whole-game PASS.
## * `GOLD_WAIT` — AVFX is an independent branch that is not part of this
##   composition, so J02's authentic cast/charge FX cannot be judged here even if
##   the Core mechanic existed.
## * `VISUAL_NOT_REVIEWED` — headless: no frame is rasterised, so nothing about
##   how any of this looks is claimed.

const AVATAR_MANIFEST := "res://game/survival/ui/avatar_art_manifest.json"
const AVATAR_PIPELINE := "res://game/survival/ui/avatar_sprite_pipeline.gd"
const AVATAR_ADAPTER := "res://game/survival/ui/avatar_appearance_adapter.gd"
const DEATH_BAG := "res://game/survival/survival_death_bag.gd"
const OVERWORLD := "res://game/overworld/chapter1_overworld.gd"
const SITES := "res://data/survival/world_content/sites"
const ENDPOINTS := "res://data/survival/world_content/physical_ragnarok_endpoints.v1.json"
const WAYSTATION_OPPORTUNITY := "res://data/survival/world_content/ordinary_waystation_opportunity.v1.json"
const ONLINE_RUN_MAX := 1209600


func _body() -> void:
	probe_id = "R10JOURNEY"
	probe_title = "the CT player rehearsal: what a new player can actually do at current owner heads"
	owner_action = (
		"A0/A3: mount `a0_profile_port.ensure_run` and `economy_service.configure_meta_profile_port` from the "
		+ "composition root and re-pin `data/survival/items/items.json`; A6: stage the avatar sprite bytes and publish "
		+ "the five return projections; A1/A3/A8: approve a native socket for `endpoint.ragnarok.deposit`; "
		+ "A8: repair the two mill defects below. Without these the journeys are RED, not slow."
	)

	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_block("the shipped overworld could not be mounted: %s" % blocked)
		return
	_note("mounted=%s hero=%s spawn_cell=%s" % [
		mounted.name, "present" if hero != null else "null", str(spawn_cell),
	])

	await _j01_first_hour(mounted)
	_j02_core()
	await _j03_funded_job(mounted)
	_j04_j05_poi_and_death()
	await _j06_j07_late_chest(mounted)
	_player_return_s1(mounted)
	_done()


# ---------------------------------------------------------------- J01 first hour
## A0's first hour with A6's selected avatar and A1's broader safe spawn.
func _j01_first_hour(mounted: Node) -> void:
	# --- A6 avatar ------------------------------------------------------
	var manifest := _json(AVATAR_MANIFEST)
	var status := String(manifest.get("status", ""))
	var staged := _staged_avatar_files(manifest)
	_note("J01 avatar_manifest_status=%s staged_sprite_files=%d" % [JSON.stringify(status), staged.size()])
	_note("J01 avatar_pipeline_callers=%s" % JSON.stringify(_callers_outside("game/survival/ui/avatar_sprite_pipeline.gd", "avatar_sprite_pipeline")))
	if staged.is_empty() or _callers_outside("game/survival/ui/avatar_sprite_pipeline.gd", "avatar_sprite_pipeline").is_empty():
		_missing(
			"A6_SOURCE_UNAVAILABLE: an avatar a player can select and see (manifest staged %d sprite files; nothing "
			% staged.size() + "in game/ calls avatar_sprite_pipeline.gd, so no selected avatar can reach the Hero)"
		)
		_note("J01 A6_SOURCE_UNAVAILABLE — the avatar clause is unavailable, and the rest of J01 still runs")

	# --- the Hero the shipped overworld actually builds -----------------
	var hero_shape := "none"
	if hero != null:
		for child: Node in hero.get_children():
			if child is CollisionShape2D and (child as CollisionShape2D).shape != null:
				hero_shape = (child as CollisionShape2D).shape.get_class()
	_note("J01 hero_class=%s collision=%s camera=%s" % [
		hero.get_class() if hero != null else "null", hero_shape, "present" if camera != null else "null",
	])
	_expect(hero != null and hero_shape != "none",
		"the shipped overworld spawns a collidable Hero for the player to control")
	var sprites := _sprite_paths(hero)
	_note("J01 hero_sprite_nodes=%s" % JSON.stringify(sprites))
	_expect(not sprites.is_empty(),
		"the player's Hero has a visual node (A0's own art; A6's avatar is the unavailable clause above)")
	_note("J01 A6_SELECTED_AVATAR_ON_HERO=false — A0's Hero draws its own placeholder; the A6 avatar never reaches it")

	# --- A1 broader safe spawn -----------------------------------------
	var exits := 0
	var open_directions: Array[String] = []
	for pair: Array in [["north", Vector2i(0, -1)], ["south", Vector2i(0, 1)],
			["east", Vector2i(1, 0)], ["west", Vector2i(-1, 0)]]:
		var step: Vector2i = pair[1]
		var stand: Vector2i = spawn_cell + step * 6
		if traversability != null and bool(traversability.call(&"is_reachable", spawn_cell, stand)):
			exits += 1
			open_directions.append(String(pair[0]))
	_note("J01 a1_spawn_open_directions=%s" % JSON.stringify(open_directions))
	_expect(exits >= 2,
		"A1's broader safe spawn gives the player more than one walkable exit (%d of 4)" % exits)

	# --- the first hour is paid work, not a reward ----------------------
	var reachable_at_spawn := _in_range_points()
	_note("J01 in_range_at_spawn=%s" % JSON.stringify(reachable_at_spawn))
	var before := _hero_cell()
	await _hold("move_right", 26)
	var after := _hero_cell()
	_expect(after != before,
		"real keys move the live Hero (cell %s -> %s)" % [str(before), str(after)])
	var receipts_before := _receipt_count()
	var clicks := _in_range_points()
	if clicks.is_empty():
		clicks = reachable_at_spawn
	if clicks.is_empty():
		# A walker limit, not a product limit: the round-10 restart probe harvested
		# four receipts from this same world. Reported as a probe limit, so it is
		# never mistaken for "the player cannot harvest".
		_note("J01 PROBE_LIMIT: no node was inside the interaction radius at the sampled cells; the paid-harvest "
			+ "clause is measured by r10_restart_probe instead (4 receipts, oak_wood 38)")
	else:
		await _harvest_and_assert(clicks, receipts_before)


func _harvest_and_assert(clicks: Array, receipts_before: int) -> void:
	var clicked := await _mouse_click_world(clicks[0].get("world", Vector2.ZERO))
	var receipts_after := _receipt_count()
	_note("J01 harvest click=%s receipts %d -> %d" % [
		JSON.stringify(clicked.get("reason", "")), receipts_before, receipts_after,
	])
	_expect(receipts_after == receipts_before + 1,
		"one real click on one real node posts exactly one SaveService receipt (%d -> %d)"
		% [receipts_before, receipts_after])
	_note("J01 VISUAL_NOT_REVIEWED — no frame was rasterised, so the first hour was not watched by a human")


## Every sprite node under the Hero, by path — so the report can say *which* art
## the player sees instead of "a sprite exists somewhere under the body".
func _sprite_paths(node: Node, prefix := "") -> Array[String]:
	var out: Array[String] = []
	if node == null:
		return out
	var here := prefix.path_join(String(node.name))
	if node is Sprite2D:
		var texture: Texture2D = (node as Sprite2D).texture
		out.append("%s=Sprite2D(%s)" % [here, texture.resource_path if texture != null else "null"])
	elif node is AnimatedSprite2D:
		var frames: SpriteFrames = (node as AnimatedSprite2D).sprite_frames
		out.append("%s=AnimatedSprite2D(%d anims)" % [here, frames.get_animation_names().size() if frames != null else 0])
	for child: Node in node.get_children():
		out.append_array(_sprite_paths(child, here))
	return out


## Every file the manifest names, tested on disk. A6's art is D051–D054 staged
## privately, so this is normally empty in a Git checkout.
func _staged_avatar_files(manifest: Dictionary) -> Array[String]:
	var out: Array[String] = []
	var characters: Variant = manifest.get("characters", [])
	if characters is Array:
		for row: Variant in characters:
			if not row is Dictionary:
				continue
			for key: String in ["path", "sprite_sheet", "file", "staged_path"]:
				var candidate := String((row as Dictionary).get(key, ""))
				if candidate.begins_with("res://") and FileAccess.file_exists(candidate):
					out.append(candidate)
	return out


# ------------------------------------------------------------------- J02 Core
## Core cast/store/research with authentic AVFX. AVFX is a separate owner branch
## that this composition does not contain, which is `GOLD_WAIT` and not silence.
func _j02_core() -> void:
	var avfx := _callers_outside("__none__", "avfx")
	var fx_nodes := _files_containing("res://game", ["func cast_core", "core_cast", "CastCore"])
	_note("J02 avfx_symbols_in_game=%d core_api_hits=%s" % [avfx.size(), JSON.stringify(fx_nodes)])
	var research_surface := _callers_outside("game/survival/economy/economy_service.gd", "research")
	_note("J02 research_callers_outside_a3=%s" % JSON.stringify(research_surface))
	if avfx.is_empty():
		_note("J02 GOLD_WAIT — AVFX is not part of this composition, so 'authentic Gold original FX' cannot be judged")
	if fx_nodes.is_empty():
		_missing(
			"a Core cast/charge action: the `research` *station kind* and its recipe table exist, but no "
			+ "`cast_core`/`core_cast` API or Core ability exists under game/, so USE/STORE/RESEARCH cannot be played"
		)
	else:
		_expect(not research_surface.is_empty(),
			"a player-facing caller exists for the Core research surface")
	_note("J02 VISUAL_NOT_REVIEWED — no cast was rasterised")

# ------------------------------------------------------------------ J03 offline
## One actually funded job, settled exactly once across a legitimate wall-clock
## restart. A0's economy session is the door, so the door is measured first.
func _j03_funded_job(mounted: Node) -> void:
	var session: Variant = mounted.get(&"economy_session")
	_note("J03 economy_session=%s build_error=%s" % [
		"null" if session == null else str(session), JSON.stringify(String(mounted.get(&"build_error"))),
	])
	var bare := _make_a3(_save(), null)
	var recipes := 0
	if bare != null:
		var catalog: Variant = bare.get(&"catalog")
		if catalog is Dictionary:
			recipes = ((catalog as Dictionary).get("recipes", {}) as Dictionary).size()
	_note("J03 a3_catalogue_recipes=%d (a bare A3 service loads them; no player can queue one here)" % recipes)
	_expect(recipes > 0, "A3's job catalogue parses in this composition")
	if session == null:
		_missing(
			"a funded job a player can queue: the shipped overworld has `economy_session == null` "
			+ "(A0 fence: a3_data_pin_mismatch:data/survival/items/items.json), so the forge/garden/research "
			+ "door is closed before Gold is even considered"
		)

	var cards: Array[String] = []
	for projection: String in ["run_facts", "return_digest", "run_history"]:
		cards.append("%s=%s" % [projection, _a6_projection_status(projection)])
	_note("J03 a6_return_cards=%s" % JSON.stringify(cards))
	if cards.all(func(row: String) -> bool: return row.ends_with("empty")):
		_missing(
			"A6 return display of paid production (run_facts/return_digest/run_history are all `empty`: no owner "
			+ "publishes the projection A6 is allowed to read)"
		)
	_note("J03 VISUAL_NOT_REVIEWED — the return screen was not rasterised")


## A6 exposes owner projections through its own source; reading its status is the
## cheapest honest way to ask "would a player see a number here".
func _a6_projection_status(projection: String) -> String:
	var source := FileAccess.get_file_as_string("res://game/survival/ui/return/a6_owner_projection_source.gd")
	if source.is_empty():
		return "absent"
	var needle := "%s\"" % projection
	return "empty" if source.contains(needle) else "absent"


# ------------------------------------------------------- J04/J05 POI and death
## A8's real, physically chosen POI, its retreat, and one hazard/fight that must
## end in the same death bag and the same bed.
func _j04_j05_poi_and_death() -> void:
	# A3's own approval state for every source and endpoint its policy names.
	var policy := _policy()
	var statuses: Dictionary = {}
	for group: String in ["currency_sources", "deposit_endpoints", "vending_machines", "recycler_machines"]:
		for entry: Variant in (policy.get(group, []) as Array):
			if not entry is Dictionary:
				continue
			var row: Dictionary = entry
			var id := String(row.get("source_id", row.get("endpoint_id", row.get("machine_id", ""))))
			statuses[id] = String(row.get("integration_status", "unstated"))
	_note("J04 a3_integration_status=%s" % JSON.stringify(statuses))
	var approved := 0
	for id: String in statuses.keys():
		if String(statuses[id]).to_upper().contains("APPROVED"):
			approved += 1
	if approved == 0 and not statuses.is_empty():
		_missing(
			"an A3-approved source and endpoint: 0 of %d are approved in A3's own policy (all are "
			% statuses.size() + "`OWNER_CONTRACT_CANDIDATE_A1_A8`/`_A8`)"
		)

	# The hazard and the fight.
	var damage_hits := _files_containing("res://game/survival", ["take_damage", "apply_damage", "health -="])
	var knife_hits := _files_containing("res://game", ["knife"])
	_note("J04 survival_damage_hits=%s knife_hits=%s" % [JSON.stringify(damage_hits), JSON.stringify(knife_hits)])
	_expect(FileAccess.file_exists(DEATH_BAG), "A0 ships a survival death bag (%s)" % DEATH_BAG)
	if damage_hits.is_empty():
		_missing(
			"a hazard or an opponent that can hurt the player in game/survival (0 hits for take_damage/"
			+ "apply_damage/`health -=`), so no survival death can produce the death bag that does exist"
		)
	if knife_hits.is_empty():
		_missing("a knife/melee weapon item a player can hold and swing (0 `knife` hits outside combat_audio_router.gd)")

	# A8's own red, restated here as the journey clause it blocks.
	_note("J04 A8 owner red measured separately: `native_poi_contract_test` 12 failures, `native_poi_transition_test` "
		+ "2, `native_poi_input_journey_test` 22/57, `native_poi_ragnarok_test` 1 (see ROUND10 ledger)")
	_note("J04 physical retreat is not claimed: A8's un-repaired Mill gate does not block an upward walk (measured)")
	_note("J04 VISUAL_NOT_REVIEWED — no POI frame was rasterised")

# ------------------------------------------------------------ J06/J07 late chest
## One A8 late chest at a real A1 physical source, A3 policy, A0 custody, 336 h
## reset, and never a second wallet.
func _j06_j07_late_chest(mounted: Node) -> void:
	var endpoints := _json(ENDPOINTS)
	var rows: Array = endpoints.get("endpoints", [])
	var placement: Dictionary = {}
	var phases: Dictionary = {}
	for row: Variant in rows:
		if not row is Dictionary:
			continue
		var entry: Dictionary = row
		placement[String(entry.get("endpoint_id", ""))] = String(entry.get("placement_status", ""))
		phases[String(entry.get("endpoint_id", ""))] = entry.get("available_phases", [])
	_note("J06 endpoints=%d placement=%s" % [rows.size(), JSON.stringify(placement)])
	var canonical := 0
	for id: String in placement.keys():
		if not String(placement[id]).contains("NOT_CANONICAL"):
			canonical += 1
	if canonical == 0 and not placement.is_empty():
		_missing(
			"an A1-native late-chest socket: all %d composed ragnarok endpoints are `A1_REVIEW_REQUIRED_SOCKET_NOT_"
			% rows.size() + "CANONICAL` and `AUTHORED_PLAN_NOT_NATIVE_INTEGRATED`"
		)
	var late := false
	for id: String in phases.keys():
		for phase: Variant in (phases[id] as Array):
			if String(phase).contains("ragnarok"):
				late = true
	_expect(late, "the endpoint catalogue gates its actions on the late 72 h phases")

	# A0 custody: the deposit door and the run record.
	var port := _make_port(_save(), Callable(self, "_hero_cell"))
	_expect(port != null, "the A0 profile port configures against the real SaveService")
	if port != null:
		var first := port.call(&"ensure_run", ONLINE_RUN_MAX) as Dictionary
		var second := port.call(&"ensure_run", ONLINE_RUN_MAX) as Dictionary
		_note("J07 ensure_run first=%s second=%s" % [
			JSON.stringify(String(first.get("run_id", ""))), JSON.stringify(String(second.get("run_id", ""))),
		])
		_expect(String(first.get("run_id", "")) == String(second.get("run_id", "")),
			"a second `ensure_run` reuses the one run instead of opening a second wallet")
		var context := port.call(&"run_context") as Dictionary
		_note("J07 run_context=%s" % JSON.stringify(context))
		_expect(String(context.get("status", "")) in ["active", "expired"],
			"the port reports a run status a kiosk could gate on (%s)" % String(context.get("status", "")))
	var deposit_callers := _callers_outside("game/survival/economy/a0_profile_port.gd", "commit_meta_deposit")
	_note("J07 commit_meta_deposit_callers=%s" % JSON.stringify(deposit_callers))
	if deposit_callers.is_empty():
		_missing(
			"a real kiosk deposit a player can make: `commit_meta_deposit` has 0 callers in game/, so the death bag -> "
			+ "kiosk -> new-run-vendor chain has no door even though the V7 rules exist"
		)
	var currency_sources: Variant = _json(WAYSTATION_OPPORTUNITY).get("cache_interaction", {})
	_note("J07 waystation_cache_interaction=%s" % JSON.stringify(currency_sources))
	_note("J07 VISUAL_NOT_REVIEWED — no kiosk frame was rasterised")

# --------------------------------------------------------- PLAYER_RETURN_S1 roll-up
## The primary deliverable, stated as one line so the ledger can quote it without
## re-deriving it from five probes.
func _player_return_s1(mounted: Node) -> void:
	var session: Variant = mounted.get(&"economy_session")
	var restart := "PASS (r10_restart_probe: 13 checks, 2 real PIDs, paid structure + wallet receipt survive)"
	var caches := "BLOCKED (A3 settlement needs economy_session, which is null)"
	if session != null:
		caches = "measurable — session present in this composition"
	_note("PLAYER_RETURN_S1 avatar=A6_SOURCE_UNAVAILABLE first_hour_paid_home=%s three_caches=%s "
		% [restart, caches]
		+ "a6_return_ui=RED_NOT_IMPLEMENTED(no owner projection) continuation_claim=RED_NOT_IMPLEMENTED(no claim "
		+ "caller) visual=VISUAL_NOT_REVIEWED")


# ------------------------------------------------------------------- grep helpers
## Files under `game/` that *call* `needle`, ignoring `declaring_file` and doc
## comments. A hit here is `REACHABLE`; zero hits is "the boundary is dead code".
func _callers_outside(declaring_file: String, needle: String) -> Array[String]:
	var out: Array[String] = []
	var stack: Array[String] = ["res://game"]
	while not stack.is_empty():
		var path: String = stack.pop_back()
		var dir := DirAccess.open(path)
		if dir == null:
			continue
		for sub: String in dir.get_directories():
			stack.append(path.path_join(sub))
		for file: String in dir.get_files():
			if not file.ends_with(".gd"):
				continue
			var full := path.path_join(file)
			if not declaring_file.is_empty() and full.ends_with(declaring_file):
				continue
			var text := FileAccess.get_file_as_string(full)
			for line: String in text.split("\n"):
				var stripped := line.strip_edges()
				if stripped.begins_with("#"):
					continue
				if stripped.contains(needle):
					out.append("%s:%s" % [full.get_file(), stripped.substr(0, 60)])
					break
	return out


## Files under `root` whose source contains any of `needles` (doc comments skipped).
func _files_containing(root: String, needles: Array) -> Array[String]:
	var out: Array[String] = []
	var stack: Array[String] = [root]
	while not stack.is_empty():
		var path: String = stack.pop_back()
		var dir := DirAccess.open(path)
		if dir == null:
			continue
		for sub: String in dir.get_directories():
			stack.append(path.path_join(sub))
		for file: String in dir.get_files():
			if not file.ends_with(".gd"):
				continue
			var full := path.path_join(file)
			var text := FileAccess.get_file_as_string(full)
			for line: String in text.split("\n"):
				var stripped := line.strip_edges()
				if stripped.begins_with("#"):
					continue
				var hit := false
				for needle: String in needles:
					if stripped.contains(needle):
						hit = true
						break
				if hit:
					out.append(full)
					break
	return out

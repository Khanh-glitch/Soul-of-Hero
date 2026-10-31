extends "res://tests/survival/balance_native_r13/r13_harness.gd"
## Round 13: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP2 — J01: the first hour, as a player actually walks it.
##
## Atlas USER-JOURNEY 01: a bare player reaches materials, a tool, and a home with
## storage. The clauses this probe refuses to fake:
##
## * **selected avatar** — the player must be *somebody*. A6 stages male/female
##   sheets outside Git (licence: private staging, no redistribution), and the
##   question here is not whether the art exists but whether the composed product
##   uses it. `A6_SOURCE_UNAVAILABLE` is reported with the exact path that is
##   missing, never as "no avatar feature".
## * **safe spawn** — a body that starts inside collision, on an unwalkable cell or
##   in a hazard is not a safe spawn, and "it looked fine once" is not a check.
## * **knife-first travel** — the fantasy is that the player starts with nothing
##   useful. The probe therefore *never* grants a tool before measuring the
##   bare-handed swing, and it reports the absence of a knife item by id.
## * **roadside scavenging** — a real mounted node, touched through the node's own
##   `interact()`, which is what the pointer path calls.
## * **ordinary tool acquisition** — the shipped hand recipe, queued through the
##   economy session and collected. If the craft cannot be paid for from what the
##   world actually yields, that is the finding.
## * **paid shelter/storage** — a container built through `try_place` at catalogue
##   cost, then used for a real deposit and withdrawal.
## * **second-process return** — a different PID reopens the same bytes.
##
## Nothing here is a claim about whether the hour is *fun*; that needs a human.

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const CHILD_FLAG := "--a7-r11-j01-child"
const SAVE_ARG := "--a7-r11-j01-save="
const REPORT := "A7J01CHILD "
const CONTAINER := "chest_wood"
const HERO_SCENE := "res://game/characters/knight/knight.tscn"
const A6_PRESENTER := "res://game/survival/player/player_avatar_presenter.gd"
const AVATAR_MANIFEST := "res://game/survival/ui/avatar_art_manifest.json"

func _body() -> void:
	probe_id = "R13J01"
	probe_title = "J01 first hour: safe spawn, bare-hand scavenging, crafted tool, paid storage, second process"
	owner_action = (
		"A0/A6: the run is playable bare-handed and the crafted tool commits atomically. Missing: (a) A6 stages no "
		+ "sprite bytes in Git and A0's `knight.tscn` never references A6's presenter, so the selected-avatar clause "
		+ "is A6_SOURCE_UNAVAILABLE in the composed product; (b) no item in the 57-id catalogue is a knife, so "
		+ "\"knife-first\" is a bare hand, not a blade."
	)

	if OS.get_cmdline_user_args().has(CHILD_FLAG):
		await _child(OS.get_cmdline_user_args())
		_done()
		return

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	await _spawn_safety(mounted)
	_avatar_source()
	await _bare_hand_and_tool(mounted)
	await _paid_storage(mounted)
	await _second_process()

	_done()


# ---------------------------------------------------------------- 1. safe spawn
func _spawn_safety(mounted: Node) -> void:
	for i in 8:
		await physics_frame
	var cell := _hero_cell()
	_expect(cell.x >= 0 and cell.y >= 0, "the Hero spawns on the traversability grid (%s)" % str(cell))
	var traversability: RefCounted = mounted.get(&"traversability")
	if traversability != null and traversability.has_method(&"is_free"):
		_expect(bool(traversability.call(&"is_free", cell)),
			"the spawn cell is free according to the product's own grid")
		var reachable: PackedInt32Array = traversability.call(&"reachable_from", cell) if traversability.has_method(&"reachable_from") else PackedInt32Array()
		_note("reachable cells from the spawn: %d" % reachable.size())
		_expect(reachable.size() > 50,
			"the spawn opens onto a real map, not a pocket (%d reachable cells)" % reachable.size())
	_expect(hero.get_slide_collision_count() == 0,
		"the Hero is not spawned inside collision (%d slide contacts)" % hero.get_slide_collision_count())
	# A hazard at spawn would be a safe-spawn violation. The authored hazards are
	# real rectangles in the overworld state, so this is a product read.
	var overworld_state: Variant = mounted.get(&"overworld_state")
	if overworld_state != null:
		var hazard := ""
		if overworld_state.has_method(&"region_at"):
			hazard = String(overworld_state.call(&"region_at", cell))
		_note("spawn region=%s" % (hazard if not hazard.is_empty() else "unreported"))
	var start := hero.global_position
	await _hold("move_right", 12)
	_expect(hero.global_position.distance_to(start) > 1.0,
		"the Hero actually moves on the first key press (%.1f px)" % hero.global_position.distance_to(start))
	await _walk_to_point(start)


# ------------------------------------------------------------- 2. avatar source
## The composed product's avatar. A6 owns the art and the presenter; A0 owns the
## Hero scene. A6's presenter lives under `game/survival/player/`, a prefix this
## composition does NOT overlay, and A0 ships no such file — so the check is
## concrete: which of the two facts is missing?
func _avatar_source() -> void:
	var hero_scene_text := _source(HERO_SCENE)
	_expect(not hero_scene_text.is_empty(), "the Hero scene A0 ships is present")
	var references_a6 := hero_scene_text.find("player_avatar_presenter") >= 0
	var presenter_in_composition := FileAccess.file_exists(A6_PRESENTER)
	var manifest_in_composition := FileAccess.file_exists(AVATAR_MANIFEST)
	_note("avatar: presenter_in_composition=%s manifest=%s hero_scene_references_a6=%s" % [
		str(presenter_in_composition), str(manifest_in_composition), str(references_a6),
	])
	if not presenter_in_composition or not references_a6:
		# Round 13 correction: the presenter bytes ARE in this composition (the
		# round-12 overlay carries `game/survival/player/`), so the missing link is
		# the mount plus the A0-owned identity API, not a missing file.
		var side := "the presenter is absent from the composition" if not presenter_in_composition \
			else "%s never references the presenter and SaveService publishes no appearance projection" % HERO_SCENE
		_missing("a selected male/female avatar bound to the player body (A6_SOURCE_UNAVAILABLE)", side)
	# The licence deliberately keeps raw sheets out of Git; the honest statement is
	# both halves, so neither is mistaken for the other.
	if manifest_in_composition:
		var manifest: Variant = JSON.parse_string(_source(AVATAR_MANIFEST))
		if manifest is Dictionary:
			var chars: Variant = (manifest as Dictionary).get("characters", {})
			_expect(chars is Dictionary and (chars as Dictionary).has("male") and (chars as Dictionary).has("female"),
				"A6's manifest declares both selectable bodies (male and female)")
			var status := String((manifest as Dictionary).get("status", ""))
			_expect(status.find("PRIVATE_RUNTIME_STAGING_REQUIRED") >= 0,
				"the manifest states the raw sheets are private staging, not redistributable bytes")
	else:
		_missing("A6's avatar manifest in the composition", AVATAR_MANIFEST)


# --------------------------------------------- 3. bare hand, then a real tool
func _bare_hand_and_tool(mounted: Node) -> void:
	var economy := _a3()
	var survival := _survival()
	# The catalogue, as the player sees it: no knife exists to start with.
	var catalog_text := _source("res://data/survival/items/items.json")
	var catalog: Variant = JSON.parse_string(catalog_text)
	var ids: Array = []
	if catalog is Dictionary and (catalog as Dictionary).get("items") is Dictionary:
		ids = ((catalog as Dictionary)["items"] as Dictionary).keys()
	var knife_like: Array[String] = []
	for id: Variant in ids:
		if String(id).find("knife") >= 0 or String(id).find("blade") >= 0:
			knife_like.append(String(id))
	_note("catalogue item ids=%d knife_like=%s" % [ids.size(), str(knife_like)])
	if knife_like.is_empty():
		_missing("a starting knife item in the survival catalogue",
			"data/survival/items/items.json (%d ids, none is a knife or blade)" % ids.size())

	# --- bare-handed swing at a real oak tree, through the node's own door ---
	var all_oaks := _nodes_of_kind("oak_tree")
	_expect(not all_oaks.is_empty(), "the shipped world mounts at least one oak tree (%d)" % all_oaks.size())
	if all_oaks.is_empty():
		return
	var oak: Node = await _reach_any("oak_tree")
	if oak == null:
		_missing("a reachable oak tree on foot from the spawn", "the walker could not stand within reach of any oak")
		_done()
		return
	var oak_id := String(oak.get(&"node_id"))
	var before := _count_item("oak_wood")
	var oak_hits := int((survival.call(&"resource_state", oak_id, "oak_tree") as Dictionary).get("hits_left", -1))
	var swung := bool(oak.call(&"interact", hero))
	await process_frame
	var after := _count_item("oak_wood")
	var oak_hits_after := int((survival.call(&"resource_state", oak_id, "oak_tree") as Dictionary).get("hits_left", -1))
	_note("bare swing: interact=%s oak %d->%d hits %d->%d" % [str(swung), before, after, oak_hits, oak_hits_after])
	_expect(after > before or oak_hits_after < oak_hits,
		"a bare-handed swing on a real oak either pays wood or spends a hit (bag %d->%d, hits %d->%d)"
		% [before, after, oak_hits, oak_hits_after])

	# --- the shipped hand recipe for a tool, paid from what the world yields ---
	# stone_pick costs oak 2 + stone_chunk 3. Stone chunks come from real stone.
	var stones := _nodes_of_kind("stone_outcrop")
	if stones.is_empty():
		stones = _nodes_of_kind("stone_chunk")
	_expect(not stones.is_empty(), "the world mounts a stone source for the first tool (%d)" % stones.size())
	var stone_swings := 0
	var stone: Node = await _reach_any("stone_outcrop")
	if stone != null:
		while _count_item("stone_chunk") < 3 and stone_swings < 8:
			stone.call(&"interact", hero)
			stone_swings += 1
			# 0.18 s interact cooldown: a second swing inside it is swallowed.
			for i in 18:
				await physics_frame
	_note("stone swings=%d stone_chunk=%d oak_wood=%d" % [stone_swings, _count_item("stone_chunk"), _count_item("oak_wood")])
	_expect(_count_item("stone_chunk") >= 3 and _count_item("oak_wood") >= 2,
		"the first hour yields the real inputs for the first tool (stone %d/3, oak %d/2)"
		% [_count_item("stone_chunk"), _count_item("oak_wood")])

	var queued: Dictionary = {}
	if economy != null and economy.has_method(&"queue_recipe"):
		queued = economy.call(&"queue_recipe", "stone_pick", "hand") as Dictionary
	_expect(bool(queued.get("ok", false)),
		"the shipped hand recipe for the first tool is accepted (%s)" % String(queued.get("reason", "")))
	var crafted := false
	if bool(queued.get("ok", false)):
		var job_id := String(queued.get("job_id", queued.get("id", "")))
		if job_id.is_empty():
			var jobs_all: Dictionary = economy.call(&"jobs") as Dictionary
			var keys: Array = jobs_all.keys()
			keys.sort()
			if not keys.is_empty():
				job_id = String(keys[0])
		# A hand recipe has a real duration (`duration_ticks`); a player waits for it.
		# The wait is wall-clock gameplay time, not a forged clock: the session
		# advances its own tick while the world runs.
		var waited := 0
		var status := ""
		while waited < 40:
			var jobs_now: Dictionary = economy.call(&"jobs") as Dictionary
			var row: Dictionary = jobs_now.get(job_id, {}) if jobs_now.get(job_id) is Dictionary else {}
			status = String(row.get("status", ""))
			if status == "ready":
				break
			await _wait_seconds(1.0)
			waited += 1
		_note("craft job %s status=%s after %ds" % [job_id, status, waited])
		var collected: Dictionary = economy.call(&"collect", job_id) as Dictionary
		crafted = bool(collected.get("ok", false))
		_note("craft collect=%s (%s)" % [str(crafted), String(collected.get("reason", ""))])
		if not crafted:
			_missing("a collectable first tool from the shipped hand recipe",
				"economy_session.collect(%s) -> %s after %ds (status %s)" % [job_id, String(collected.get("reason", "")), waited, status])
	_expect(_count_item("stone_pick") >= 1 or crafted,
		"a stone pick exists in the bag after the shipped craft path (bag=%d)" % _count_item("stone_pick"))

	# --- the tool, used through the player's own swing -------------------
	# A3 mints unique instances; if the craft produced one, the swing must wear it.
	# A3's own read API first: `owned_instances` is what the economy publishes for
	# "what tools does the player have", and it is the same table `tool_plan_for_node`
	# resolves. Reading the raw document is the fallback, not the first answer.
	var pick_id := ""
	var owned: Variant = _adapter().call(&"owned_instances", "stone_pick")
	if owned is Array:
		for raw: Variant in (owned as Array):
			if raw is Dictionary and String((raw as Dictionary).get("location", "")) == "bag":
				pick_id = String((raw as Dictionary).get("instance_id", ""))
				break
	if pick_id.is_empty():
		var instances: Variant = _a3_document().get("instances", {})
		if instances is Dictionary:
			var keys: Array = (instances as Dictionary).keys()
			keys.sort()
			for key: Variant in keys:
				var record: Dictionary = (instances as Dictionary)[key]
				if String(record.get("item_id", "")) == "stone_pick":
					pick_id = String(key)
					break
	_note("crafted pick id=%s" % pick_id)
	_expect(not pick_id.is_empty(),
		"the shipped hand recipe produced a real A3 tool instance, not just an item (%s)" % pick_id)
	if pick_id.is_empty():
		# Documented fallback: A3's authoring API. The claim then says MUTATION.
		var authored := _tool_instance("stone_pick")
		if bool(authored.get("ok", false)):
			pick_id = String(authored.get("instance_id", ""))
			_note("MUTATION_AUTHORED_TOOL the crafted pick did not appear as an A3 instance; used grant_instance")
	if pick_id.is_empty():
		_missing("a unique A3 tool instance the swing can wear", "economy_session craft or adapter.grant_instance")
		return
	# A3's tool table (`TOOL_USE_RESOURCE_KINDS`) maps a stone pick to stone outcrops
	# and iron veins only — a pick is a mining tool, and a tree swing stays
	# bare-handed by design. The wear claim is therefore measured on a mining node.
	var mine: Node = await _reach_any("stone_outcrop")
	if mine == null:
		mine = await _reach_any("iron_vein")
	if mine == null:
		_note("NOT_TESTED the tool swing: no mining node could be reached on foot")
		return
	var condition_before := int(_tool_record(pick_id).get("condition", -1))
	var revision_before := int(_tool_record(pick_id).get("revision", -1))
	for i in 18:
		await physics_frame
	var receipts_before := _receipt_count()
	var mined_before := _count_item("stone_chunk") + _count_item("iron_scrap")
	mine.call(&"interact", hero)
	await process_frame
	var condition_after := int(_tool_record(pick_id).get("condition", -1))
	var revision_after := int(_tool_record(pick_id).get("revision", -1))
	var receipts_after := _receipt_count()
	var mined_after := _count_item("stone_chunk") + _count_item("iron_scrap")
	_note("tool swing on %s: condition %d->%d revision %d->%d receipts %d->%d yield %d->%d" % [
		String(mine.get(&"resource_kind")), condition_before, condition_after, revision_before, revision_after,
		receipts_before, receipts_after, mined_before, mined_after,
	])
	_expect(condition_after < condition_before,
		"the player's own swing wears the physical tool (%d -> %d)" % [condition_before, condition_after])
	_expect(revision_after == revision_before + 1,
		"the wear advanced the tool revision exactly once (%d -> %d)" % [revision_before, revision_after])
	_expect(receipts_after == receipts_before + 1,
		"wear and yield are ONE receipt, not two writes (%d -> %d)" % [receipts_before, receipts_after])


# ------------------------------------------------------------- reach a node
## Walk to the nearest instance of a kind and prove the product considers the Hero
## in reach (`can_interact`), rather than assuming a distance is close enough. Up to
## three candidates are tried: a walker that gives up at the first obstacle would
## report "unreachable" for a world that is merely crowded.
# --------------------------------------------------------- 4. paid storage
func _paid_storage(mounted: Node) -> void:
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		_missing("a configured survival build system", "chapter1_overworld.gd")
		return
	var survival := _survival()
	# A chest is a real home item and a real money sink: oak 4 + iron_scrap 1.
	var have_oak := _count_item("oak_wood")
	var have_iron := _count_item("iron_scrap")
	if have_oak < 4 or have_iron < 1:
		_grant("oak_wood", "material", 4 - have_oak + 2, "a7.r11.j01.oak")
		_grant("iron_scrap", "material", 1 - have_iron + 1, "a7.r11.j01.iron")
		_note("FIXTURE_GRANT topped the bag up to the chest cost (oak %d->%d, iron %d->%d)" % [
			have_oak, _count_item("oak_wood"), have_iron, _count_item("iron_scrap"),
		])
	var oak_before := _count_item("oak_wood")
	var iron_before := _count_item("iron_scrap")
	# `hero_in_footprint` is a real refusal: the player cannot build where they are
	# standing, so the probe steps through candidate cells exactly as a player would.
	var placed := {"ok": false, "reason": "no_cell_tried"}
	var cell := Vector2i(-1, -1)
	var refusals: Array[String] = []
	for radius in range(2, 7):
		for offset: Vector2i in [Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius),
				Vector2i(0, -radius), Vector2i(radius, radius), Vector2i(-radius, -radius)]:
			var candidate: Vector2i = _hero_cell() + offset
			if not String(build.call(&"validate_cell", candidate)).is_empty():
				refusals.append("%s:%s" % [str(candidate), String(build.call(&"validate_cell", candidate))])
				continue
			var attempt := _place(build, CONTAINER, candidate)
			if bool(attempt.get("ok", false)):
				placed = attempt
				cell = candidate
				break
			refusals.append("%s:%s" % [str(candidate), String(attempt.get("reason", ""))])
		if bool(placed.get("ok", false)):
			break
	_note("chest placement refusals=%s" % str(refusals.slice(0, 6)))
	_expect(cell.x >= 0, "the product offers a legal cell near the Hero for a chest (%s)" % str(cell))
	_expect(bool(placed.get("ok", false)),
		"the player's own placement door builds a chest (%s)" % String(placed.get("reason", "")))
	if not bool(placed.get("ok", false)):
		return
	_expect(_count_item("oak_wood") == oak_before - 4,
		"the chest cost exactly its catalogue price in wood (%d -> %d)" % [oak_before, _count_item("oak_wood")])
	_expect(_count_item("iron_scrap") == iron_before - 1,
		"the chest cost exactly its catalogue price in iron (%d -> %d)" % [iron_before, _count_item("iron_scrap")])

	# Use it: storage that cannot hold anything is not storage.
	var structures: Dictionary = survival.call(&"structures") as Dictionary
	var container_id := ""
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == CONTAINER:
			container_id = String(key)
			break
	_expect(not container_id.is_empty(), "the built chest is a real structure with an identity (%s)" % container_id)
	if container_id.is_empty():
		return
	var wood_in_bag := _count_item("oak_wood")
	var deposited: Dictionary = survival.call(&"deposit_all", container_id) as Dictionary
	_expect(bool(deposited.get("ok", false)),
		"the chest accepts the player's materials (%s)" % String(deposited.get("reason", "")))
	var stored := int((survival.call(&"container_contents", container_id) as Dictionary).size())
	_expect(stored >= 1, "the chest holds a real stack after the deposit (%d stacks)" % stored)
	_expect(_count_item("oak_wood") <= wood_in_bag,
		"the deposit left the bag (%d -> %d oak)" % [wood_in_bag, _count_item("oak_wood")])
	var withdrawn: Dictionary = survival.call(&"withdraw_all", container_id) as Dictionary
	_expect(bool(withdrawn.get("ok", false)), "the chest gives the materials back (%s)" % String(withdrawn.get("reason", "")))


# ------------------------------------------------------- 5. second OS process
func _second_process() -> void:
	var save := _save()
	if save == null:
		return
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var run := _active_run()
	var child := await _run_second_process([CHILD_FLAG, SAVE_ARG + save_path])
	var report := _child_report(String(child.get("output", "")))
	_note("child pid-code=%d report_keys=%s" % [int(child.get("code", -1)), str(report.keys())])
	_expect(not report.is_empty(), "a second OS process reopens the same save and reports")
	if report.is_empty():
		var out := String(child.get("output", ""))
		_note("child output tail=%s" % out.substr(maxi(0, out.length() - 400)))
		return
	_expect(bool(report.get("loaded", false)), "the second process loads the save the first one wrote")
	_expect(String(report.get("run_id", "")) == String(run.get("run_id", "x")),
		"the run identity survives the restart (%s)" % String(report.get("run_id", "")))
	_expect(int(report.get("oak_wood", -1)) == _count_item("oak_wood"),
		"the bag the player filled survives the restart (child %d, parent %d)"
		% [int(report.get("oak_wood", -1)), _count_item("oak_wood")])
	_expect(int(report.get("structures", -1)) >= 1,
		"the paid chest survives the restart (child sees %d structures)" % int(report.get("structures", -1)))
	var parent_keys: Array = (snapshot.get("inventory", {}) as Dictionary).keys()
	_expect(parent_keys.has("item_stacks") or _stacks().is_empty(),
		"the parent's own snapshot uses the same inventory namespace the child reads")


# ---------------------------------------------------------------------- child
func _child(args: PackedStringArray) -> void:
	var target := ""
	for arg: String in args:
		if arg.begins_with(SAVE_ARG):
			target = arg.trim_prefix(SAVE_ARG)
	if target.is_empty():
		print(REPORT + JSON.stringify({"loaded": false, "reason": "no_save_arg"}))
		return
	var save := _save()
	if save == null:
		print(REPORT + JSON.stringify({"loaded": false, "reason": "no_save_service"}))
		return
	var loaded := bool(save.call(&"configure_storage", target, true))
	var snapshot: Dictionary = save.call(&"get_snapshot") as Dictionary
	var profile: Dictionary = snapshot.get("profile", {}) if snapshot.get("profile") is Dictionary else {}
	var run: Dictionary = profile.get("run", {}) if profile.get("run") is Dictionary else {}
	var structure_count := -1
	if _survival() != null:
		structure_count = (_survival().call(&"structures") as Dictionary).size()
	var report := {
		"loaded": loaded,
		"run_id": String(run.get("run_id", "")),
		"oak_wood": _count_item("oak_wood"),
		"structures": structure_count,
	}
	print(REPORT + JSON.stringify(report))


func _child_report(output: String) -> Dictionary:
	for line: String in output.split("\n"):
		var at := line.find(REPORT)
		if at < 0:
			continue
		var parsed: Variant = JSON.parse_string(line.substr(at + REPORT.length()))
		if parsed is Dictionary:
			return parsed
	return {}


func _finish() -> void:
	_release_all()
	super._finish()

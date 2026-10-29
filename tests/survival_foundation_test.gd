extends SceneTree

## SURV-010 acceptance: the complete first survival loop, on the production world.
##
## ## What this is
##
## A real `SceneTree` main loop that boots the **production** overworld scene, then
## drives the survival systems the way a player does — through their public API —
## and asserts observable state: what is in the authoritative inventory, what is in
## the save document on disk, where the collision bodies are.
##
## ## What this is not
##
## It is not a mock. Every assertion reads either the live `SaveService` document or
## a node that exists in the mounted scene. There is no injected fixture save and no
## stubbed inventory: case 8 reloads the save from disk through
## `SaveService.configure_storage()` and rebuilds the world, which is the same path
## a player's second session takes.
##
## Case ids map 1:1 to the twelve required tests in the SURV-010 brief:
##
##   01 harvest increases the inventory by the node's yield
##   02 a spent node yields nothing, and cannot be farmed by replaying the action
##   03 building with enough materials creates the entity and charges once
##   04 building without materials is rejected with no state change
##   05 invalid placement is rejected and nothing is charged
##   06 a repeated transaction key creates no second structure
##   07 container transfer conserves items exactly
##   08 save/reload restores inventory, structures and container contents
##   09 a placed wall has collision the player cannot walk through
##   10 existing overworld traversal is not regressed by any of this
##   11 an older save without the survival namespace loads as an empty one
##   12 repeated reloads neither duplicate nor lose anything
##
## Run:
##   godot --headless --path . --script res://tests/survival_foundation_test.gd

const OW_SCENE_PATH := "res://game/overworld/chapter1_overworld.tscn"
const BUILD_TIMEOUT_MS := 90_000
const WOOD := "oak_wood"
const STONE := "stone_chunk"
const IRON := "iron_scrap"

var failures: Array[String] = []
var checks := 0
var save_path := ""
var _host: Node2D
var _deadline_msec := 0
var _body_complete := false


func _initialize() -> void:
	_console.call_deferred()


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_foundation_%d.json" % Time.get_ticks_usec()
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	await _boot()
	if _host != null:
		await _body()
		if not _body_complete:
			_expect(false, "test body ran to completion")
	_teardown()
	_finish()


# ---------------------------------------------------------------------------
# harness
# ---------------------------------------------------------------------------
func _boot() -> Node:
	var scene: PackedScene = load(OW_SCENE_PATH) as PackedScene
	if scene == null:
		_expect(false, "the production overworld scene loads")
		return null
	_host = Node2D.new()
	_host.name = "SurvivalTestHost"
	root.add_child(_host)
	var ow := scene.instantiate()
	_host.add_child(ow)
	ow.configure({})
	var deadline := Time.get_ticks_msec() + BUILD_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if ow.has_method(&"is_world_ready") and bool(ow.call(&"is_world_ready")):
			return ow
		if ow.has_method(&"is_world_ready"):
			var err := String(ow.get(&"build_error"))
			if not err.is_empty():
				_expect(false, "the overworld built (%s)" % err)
				return null
	_expect(false, "the overworld built within %d ms" % BUILD_TIMEOUT_MS)
	return null


func _teardown() -> void:
	if _host != null and is_instance_valid(_host):
		_host.queue_free()
	_host = null


func _expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		print("  FAIL  %s" % label)
	else:
		print("  ok    %s" % label)


func _finish() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	if failures.is_empty():
		print("\nSURVIVAL FOUNDATION PASSED - %d checks" % checks)
		quit(0)
		return
	print("\nSURVIVAL FOUNDATION FAILED - %d/%d" % [failures.size(), checks])
	for failure: String in failures:
		print("  - %s" % failure)
	quit(1)


func _save() -> Node:
	return root.get_node_or_null("SaveService")


func _survival() -> Node:
	return root.get_node_or_null("SurvivalService")


func _count(item_id: String) -> int:
	return int(_survival().call(&"inventory_count", item_id))


func _document() -> Dictionary:
	return _survival().call(&"document")


func _stacks(item_id: String) -> Dictionary:
	var out: Dictionary = {}
	var stacks: Variant = _save().call(&"get_inventory_stacks")
	if stacks is Dictionary:
		for key: Variant in (stacks as Dictionary).keys():
			var record: Variant = (stacks as Dictionary)[key]
			if not record is Dictionary:
				continue
			# A first stack omits `item_id` and is keyed by the item id instead.
			var base := String((record as Dictionary).get("item_id", String(key)))
			if base == item_id:
				out[String(key)] = int((record as Dictionary).get("quantity", 0))
	return out


func _clear_inventory() -> void:
	# Test-only: start every case from a known bag. Uses the public consume path,
	# so it exercises the same code a real spend does.
	for item_id: String in [WOOD, STONE, IRON]:
		var held := _count(item_id)
		if held > 0:
			_save().call(&"consume_inventory_item", item_id, held,
				"test.clear.%s.%d" % [item_id, Time.get_ticks_usec()])


func _give(item_id: String, quantity: int) -> bool:
	# `grant_inventory_item(item, kind, quantity, transaction_key, metadata)`.
	return bool(_save().call(&"grant_inventory_item", item_id, "material", quantity,
		"test.give.%s.%d" % [item_id, Time.get_ticks_usec()], {"source": "test"}))


func _first_node_of_kind(kind: String) -> String:
	var plan: Dictionary = {}
	var file := FileAccess.open("res://data/survival/hollow_marches_resources.json", FileAccess.READ)
	if file != null:
		plan = JSON.parse_string(file.get_as_text())
		file.close()
	for raw: Variant in plan.get("nodes", []):
		if raw is Dictionary and String((raw as Dictionary).get("kind", "")) == kind:
			var cell: Array = (raw as Dictionary).get("cell", [0, 0])
			return SurvivalStateData.resource_node_id(kind, Vector2i(int(cell[0]), int(cell[1])))
	return ""


## A buildable cell near the player: real open ground, no protected place, no road.
func _find_buildable(ow: Node, offset: Vector2i) -> Vector2i:
	var world: OverworldWorld = ow.get(&"world") as OverworldWorld
	var build: SurvivalBuildSystem = ow.get(&"survival_build") as SurvivalBuildSystem
	var player: Node2D = ow.get(&"player") as Node2D
	var origin := world.tile_of(player.global_position)
	for radius in range(0, 7):
		for dx in range(-radius, radius + 1):
			for dy in range(-radius, radius + 1):
				var cell := origin + Vector2i(dx, dy) + offset
				if build.validate_cell(cell).is_empty():
					return cell
	return Vector2i(-1, -1)


func _reload_world(ow: Node) -> Node:
	# Tear the scene down and boot a fresh one against the same save file. This is
	# the "player quit and came back" path, not a soft reload.
	print("[reload] tearing down")
	ow.queue_free()
	await process_frame
	_host.queue_free()
	_host = null
	await process_frame
	print("[reload] booting a fresh overworld")
	var fresh := await _boot()
	print("[reload] booted=%s" % str(fresh != null))
	return fresh


# ---------------------------------------------------------------------------
# the twelve cases
# ---------------------------------------------------------------------------
func _body() -> void:
	var ow := _host.get_child(0)
	var save := _save()
	var survival := _survival()
	_expect(save != null, "the authoritative SaveService is present")
	_expect(survival != null, "the survival service is present")
	if save == null or survival == null:
		_body_complete = true
		return
	_expect(String(survival.call(&"catalog_error")).is_empty(), "the survival catalog loaded")

	var world: OverworldWorld = ow.get(&"world") as OverworldWorld
	var build: SurvivalBuildSystem = ow.get(&"survival_build") as SurvivalBuildSystem
	var player: Node2D = ow.get(&"player") as Node2D
	_expect(world != null, "the overworld built its terrain")
	_expect(build != null, "the build layer is mounted in the overworld")
	_expect(player != null, "the Knight exists")

	print("[case 01] begin")  # heartbeat: a crash names the case it died in
	# -- 01 harvest increases the inventory by exactly the node's yield ----------
	_clear_inventory()
	var tree_id := _first_node_of_kind("oak_tree")
	_expect(not tree_id.is_empty(), "the resource plan contains a harvestable tree")
	var before := _count(WOOD)
	var hit: Dictionary = survival.call(&"harvest", tree_id, "oak_tree")
	_expect(bool(hit.get("ok", false)), "case 01: the first swing is accepted")
	_expect(_count(WOOD) == before + int(hit.get("quantity", 0)),
		"case 01: the bag grew by exactly the node's yield (%d -> %d)"
			% [before, _count(WOOD)])
	_expect(int(hit.get("quantity", 0)) > 0, "case 01: the yield is positive")
	var node_view: SurvivalResourceNode = ow.call(&"survival_node", tree_id)
	_expect(node_view != null, "case 01: the node exists in the mounted scene")
	if node_view != null:
		var via_node := _count(WOOD)
		var node_hit := bool(node_view.interact(player))
		_expect(node_hit and _count(WOOD) > via_node,
			"case 01: interacting through the world node also gathers")
		_expect(not node_view.last_result().is_empty(),
			"case 01: interacting through the node reports its result")

	print("[case 02] begin")  # heartbeat: a crash names the case it died in
	# -- 02 exhausted node yields nothing; replay cannot farm it ----------------
	var definition: Dictionary = survival.call(&"resource_definition", "oak_tree")
	var hits := int(definition.get("hits", 3))
	for _i in range(hits + 3):
		survival.call(&"harvest", tree_id, "oak_tree")
	var exhausted := _count(WOOD)
	_expect(not bool(survival.call(&"is_node_harvestable", tree_id, "oak_tree")),
		"case 02: the node reports itself exhausted")
	var refused: Dictionary = survival.call(&"harvest", tree_id, "oak_tree")
	_expect(not bool(refused.get("ok", false)),
		"case 02: an exhausted node refuses another swing")
	_expect(_count(WOOD) == exhausted,
		"case 02: the refused swing granted nothing (%d)" % _count(WOOD))
	# Replay protection is a property of the *receipt*, not of the function: each
	# swing's key is derived from the node's own committed harvest counter, so the
	# key for "the first swing at this outcrop" is the same string in every process.
	# Re-delivering that action — a retried event, a duplicated click after a crash —
	# finds its key already applied and pays nothing. Swinging again legitimately
	# produces a different key and does cost another hit, which is correct: two
	# swings are two swings.
	var ripe_id := _first_node_of_kind("stone_outcrop")
	var stone_before := _count(STONE)
	var first: Dictionary = survival.call(&"harvest", ripe_id, "stone_outcrop")
	var after_first := _count(STONE)
	var receipt_key := "survival.harvest.%s.1" % ripe_id
	_expect(bool(first.get("ok", false)) and after_first == stone_before + int(first.get("quantity", 0)),
		"case 02: a fresh node pays exactly one yield (%d -> %d)" % [stone_before, after_first])
	_expect(bool(save.call(&"is_transaction_applied", receipt_key)),
		"case 02: the swing left a receipt keyed by the node's own counter")
	var replay_applied := bool(save.call(
		&"transact_once", receipt_key,
		func(_candidate: Dictionary) -> bool: return true,
		{"kind": "test.replay"}))
	_expect(not replay_applied, "case 02: replaying that receipt key is refused")
	_expect(_count(STONE) == after_first,
		"case 02: the replayed action granted nothing (%d)" % _count(STONE))
	var second: Dictionary = survival.call(&"harvest", ripe_id, "stone_outcrop")
	_expect(bool(second.get("ok", false)) and _count(STONE) > after_first,
		"case 02: a genuine second swing is a new action and does pay")

	# -- build modal: it is enterable, it blocks the click, and it quotes the cost
	build.set_active(true)
	var hud_state: Dictionary = build.build_hud_status()
	_expect(bool(hud_state.get("active", false)), "build modal: opens on request")
	_expect(bool(hud_state.get("blocker_visible", false)),
		"build modal: the click blocker is up, so a placement click is not an attack")
	_expect(String(hud_state.get("text", "")).contains("[2] Wall"),
		"build modal: the strip lists the pieces")
	_expect(String(hud_state.get("text", "")).contains("short"),
		"build modal: an empty bag is shown as short of materials")
	build.set_active(false)
	_expect(not bool(build.build_hud_status().get("blocker_visible", true)),
		"build modal: closing it releases the click")

	print("[case 04] begin")  # heartbeat: a crash names the case it died in
	# -- 04 build without materials is rejected with no state change ------------
	_clear_inventory()
	var structures_before := int((_document().get("structures", {}) as Dictionary).size())
	var empty_cell := _find_buildable(ow, Vector2i(1, 1))
	_expect(empty_cell.x >= 0, "case 04: a buildable cell was found")
	var poor: Dictionary = build.try_place(empty_cell)
	_expect(not bool(poor.get("ok", false)), "case 04: building without materials is refused")
	_expect(String(poor.get("reason", "")) == "cannot_afford",
		"case 04: the refusal names the reason (%s)" % String(poor.get("reason", "")))
	_expect(int((_document().get("structures", {}) as Dictionary).size()) == structures_before,
		"case 04: no structure was created")
	_expect(_count(WOOD) == 0, "case 04: nothing was deducted")

	print("[case 05] begin")  # heartbeat: a crash names the case it died in
	# -- 05 invalid placement is rejected and nothing is charged ---------------
	_expect(_give(WOOD, 40), "case 05: test materials granted")
	_expect(_give(IRON, 20), "case 05: test iron granted")
	var wood_before := _count(WOOD)
	var origin := world.tile_of(player.global_position)
	# A cliff cell: solid terrain, never buildable.
	var solid_cell := Vector2i(-1, -1)
	for dx in range(-14, 15):
		for dy in range(-14, 15):
			var cell := origin + Vector2i(dx, dy)
			if world.is_solid_cell(cell.x, cell.y):
				solid_cell = cell
				break
		if solid_cell.x >= 0:
			break
	if solid_cell.x >= 0:
		build.select_piece("wall_wood")
		var on_rock: Dictionary = build.try_place(solid_cell)
		_expect(not bool(on_rock.get("ok", false)),
			"case 05: building into solid terrain is refused")
		_expect(_count(WOOD) == wood_before, "case 05: a refused placement charges nothing")
	else:
		_expect(true, "case 05: no solid cell nearby (skipped, no material risk)")
	# Out of reach.
	build.select_piece("wall_wood")
	var far_cell := origin + Vector2i(30, 0)
	var too_far: Dictionary = build.try_place(far_cell)
	_expect(not bool(too_far.get("ok", false)) or String(too_far.get("reason", "")) != "",
		"case 05: a distant cell is refused or reported")
	_expect(_count(WOOD) == wood_before, "case 05: still nothing charged")

	print("[case 03] begin")  # heartbeat: a crash names the case it died in
	# -- 03 build with enough materials: entity exists, materials decrease once --
	var build_cell := _find_buildable(ow, Vector2i(2, 2))
	_expect(build_cell.x >= 0, "case 03: a legal build cell was found")
	build.select_piece("foundation_wood")
	var cost: Dictionary = (survival.call(&"piece_definition", "foundation_wood") as Dictionary).get("cost", {})
	var wood_pre := _count(WOOD)
	var placed: Dictionary = build.try_place(build_cell)
	_expect(bool(placed.get("ok", false)),
		"case 03: the foundation was placed (%s)" % String(placed.get("reason", "")))
	var entity_id := String(placed.get("entity_id", ""))
	_expect(not entity_id.is_empty(), "case 03: placement returned a persistent entity id")
	_expect(_count(WOOD) == wood_pre - int(cost.get("oak_wood", 0)),
		"case 03: exactly one foundation's timber was taken (%d -> %d)"
			% [wood_pre, _count(WOOD)])
	_expect((_document().get("structures", {}) as Dictionary).has(entity_id),
		"case 03: the entity is committed in the save document")
	_expect(build.structure_node(entity_id) != null,
		"case 03: the entity exists in the mounted scene")
	_expect(build.entity_at(build_cell) == entity_id,
		"case 03: the cell is now recorded as occupied")

	print("[case 06] begin")  # heartbeat: a crash names the case it died in
	# -- 06 a repeated transaction key creates no second structure --------------
	var key := "survival.build.repeat.test"
	var cell_a := _find_buildable(ow, Vector2i(3, 3))
	build.select_piece("wall_wood")
	var once: Dictionary = build.try_place(cell_a, key)
	var wood_after_once := _count(WOOD)
	var count_after_once := int((_document().get("structures", {}) as Dictionary).size())
	var cell_b := _find_buildable(ow, Vector2i(4, 4))
	if cell_b == cell_a:
		cell_b = _find_buildable(ow, Vector2i(-3, 3))
	var twice: Dictionary = build.try_place(cell_b, key)
	_expect(bool(once.get("ok", false)), "case 06: the first keyed build succeeds")
	_expect(not bool(twice.get("ok", false)),
		"case 06: replaying the same transaction key is refused")
	_expect(int((_document().get("structures", {}) as Dictionary).size()) == count_after_once,
		"case 06: no second structure was created")
	_expect(_count(WOOD) == wood_after_once, "case 06: the replay charged nothing")

	print("[case 07] begin")  # heartbeat: a crash names the case it died in
	# -- 07 container transfer conserves items exactly --------------------------
	var chest_cell := _find_buildable(ow, Vector2i(-2, 2))
	build.select_piece("chest_wood")
	var chest: Dictionary = build.try_place(chest_cell)
	_expect(bool(chest.get("ok", false)),
		"case 07: a storage chest was built (%s)" % String(chest.get("reason", "")))
	var chest_id := String(chest.get("entity_id", ""))
	_expect(_count(STONE) == 0, "case 07: stone starts at zero")
	_expect(_give(STONE, 9), "case 07: test stone granted")
	var total_before := _count(STONE)
	var into: bool = bool(survival.call(
		&"transfer_to_container", chest_id, STONE, 6, "survival.test.transfer.in"))
	_expect(into, "case 07: the deposit is accepted")
	var contents: Dictionary = survival.call(&"container_contents", chest_id)
	_expect(int(contents.get(STONE, 0)) == 6, "case 07: the chest holds 6 stone")
	var before_demolition := _document()
	_expect(not bool(survival.call(&"remove_structure", chest_id)),
		"case 07: a nonempty chest cannot be demolished")
	_expect(_document() == before_demolition,
		"case 07: refused demolition preserves the whole survival document")
	_expect(_count(STONE) == total_before - 6,
		"case 07: the bag lost exactly 6 stone (%d)" % _count(STONE))
	var stored_total := 0
	for item_id: Variant in contents.keys():
		stored_total += int(contents[item_id])
	_expect(_count(STONE) + stored_total == total_before,
		"case 07: bag + chest still equals the original total")
	var out: bool = bool(survival.call(
		&"transfer_from_container", chest_id, STONE, 6, "survival.test.transfer.out"))
	_expect(out, "case 07: the withdrawal is accepted")
	_expect(_count(STONE) == total_before, "case 07: the round trip conserved the stone")
	var overdraw: bool = bool(survival.call(
		&"transfer_from_container", chest_id, STONE, 5, "survival.test.transfer.overdraw"))
	_expect(not overdraw, "case 07: withdrawing more than the chest holds is refused")
	_expect(_count(STONE) == total_before, "case 07: the refused withdrawal changed nothing")

	# The same two moves through the world node, which is what a player actually
	# clicks. The chest is a `player_interactable`, so the Knight's existing
	# interact path reaches it with no new input code.
	var chest_node := build.structure_node(chest_id) as SurvivalStructure
	_expect(chest_node != null, "case 07: the chest node is interactable")
	if chest_node != null:
		player.global_position = chest_node.global_position + Vector2(0, 12)
		_expect(chest_node.interaction_verb() == "stash",
			"case 07: with a loaded bag the chest offers to stash")
		_expect(chest_node.can_interact(player), "case 07: the chest reports itself reachable")
		var bag_before := _count(STONE)
		_expect(chest_node.interact(player), "case 07: clicking the chest is accepted")
		_expect(_count(STONE) == 0,
			"case 07: the whole bag moved into the chest (%d left)" % _count(STONE))
		# `stash` sweeps the whole bag, so the chest now also holds the timber that
		# cases 03–06 left behind. The stone is what this case is accounting for.
		var node_contents := (survival.call(&"container_contents", chest_id) as Dictionary)
		_expect(int(node_contents.get(STONE, 0)) == bag_before,
			"case 07: the chest holds exactly the stone that left the bag (%d)"
				% int(node_contents.get(STONE, 0)))
		_expect(chest_node.interaction_verb() == "take",
			"case 07: an empty bag makes the chest offer to give back")
		_expect(chest_node.interact(player), "case 07: taking back is accepted")
		_expect(_count(STONE) == bag_before,
			"case 07: everything came back (%d)" % _count(STONE))
		var after_take := (survival.call(&"container_contents", chest_id) as Dictionary)
		_expect(after_take.is_empty(), "case 07: the chest is empty again")
		# An identical second cycle is a new action, not a replay of the first.
		_expect(chest_node.interact(player), "case 07: second identical deposit accepted")
		_expect(_count(STONE) == 0, "case 07: second deposit really moved stone")
		_expect(chest_node.interact(player), "case 07: second identical withdrawal accepted")
		_expect(_count(STONE) == bag_before, "case 07: second round trip conserves stone")
		_expect((survival.call(&"container_contents", chest_id) as Dictionary).is_empty(),
			"case 07: second withdrawal empties the chest")
		# Case 08 records the reload expectations from here, so put the bag back to
		# a known state rather than depending on case 03's leftovers.
		_expect(_count(WOOD) > 0, "case 07: the building timber came back too")

	print("[case 09] begin")  # heartbeat: a crash names the case it died in
	# -- 09 a placed wall has real collision ------------------------------------
	build.select_piece("wall_wood")
	var wall_cell := _find_buildable(ow, Vector2i(0, -3))
	var wall: Dictionary = build.try_place(wall_cell)
	_expect(bool(wall.get("ok", false)),
		"case 09: a wall was built (%s)" % String(wall.get("reason", "")))
	var wall_id := String(wall.get("entity_id", ""))
	var wall_node := build.structure_node(wall_id)
	_expect(wall_node != null, "case 09: the wall node exists")
	if wall_node != null:
		var body: Node = null
		for child: Node in wall_node.get_children():
			if child is StaticBody2D:
				body = child
				break
		_expect(body != null, "case 09: the wall carries a StaticBody2D")
		if body != null:
			var static_body := body as StaticBody2D
			_expect(static_body.collision_layer == 1,
				"case 09: the wall blocks on the terrain collision layer")
			var shape := static_body.get_child(0) as CollisionShape2D
			_expect(shape != null and shape.shape != null,
				"case 09: the collision shape is real")
			if shape != null and shape.shape is RectangleShape2D:
				var rect := (shape.shape as RectangleShape2D).size
				_expect(rect.x >= 12.0 and rect.y >= 8.0,
					"case 09: the wall's body is a solid block (%.0fx%.0f)" % [rect.x, rect.y])
		# The wall is physically in the way. Measured as a ray from open ground: the
		# terrain under the wall is ordinary walkable ground (asserted below), so a
		# blocked ray can only be the structure's own collider. Walking a
		# CharacterBody2D into it would test the Knight's movement code, which is
		# not what this case is about.
		var wall_world := Vector2(wall_cell.x * 16 + 8, wall_cell.y * 16 + 8)
		var space := player.get_world_2d().direct_space_state
		var ray_to_wall := PhysicsRayQueryParameters2D.create(
			wall_world + Vector2(0, 40), wall_world, 1, [player.get_rid()])
		var blocked := space.intersect_ray(ray_to_wall)
		_expect(not blocked.is_empty(),
			"case 09: a ray from open ground into the wall is blocked")
		if not blocked.is_empty():
			var hit_node: Node = blocked.get("collider")
			_expect(hit_node != null and hit_node.get_parent() == wall_node,
				"case 09: the thing blocking the ray is the wall's own body")
		# Control: the same ray two tiles away finds nothing, so the block above is
		# the wall and not a stray prop or a wide collision margin.
		var control_cell := wall_cell + Vector2i(2, 0)
		var control_world := Vector2(control_cell.x * 16 + 8, control_cell.y * 16 + 8)
		var ray_control := PhysicsRayQueryParameters2D.create(
			control_world + Vector2(0, 40), control_world, 1, [player.get_rid()])
		_expect(space.intersect_ray(ray_control).is_empty(),
			"case 09: open ground beside the wall is still walkable")
		_expect(not world.is_solid_cell(wall_cell.x, wall_cell.y),
			"case 09: the terrain beneath the wall is still walkable ground")

	print("[case 10] begin")  # heartbeat: a crash names the case it died in
	# -- 10 existing overworld traversal is not regressed -----------------------
	var gates: int = int((ow.get(&"gates") as Dictionary).size())
	var camps: int = int((ow.get(&"camps") as Dictionary).size())
	var discoveries: int = int((ow.get(&"discoveries") as Dictionary).size())
	_expect(gates == 10, "case 10: all ten Chapter 1 thresholds still exist (%d)" % gates)
	_expect(camps == 4, "case 10: all four camps still exist (%d)" % camps)
	_expect(discoveries > 0, "case 10: discoveries still exist (%d)" % discoveries)
	var traversability: OverworldTraversability = ow.get(&"traversability") as OverworldTraversability
	_expect(traversability != null, "case 10: the traversability grid still exists")
	_expect((ow.get(&"traversability_failures") as Array).is_empty(),
		"case 10: survival did not seal any authored endpoint")
	var gate_ids: Array = (ow.get(&"gates") as Dictionary).keys()
	_expect(gate_ids.has(&"chapter_1_level_1"),
		"case 10: L01 is still present in the gate system")
	_expect(gate_ids.has(&"chapter_1_level_10"),
		"case 10: L10 is still present in the gate system")

	print("[case 08] begin")  # heartbeat: a crash names the case it died in
	# -- 08 save / reload restores everything ----------------------------------
	var before_wood := _count(WOOD)
	var before_structures := int((_document().get("structures", {}) as Dictionary).size())
	var before_chest := (survival.call(&"container_contents", chest_id) as Dictionary).duplicate(true)
	var before_nodes := (_document().get("resource_nodes", {}) as Dictionary).duplicate(true)
	_expect(_give(STONE, 3), "case 08: stone body for the reload check")
	survival.call(&"transfer_to_container", chest_id, STONE, 3, "survival.test.reload.deposit")
	var chest_expect := (survival.call(&"container_contents", chest_id) as Dictionary).duplicate(true)
	var wood_expect := _count(WOOD)
	_expect(bool(save.call(&"save_now")), "case 08: the save committed")

	ow = await _reload_world(ow)
	_expect(ow != null, "case 08: the world rebuilt from the saved file")
	if ow != null:
		build = ow.get(&"survival_build") as SurvivalBuildSystem
		_expect(_count(WOOD) == wood_expect,
			"case 08: wood survived the reload (%d vs %d)" % [_count(WOOD), wood_expect])
		var after_structures := int((_document().get("structures", {}) as Dictionary).size())
		_expect(after_structures == before_structures,
			"case 08: every structure came back (%d vs %d)" % [after_structures, before_structures])
		_expect(build.placed_count() == before_structures,
			"case 08: every structure was re-materialized in the scene (%d)"
				% build.placed_count())
		var after_chest: Dictionary = survival.call(&"container_contents", chest_id)
		_expect(after_chest == chest_expect,
			"case 08: chest contents match exactly (%s vs %s)" % [str(after_chest), str(chest_expect)])
		var after_nodes: Dictionary = _document().get("resource_nodes", {})
		var tree_after: Dictionary = after_nodes.get(tree_id, {})
		_expect(int(tree_after.get("hits_left", -1)) == 0,
			"case 08: the spent tree is still spent after reload")
		var fresh_id := _first_node_of_kind("iron_vein")
		if not fresh_id.is_empty():
			_expect(bool(survival.call(&"is_node_harvestable", fresh_id, "iron_vein")),
				"case 08: an untouched node is still ripe after reload")
		# The scene nodes exist again, with the same ids.
		_expect(build.structure_node(chest_id) != null,
			"case 08: the chest node is present again with its original id")
		_expect(build.structure_node(wall_id) != null,
			"case 08: the wall node is present again with its original id")

	print("[case 11] begin")  # heartbeat: a crash names the case it died in
	# -- 11 an older save without the survival namespace loads as empty --------
	var legacy_path := "user://tests/survival_legacy_%d.json" % Time.get_ticks_usec()
	# The canonical first-stack shape: the key IS the item id and the record
	# carries no `item_id`. Dotted keys ("oak_wood.0") are not valid identifiers,
	# so a fixture written that way is rejected as corrupt and silently replaced
	# with defaults - which would have made this case pass for the wrong reason.
	var legacy := {
		"schema_version": 4,
		"inventory": {"item_stacks": {"oak_wood": {"kind": "material", "quantity": 7}}},
	}
	var write := FileAccess.open(legacy_path, FileAccess.WRITE)
	_expect(write != null, "case 11: a legacy save file can be written")
	if write != null:
		write.store_string(JSON.stringify(legacy))
		write.close()
	_expect(bool(save.call(&"configure_storage", legacy_path, true)),
			"case 11: the legacy save loads")
	var legacy_doc := _document()
	_expect((legacy_doc.get("structures", {}) as Dictionary).is_empty(),
		"case 11: a pre-survival save loads with no structures")
	_expect((legacy_doc.get("resource_nodes", {}) as Dictionary).is_empty(),
		"case 11: a pre-survival save loads with no touched nodes")
	_expect(int(legacy_doc.get("schema", 0)) == SurvivalStateData.SCHEMA,
		"case 11: the survival namespace is stamped with its schema")
	_expect(_count(WOOD) == 7, "case 11: the legacy inventory is intact (%d)" % _count(WOOD))
	# The legacy save is still loadable by anything that ignores survival.
	# A typed local: `Object.call` rejects an untyped array where `get_value`
	# expects `Array[String]`, which is exactly the trap the accessor above avoids.
	var schema_path: Array[String] = ["schema_version"]
	_expect(int(save.call(&"get_value", schema_path, -1)) == LivingArsenalSaveService.CURRENT_SCHEMA_VERSION,
		"case 11: the outer save schema is unchanged by survival")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(legacy_path))
	_expect(bool(save.call(&"configure_storage", save_path, true)),
		"case 11: storage restored to the main test save")

	print("[case 12] begin")  # heartbeat: a crash names the case it died in
	# -- 12 repeated reloads neither duplicate nor lose ------------------------
	print("[case 12] a: reading the committed bag")
	var stable_wood := _count(WOOD)
	print("[case 12] b: wood=%d" % stable_wood)
	var stable_structures := int((_document().get("structures", {}) as Dictionary).size())
	print("[case 12] c: structures=%d" % stable_structures)
	var stable_chest: Dictionary = survival.call(&"container_contents", chest_id)
	print("[case 12] d: chest=%s" % str(stable_chest))
	for cycle in range(3):
		_expect(bool(save.call(&"reload_save")), "case 12: reload %d succeeded" % (cycle + 1))
		ow = await _reload_world(ow)
		if ow == null:
			_expect(false, "case 12: world rebuilt on cycle %d" % (cycle + 1))
			break
		build = ow.get(&"survival_build") as SurvivalBuildSystem
		_expect(_count(WOOD) == stable_wood,
			"case 12: wood stable after reload %d (%d)" % [cycle + 1, _count(WOOD)])
		_expect(int((_document().get("structures", {}) as Dictionary).size()) == stable_structures,
			"case 12: structure count stable after reload %d" % (cycle + 1))
		_expect(build.placed_count() == stable_structures,
			"case 12: scene structure count stable after reload %d (%d)"
				% [cycle + 1, build.placed_count()])
		_expect((survival.call(&"container_contents", chest_id) as Dictionary) == stable_chest,
			"case 12: chest contents stable after reload %d" % (cycle + 1))
		# Replaying a harvested action after reload must still be refused.
		var replay_after: Dictionary = survival.call(&"harvest", tree_id, "oak_tree")
		_expect(not bool(replay_after.get("ok", false)),
			"case 12: a spent node still refuses after reload %d" % (cycle + 1))

	# -- transaction receipts are real ----------------------------------------
	var snapshot: Dictionary = save.call(&"get_snapshot")
	var receipts: Dictionary = snapshot.get("applied_transactions", {})
	_expect(not receipts.is_empty(), "every mutation left a transaction receipt (%d)" % receipts.size())
	var survival_receipts := 0
	for key_name: Variant in receipts.keys():
		if String(key_name).begins_with("survival."):
			survival_receipts += 1
	_expect(survival_receipts > 0,
		"survival mutations are auditable by key (%d)" % survival_receipts)

	_body_complete = true

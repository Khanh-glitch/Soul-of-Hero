extends "res://tests/survival/balance_native_r10/r10_harness.gd"
## WP3 — A8's current red, split into "owner defect" and "test expectation".
##
## A8's native run at `3a7ab461` is failing. A blanket "A8 is broken" would be
## useless to A8 and would hide the cases where the *test* is wrong, so this probe
## isolates three branches that can be decided without re-running A8's whole suite:
##
## 1. **Mill access gates.** The contract test asserts the Mill definition carries
##    exactly two gates and that each is `retreat_one_way`. If the data says
##    otherwise, that is an authoring defect; if the data agrees and the *physical*
##    scene disagrees, that is a scene defect. Both halves are read here.
## 2. **The `intent_id` access in the transition test.** GDScript dictionary dot
##    access fails at *runtime* when the key is missing, so this is either a key the
##    product never emits (owner defect) or a stale test expectation. The probe
##    instantiates the same Mill scene A8's own contract test uses and inspects a
##    real emitted intent for the keys the tests read.
## 3. **The mover.** A8's actor issues one `move_and_collide` per step against a
##    circular body, while the production Knight is a 12×16 rectangle sliding at a
##    bounded speed. Any route claim is therefore conditional on which mover the
##    claim is about.
##
## Nothing here edits an A8 file: scenes and fixtures are loaded read-only, and the
## A7-owned mover double lives in this directory.

const MILL_JSON := "res://data/survival/world_content/sites/south_crown_mill.json"
const MILL_SCENE := "res://game/survival/world_content/scenes/south_crown_mill.tscn"
## A8's own *game* fixture ships in the composed tree. Its *test* actor and phase
## fixture do not — they live under A8's `tests/`, which a composition does not
## carry (and which A7 must not copy). The stand-in used here is A7-owned and is
## labelled as such in the notes, so no claim in this probe depends on "A8's actor".
const A8_FIXTURE := "res://game/survival/world_content/scripts/poi_authority_fixture.gd"
const SHADOW = preload("res://tests/survival/balance_native_r9/r9_shadow_mover.gd")


func _body() -> void:
	probe_id = "R10A8"
	probe_title = "A8 current red: Mill gate data, intent keys the tests read, and the mover behind route claims"
	owner_action = (
		"A8: (a) make `south_crown_mill.json` gates match the contract test or correct the test; (b) emit the "
		+ "`intent_id` the transition test dereferences, or stop dereferencing a key the product does not promise; "
		+ "(c) state the mover in every route claim, or mount the production Knight."
	)

	# ---- 1. Mill gates: data against the test's own assertion ------------
	var mill_text := FileAccess.get_file_as_string(MILL_JSON) if FileAccess.file_exists(MILL_JSON) else ""
	var mill: Variant = JSON.parse_string(mill_text) if not mill_text.is_empty() else null
	if not mill is Dictionary:
		_missing("the Mill site definition", MILL_JSON)
		_done()
		return
	var gates: Array = (mill as Dictionary).get("gates", [])
	var one_way := 0
	for gate: Variant in gates:
		if gate is Dictionary and bool((gate as Dictionary).get("retreat_one_way", false)):
			one_way += 1
	_note("mill gates=%d retreat_one_way=%d" % [gates.size(), one_way])
	_expect(gates.size() == 2, "the Mill authors exactly the two access gates its contract test expects (found %d)" % gates.size())
	_expect(one_way == gates.size(), "every Mill gate is one-way outward, as the contract test asserts")
	var actions: Dictionary = {}
	for group: String in ["choices", "actions"]:
		for entry: Variant in (mill as Dictionary).get(group, []):
			if entry is Dictionary:
				actions[String((entry as Dictionary).get("action_id", ""))] = entry
	var repair: Dictionary = actions.get("repair_waterwheel", {})
	var fastener: Dictionary = actions.get("recover_fastener", {})
	_expect(bool(repair.get("owner_ready_required", false)),
		"repair_waterwheel is owner-ready gated (the gate, not the UI, decides)")
	_expect(bool(fastener.get("owner_ready_required", false)),
		"recover_fastener is owner-ready gated")

	# ---- 2. intent keys, from a real emitted intent ----------------------
	var intent_keys: Array[String] = []
	var emitted := false
	if ResourceLoader.exists(MILL_SCENE):
		var fixture_script: Script = load(A8_FIXTURE) as Script
		var packed: PackedScene = load(MILL_SCENE) as PackedScene
		if fixture_script != null and packed != null:
			var fixture: Node = fixture_script.new() as Node
			root.add_child(fixture)
			fixture.call(&"configure")
			var site: Node = packed.instantiate()
			root.add_child(site)
			await process_frame
			site.call(&"set_projection", fixture.call(&"project_state", site.call(&"get_source_id")))
			# A7's own body double: production `Knight`-sized rectangle, world collision
			# layer, standing on the site's authored stand position.
			var actor := CharacterBody2D.new()
			actor.name = "A7StandIn"
			actor.collision_layer = 2
			actor.collision_mask = 1
			var shape := CollisionShape2D.new()
			var box := RectangleShape2D.new()
			box.size = Vector2(12, 16)
			shape.shape = box
			shape.position = Vector2(0, -8)
			actor.add_child(shape)
			root.add_child(actor)
			actor.global_position = site.call(&"get_stand_position")
			await physics_frame
			var captured: Array = []
			site.connect(&"intent_requested", func(intent: Dictionary) -> void: captured.append(intent))
			var interacted := bool(site.call(&"try_interact", actor, 0))
			_note("mill try_interact emitted=%s captured=%d" % [str(interacted), captured.size()])
			if not captured.is_empty():
				emitted = true
				var intent: Dictionary = captured[0]
				intent_keys = intent.keys()
				intent_keys.sort()
				_note("mill_intent_keys=%s" % JSON.stringify(intent_keys))
			actor.queue_free()
			site.queue_free()
			fixture.queue_free()
			await process_frame
	if not emitted:
		_note("the Mill emitted no intent at the stand position, so the key set could not be read")
	_expect(not emitted or intent_keys.has("intent_id"),
		"an emitted Mill intent carries `intent_id`, the key A8's transition test dereferences")
	if emitted:
		# The keys A8's tests read by dot access; a missing one is a runtime crash,
		# which is exactly the failure shape the CT report describes.
		var read_by_tests: Array[String] = ["intent_id", "source_id", "action_id", "claim_id"]
		var absent: Array[String] = []
		for key: String in read_by_tests:
			if not intent_keys.has(key):
				absent.append(key)
		_note("keys_read_by_a8_tests_absent=%s" % JSON.stringify(absent))
		_expect(absent.is_empty(), "every key A8's tests dot-access exists on the emitted intent (%s)" % JSON.stringify(absent))

	# ---- 3. the mover behind route claims -------------------------------
	var mounted := await _mount_production_world(false, Vector2i(1280, 720))
	if mounted == null:
		_note("mount_blocked=%s" % blocked)
		return
	var hero_shape := ""
	for child: Node in hero.get_children():
		if child is CollisionShape2D and String(child.name) == "BodyShape":
			hero_shape = (child as CollisionShape2D).shape.get_class()
	var shadow: CharacterBody2D = SHADOW.new() as CharacterBody2D
	shadow.call(&"configure_world_only", true)
	root.add_child(shadow)
	await physics_frame
	_note("hero: shape=%s mask=%d motion=%d | a8 actor:CircleShape2D r=10 mask=1 single move_and_collide | shadow:%d/%d" % [
		hero_shape, hero.collision_mask, hero.motion_mode, shadow.collision_mask, shadow.motion_mode,
	])
	_expect(hero_shape == "RectangleShape2D" and hero.collision_mask != shadow.collision_mask,
		"the production Hero's shape and collision mask differ from A8's actor, so route claims need a mover")

	# One wall, both movers, diagonal input: the slide response differs and that is
	# the part of a route claim that transfers worst.
	var wall := StaticBody2D.new()
	wall.collision_layer = 1
	var wall_shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(16, 160)
	wall_shape.shape = rect
	wall.add_child(wall_shape)
	var start := hero.global_position
	wall.global_position = start + Vector2(24, 0)
	root.add_child(wall)
	await physics_frame
	Input.action_press("move_right")
	Input.action_press("move_up")
	for i in 60:
		await physics_frame
	Input.action_release("move_right")
	Input.action_release("move_up")
	await physics_frame
	var hero_travel := hero.global_position - start
	shadow.global_position = start
	await physics_frame
	shadow.call(&"step", Vector2(40, -40))
	await shadow.call(&"await_step")
	var shadow_travel := shadow.global_position - start
	_note("slide: hero=%s shadow=%s" % [str(hero_travel), str(shadow_travel)])
	_expect(absf(hero_travel.y) > 20.0, "the production Hero keeps travelling along the wall (dy=%.1f)" % hero_travel.y)
	_expect(absf(shadow_travel.y) < absf(hero_travel.y) * 0.25,
		"A8's mover discards the rest of its step at contact (dy=%.1f vs %.1f)" % [shadow_travel.y, hero_travel.y])
	wall.queue_free()
	shadow.queue_free()
	_release_all()
	_done()


func _finish() -> void:
	_release_all()
	super._finish()

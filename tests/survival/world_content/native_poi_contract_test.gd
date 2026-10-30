extends SceneTree

const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const SCENES := [
	"res://game/survival/world_content/scenes/south_quarry.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill.tscn",
	"res://game/survival/world_content/scenes/fourth_salt_lookout_test.tscn"
]

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _scene_and_data_contracts()
	await _interaction_eligibility_and_choice()
	await _physical_access_and_retreat_basic()
	await _authority_failures_and_retry()
	await _candidate_claims_capacity_and_reload()
	await _physical_mill_gate_and_retreat()
	if _failures.is_empty():
		print("A8_NATIVE_POI_TEST_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print("A8_NATIVE_POI_TEST_FAIL failures=%d assertions=%d" % [_failures.size(), _assertions])
		quit(1)


func _scene_and_data_contracts() -> void:
	for scene_path: String in SCENES:
		var packed := load(scene_path) as PackedScene
		_check(packed != null, "Native PackedScene loads: %s" % scene_path)
		if packed == null:
			continue
		var site := packed.instantiate() as NativePoiSite
		root.add_child(site)
		await process_frame
		_check(
			not site.definition.is_empty(),
			"source-backed site data loaded: %s" % site.get_source_id()
		)
		_check(
			site.get_node_or_null("PhysicalActionSocket") is Area2D,
			"physical interaction Area2D exists: %s" % site.get_source_id()
		)
		var colliders := 0
		for child: Node in site.get_children():
			if child is StaticBody2D:
				colliders += 1
		_check(
			colliders >= 4,
			"solid traversal / retreat collision boundaries exist: %s" % site.get_source_id()
		)
		_check(
			site.definition.get("source", {}).has("poi_id"),
			"site source / anchor identity exists: %s" % site.get_source_id()
		)
		site.queue_free()
		await process_frame


func _interaction_eligibility_and_choice() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var actor: CharacterBody2D = pair.actor
	var authority: Node = pair.authority
	var intents: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): intents.append(intent))
	actor.global_position = site.get_spawn_position()
	_check(not site.try_interact(actor), "out-of-range action is denied")
	actor.global_position = site.get_stand_position() + Vector2(20, 0)
	_check(not site.try_interact(actor), "standpoint tolerance is enforced")
	actor.global_position = site.get_stand_position()
	actor.set("facing", Vector2.RIGHT)
	_check(not site.try_interact(actor), "wrong-facing action is denied")
	actor.set("facing", Vector2.UP)
	site.cycle_choice(1)
	_check(site.try_interact(actor), "alternate quarry route submits through shared engine")
	_check(intents.size() == 1, "exactly one transaction intent emitted")
	if not intents.is_empty():
		var intent: Dictionary = intents[0]
		_check(
			intent.source_id == "poi_crown_south_quarry",
			"intent keeps canonical stable site identity"
		)
		_check(intent.action_id == "chock_west_ramp", "selected route choice survives in identity")
		_check(
			(
				intent.contract_id == "soh.native_poi.intent.v1"
				and intent.contract_version == 1
				and intent.provisional_test_only
			),
			"versioned intent remains explicitly fixture-only"
		)
		var result: Dictionary = authority.submit_intent(intent)
		_check(result.status == "committed", "fixture accepts affordable candidate route")
		_check(
			site.receive_authoritative_result(
				intent.intent_id, result, authority.project_state(site.get_source_id())
			),
			"site accepts matching owner receipt"
		)
		_check(
			site.get_site_state().get("quarry_route", "") == "west_chocked",
			"environmental projection only changes after owner commit"
		)
		_check(
			(
				site.receive_authoritative_result(
					intent.intent_id, result, authority.project_state(site.get_source_id())
				)
				== false
			),
			"stale duplicate receipt ignored"
		)
	var blockers := 0
	for child: Node in site.get_children():
		if str(child.name).begins_with("ChoiceBlocker_"):
			blockers += 1
	_check(blockers == 1, "committed route physically removes the matching collision blocker")
	_check(
		site.try_interact(actor, 0), "a braced quarry route enables its finite extraction action"
	)
	var extraction: Dictionary = intents.back()
	var extracted: Dictionary = authority.submit_intent(extraction)
	_check(extracted.status == "committed", "safe quarry extraction uses the shared owner boundary")
	_check(
		authority.snapshot().inventory.stone_chunk == 4,
		"extraction reward is applied once by the fixture owner"
	)
	_cleanup(pair)

	var leave_pair := await _make_site(0)
	var leave_site: NativePoiSite = leave_pair.site
	var leave_actor: CharacterBody2D = leave_pair.actor
	var leave_authority: Node = leave_pair.authority
	leave_actor.global_position = leave_site.get_stand_position()
	leave_actor.set("facing", Vector2.UP)
	leave_site.cycle_choice(2)
	_check(leave_site.try_interact(leave_actor), "player may leave the quarry seam untouched")
	var leave_intent: Dictionary = leave_site._pending.duplicate(true)
	var leave_commit: Dictionary = leave_authority.submit_intent(leave_intent)
	leave_site.receive_authoritative_result(
		leave_intent.intent_id,
		leave_commit,
		leave_authority.project_state(leave_site.get_source_id())
	)
	_check(
		not leave_site.try_interact(leave_actor, 0),
		"unbraced route cannot claim the unsafe outcrop"
	)
	var forged_extraction: Dictionary = leave_site._make_intent(leave_site.definition.actions[0])
	_check(
		leave_authority.submit_intent(forged_extraction).status == "rejected",
		"owner independently rejects an extraction request with an unsafe saved route"
	)
	_cleanup(leave_pair)


func _physical_access_and_retreat_basic() -> void:
	for index: int in [0, 1]:
		var pair := await _make_site(index)
		var site: NativePoiSite = pair.site
		var actor: CharacterBody2D = pair.actor
		var spawn := site.get_spawn_position()
		var stand := site.get_stand_position()
		actor.global_position = spawn
		actor.request_test_motion(Vector2(stand.x - spawn.x, 0.0))
		await physics_frame
		_check(
			actor.motion_finished and actor.last_collision == null,
			"outer access route traverses without collision: %s" % site.get_source_id()
		)
		actor.request_test_motion(Vector2(0.0, stand.y - actor.global_position.y))
		await physics_frame
		_check(
			actor.motion_finished and actor.last_collision == null,
			"approach stand is physically reachable: %s" % site.get_source_id()
		)
		actor.set("facing", Vector2.UP)
		_check(
			site.try_interact(actor, 0),
			"reachable stand accepts its authored action: %s" % site.get_source_id()
		)
		var pending: Dictionary = site._pending.duplicate(true)
		var rejection := pair.authority.submit_intent(pending)
		site.receive_authoritative_result(
			pending.intent_id, rejection, pair.authority.project_state(site.get_source_id())
		)
		actor.request_test_motion(Vector2(0.0, spawn.y - actor.global_position.y))
		await physics_frame
		actor.request_test_motion(Vector2(spawn.x - actor.global_position.x, 0.0))
		await physics_frame
		_check(
			actor.global_position.distance_to(spawn) < 35.0,
			"same approach allows a safe physical retreat: %s" % site.get_source_id()
		)
		_cleanup(pair)


func _authority_failures_and_retry() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var actor: CharacterBody2D = pair.actor
	var authority: Node = pair.authority
	var submitted: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): submitted.append(intent))
	actor.global_position = site.get_stand_position()
	actor.set("facing", Vector2.UP)
	var before: Dictionary = authority.snapshot()
	before.inventory["oak_wood"] = 0
	var broke_authority := FIXTURE_SCRIPT.new()
	broke_authority.configure(before)
	var broken_result := broke_authority.submit_intent(
		_make_expected_quarry_intent(site, "brace_east_shelf", {"oak_wood": 2}, "east_braced")
	)
	_check(
		broken_result.status == "rejected",
		"insufficient material rejected by authoritative boundary"
	)
	_check(
		broke_authority.snapshot().inventory.oak_wood == 0,
		"failed debit is atomic and changes nothing"
	)

	authority.interrupt_next_commit = true
	_check(site.try_interact(actor), "first submit accepted into the pending intent lane")
	var original: Dictionary = submitted[0]
	var interrupted: Dictionary = authority.submit_intent(original)
	_check(interrupted.status == "interrupted", "interrupted transaction reports no false success")
	_check(
		authority.snapshot().inventory.oak_wood == 2,
		"interrupted pre-commit attempt leaves balance intact"
	)
	_check(
		site.receive_authoritative_result(
			original.intent_id, interrupted, authority.project_state(site.get_source_id())
		),
		"interrupt is returned to engine"
	)
	_check(site.try_interact(actor), "same physical action can be retried after interruption")
	var retried: Dictionary = submitted[1]
	_check(
		retried.claim_id == original.claim_id and retried.intent_id == original.intent_id,
		"retry uses stable claim identity"
	)
	var committed: Dictionary = authority.submit_intent(retried)
	_check(committed.status == "committed", "safe retry commits exactly once")
	_check(authority.snapshot().inventory.oak_wood == 0, "retry debits only once")
	site.receive_authoritative_result(
		retried.intent_id, committed, authority.project_state(site.get_source_id())
	)
	var duplicate := authority.submit_intent(original)
	_check(duplicate.status == "rejected", "duplicate claim is rejected by authority")
	_check(authority.snapshot().inventory.oak_wood == 0, "duplicate cannot debit twice")
	var invalid_claim: Dictionary = original.duplicate(true)
	invalid_claim.source_id = "forged_site"
	_check(
		authority.submit_intent(invalid_claim).status == "rejected",
		"tampered stable source identity is rejected"
	)
	_cleanup(pair)


func _candidate_claims_capacity_and_reload() -> void:
	var pair := await _make_site(1)
	var site: NativePoiSite = pair.site
	var actor: CharacterBody2D = pair.actor
	var authority: Node = pair.authority
	var submitted: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): submitted.append(intent))
	actor.global_position = site.get_stand_position()
	actor.set("facing", Vector2.UP)
	authority.force_bag_full = true
	_check(site.try_interact(actor, 0), "finite reed resource emits a candidate transaction")
	var claim: Dictionary = submitted.back()
	var full_result: Dictionary = authority.submit_intent(claim)
	_check(full_result.status == "rejected", "bag-full reward is rejected")
	_check(
		authority.snapshot().inventory.reed_fibre == 1, "bag-full failure grants no fake material"
	)
	site.receive_authoritative_result(
		claim.intent_id, full_result, authority.project_state(site.get_source_id())
	)
	authority.force_bag_full = false
	_check(
		site.try_interact(actor, 0),
		"same uncommitted candidate remains claimable after capacity returns"
	)
	var candidate: Dictionary = submitted.back()
	_check(candidate.claim_id.ends_with("/g0"), "replenishable claim generation is owner-projected")
	var granted: Dictionary = authority.submit_intent(candidate)
	_check(granted.status == "committed", "finite candidate commits only through fixture boundary")
	site.receive_authoritative_result(
		candidate.intent_id, granted, authority.project_state(site.get_source_id())
	)
	var snapshot: Dictionary = authority.snapshot()
	var reload_fixture := FIXTURE_SCRIPT.new()
	reload_fixture.configure(snapshot)
	var reloaded_projection: Dictionary = reload_fixture.project_state(site.get_source_id())
	_check(
		reload_fixture.submit_intent(candidate).status == "rejected",
		"saved claim ledger rejects a duplicate after fixture reload"
	)
	_check(
		reloaded_projection.claim_generation.sluice_reeds == 1,
		"save/reload projection preserves generation"
	)
	_check(
		reloaded_projection.site_state.is_empty(),
		"resource claims do not invent unrelated world facts"
	)
	var too_soon: Dictionary = reload_fixture.submit_intent(
		_clone_claim_with_generation(candidate, 1)
	)
	_check(too_soon.status == "rejected", "reload preserves candidate cooldown")
	reload_fixture.advance_time(31.0)
	var next_cycle: Dictionary = _clone_claim_with_generation(candidate, 1)
	var next_result: Dictionary = reload_fixture.submit_intent(next_cycle)
	_check(
		next_result.status == "committed",
		"candidate returns after its authored finite recovery window"
	)
	_check(
		reload_fixture.snapshot().inventory.reed_fibre == 3,
		"new cycle receives one item through authority, not scene code"
	)
	_cleanup(pair)

	var orchard := await _make_site(1)
	var orchard_site: NativePoiSite = orchard.site
	var orchard_actor: CharacterBody2D = orchard.actor
	var orchard_authority: Node = orchard.authority
	var orchard_intents: Array[Dictionary] = []
	orchard_site.intent_requested.connect(func(intent: Dictionary): orchard_intents.append(intent))
	orchard_actor.global_position = orchard_site.get_stand_position()
	orchard_actor.set("facing", Vector2.UP)
	orchard_site.cycle_choice(1)
	_check(
		orchard_site.try_interact(orchard_actor), "declining cultivation is a real physical choice"
	)
	var leave_intent: Dictionary = orchard_intents.back()
	var leave_result: Dictionary = orchard_authority.submit_intent(leave_intent)
	_check(leave_result.status == "committed", "leave choice persists world state through owner")
	orchard_site.receive_authoritative_result(
		leave_intent.intent_id,
		leave_result,
		orchard_authority.project_state(orchard_site.get_source_id())
	)
	orchard_site.cycle_choice(-1)
	_check(
		not orchard_site.try_interact(orchard_actor),
		"alternate irreversible branch cannot be silently replayed"
	)
	_cleanup(orchard)

	var cultivated := await _make_site(1)
	var cultivated_site: NativePoiSite = cultivated.site
	var cultivator: CharacterBody2D = cultivated.actor
	var cultivation_authority: Node = cultivated.authority
	var cultivation_intents: Array[Dictionary] = []
	cultivated_site.intent_requested.connect(
		func(intent: Dictionary): cultivation_intents.append(intent)
	)
	cultivator.global_position = cultivated_site.get_stand_position()
	cultivator.set("facing", Vector2.UP)
	_check(
		cultivated_site.try_interact(cultivator),
		"orchard irrigation action is physically accessible"
	)
	var irrigation: Dictionary = cultivation_intents.back()
	var irrigation_result: Dictionary = cultivation_authority.submit_intent(irrigation)
	_check(irrigation_result.status == "committed", "orchard sluice cost passes through authority")
	cultivated_site.receive_authoritative_result(
		irrigation.intent_id,
		irrigation_result,
		cultivation_authority.project_state(cultivated_site.get_source_id())
	)
	_check(
		cultivated_site.get_site_state().orchard_channel == "flowing",
		"water feedback has an owner-projected state"
	)
	_check(
		not cultivated_site.try_interact(cultivator, 1),
		"graft knowledge is not prematurely available"
	)
	cultivation_authority.advance_time(21.0)
	cultivated_site.set_projection(
		cultivation_authority.project_state(cultivated_site.get_source_id())
	)
	_check(
		cultivated_site.projection.ready_actions.has("read_water_marks"),
		"return hook unlock survives owner time projection"
	)
	_check(
		cultivated_site.try_interact(cultivator, 1),
		"return visit action becomes eligible after the authored growth interval"
	)
	var graft_read: Dictionary = cultivation_intents.back()
	var graft_result: Dictionary = cultivation_authority.submit_intent(graft_read)
	_check(graft_result.status == "committed", "graft knowledge grants no fictional item receipt")
	cultivated_site.receive_authoritative_result(
		graft_read.intent_id,
		graft_result,
		cultivation_authority.project_state(cultivated_site.get_source_id())
	)
	_check(
		cultivated_site.get_site_state().graft_marks_read,
		"return state persists through the owner projection"
	)
	_cleanup(cultivated)


func _physical_mill_gate_and_retreat() -> void:
	var pair := await _make_site(2)
	var site: NativePoiSite = pair.site
	var actor: CharacterBody2D = pair.actor
	var authority: Node = pair.authority
	actor.global_position = Vector2(528, 536)
	actor.set("facing", Vector2.UP)
	await physics_frame
	actor.request_test_motion(Vector2(0, -140))
	await physics_frame
	_check(actor.motion_finished, "mill negative traversal ran inside a physics frame")
	_check(
		actor.last_collision != null,
		"mill outer gate blocks real CharacterBody2D traversal without cap_salvage"
	)
	_check(
		actor.global_position.y > 480.0, "blocked player remains outside the locked outer boundary"
	)
	actor.global_position = Vector2(528, 536)
	var intent_buffer: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): intent_buffer.append(intent))
	_check(
		site.try_interact(actor, 0),
		"mill can be inspected from outside before the outer access capability"
	)
	var observation: Dictionary = intent_buffer.back()
	var observed: Dictionary = authority.submit_intent(observation)
	_check(observed.status == "committed", "outer inspection requires no salvage capability")
	site.receive_authoritative_result(
		observation.intent_id, observed, authority.project_state(site.get_source_id())
	)
	actor.global_position = site.get_stand_position()
	_check(
		not site.try_interact(actor), "repair action is denied without owner-projected cap_salvage"
	)
	actor.global_position = Vector2(528, 536)
	authority.set_capabilities(["cap_salvage"])
	site.set_projection(authority.project_state(site.get_source_id()))
	await physics_frame
	actor.request_test_motion(Vector2(0, -140))
	await physics_frame
	_check(
		actor.global_position.y < 400.0 and actor.global_position.y > 314.0,
		"cap_salvage opens the outer POI boundary"
	)
	actor.request_test_motion(Vector2(0, -170))
	await physics_frame
	_check(actor.global_position.y < 270.0, "cap_salvage opens the physical maintenance crossing")
	actor.request_test_motion(Vector2(0, 140))
	await physics_frame
	_check(
		actor.global_position.y > 314.0, "player can retreat from maintenance walk to outer mill"
	)
	actor.request_test_motion(Vector2(0, 180))
	await physics_frame
	_check(actor.global_position.y > 520.0, "player can safely retreat out of the outer gate")
	actor.global_position = site.get_stand_position()
	_check(site.try_interact(actor), "repair becomes reachable at the inner repair stand")
	var repair: Dictionary = intent_buffer.back()
	_check(repair.action_id == "repair_waterwheel", "native mill action is the repair transaction")
	var insufficient_fixture := FIXTURE_SCRIPT.new()
	var poor_snapshot: Dictionary = authority.snapshot()
	poor_snapshot.inventory["oak_wood"] = 0
	poor_snapshot.inventory["iron_scrap"] = 1
	insufficient_fixture.configure(poor_snapshot)
	var failure: Dictionary = insufficient_fixture.submit_intent(repair)
	_check(failure.status == "rejected", "mill repair requires its non-free material cost")
	_check(
		insufficient_fixture.snapshot().site_state.get(site.get_source_id(), {}).is_empty(),
		"failed mill repair does not change machinery state"
	)
	var repaired: Dictionary = authority.submit_intent(repair)
	_check(repaired.status == "committed", "affordable mill repair commits through the owner")
	site.receive_authoritative_result(
		repair.intent_id, repaired, authority.project_state(site.get_source_id())
	)
	_check(
		site.get_site_state().mill_wheel == "turning",
		"repair result projects the operating wheel state"
	)
	_check(
		(
			authority.snapshot().inventory.oak_wood == 1
			and authority.snapshot().inventory.iron_scrap == 0
		),
		"mill material costs are debited once by authority"
	)
	_check(
		site.try_interact(actor, 1),
		"repaired maintenance site exposes its finite fastener candidate"
	)
	var fastener: Dictionary = intent_buffer.back()
	var fastener_result: Dictionary = authority.submit_intent(fastener)
	_check(
		fastener_result.status == "committed", "finite mill candidate uses the same owner contract"
	)
	_cleanup(pair)


func _make_site(index: int) -> Dictionary:
	var fixture := FIXTURE_SCRIPT.new()
	fixture.configure()
	root.add_child(fixture)
	var packed := load(SCENES[index]) as PackedScene
	var site := packed.instantiate() as NativePoiSite
	root.add_child(site)
	await process_frame
	site.set_projection(fixture.project_state(site.get_source_id()))
	var actor := CharacterBody2D.new()
	actor.set_script(ACTOR_SCRIPT)
	actor.collision_layer = 2
	actor.collision_mask = 1
	var shape := CircleShape2D.new()
	shape.radius = 10.0
	var collision := CollisionShape2D.new()
	collision.shape = shape
	actor.add_child(collision)
	root.add_child(actor)
	actor.global_position = site.get_spawn_position()
	await physics_frame
	return {"site": site, "actor": actor, "authority": fixture}


func _make_expected_quarry_intent(
	site: NativePoiSite, action_id: String, costs: Dictionary, state_value: String
) -> Dictionary:
	var object_id := action_id
	var claim_id := "%s/%s/%s" % [site.get_source_id(), object_id, action_id]
	return {
		"contract_id": "soh.native_poi.intent.v1",
		"contract_version": 1,
		"intent_id": "%s|%s|%s|%s" % [site.get_source_id(), object_id, action_id, claim_id],
		"source_id": site.get_source_id(),
		"object_id": object_id,
		"action_id": action_id,
		"claim_id": claim_id,
		"claim_policy": "once",
		"cooldown_seconds": 0.0,
		"requires_capabilities": [],
		"required_state": [],
		"required_state_values": {},
		"costs": costs,
		"rewards": {},
		"state_delta": {"quarry_route": state_value},
		"unlock_actions": {},
		"choice_group": "quarry_route",
		"catalog_source": "fixture candidate",
		"provisional_test_only": true
	}


func _clone_claim_with_generation(intent: Dictionary, generation: int) -> Dictionary:
	var copy := intent.duplicate(true)
	var base := "%s/%s/%s" % [copy.source_id, copy.object_id, copy.action_id]
	copy.claim_id = "%s/g%d" % [base, generation]
	copy.intent_id = "%s|%s|%s|%s" % [copy.source_id, copy.object_id, copy.action_id, copy.claim_id]
	return copy


func _cleanup(pair: Dictionary) -> void:
	for key: String in ["site", "actor", "authority"]:
		var node: Node = pair.get(key)
		if is_instance_valid(node):
			node.queue_free()
	await process_frame


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("Assertion failed: %s" % message)

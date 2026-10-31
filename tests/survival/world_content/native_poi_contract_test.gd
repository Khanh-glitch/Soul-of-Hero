extends SceneTree

# gdlint: disable=max-file-lines
# Direct global_position assignments below are setup teleports; only
# request_test_motion followed by the actor's completion signal counts as traversal.

const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const PHASE_FIXTURE := preload(
	"res://tests/survival/world_content/a8_run_phase_projection_fixture.gd"
)
const VECTOR_UTIL := preload("res://game/survival/world_content/scripts/native_poi_vectors.gd")
const SCENES := [
	"res://game/survival/world_content/scenes/south_quarry.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill.tscn",
	"res://game/survival/world_content/scenes/fourth_salt_lookout_test.tscn"
]
const SHELL_SCENES := [
	"res://game/survival/world_content/scenes/south_quarry_overworld.tscn",
	"res://game/survival/world_content/scenes/south_orchard_ruin_overworld.tscn",
	"res://game/survival/world_content/scenes/south_crown_mill_overworld.tscn"
]
const TRANSFORM_CELLS := [Vector2i(30, 280), Vector2i(140, 360), Vector2i(120, 300)]
const TRANSFORM_ROOTS := [Vector2(424, 4424), Vector2(2184, 5704), Vector2(1864, 4744)]
const ENTRANCE_X := [480.0, 480.0, 526.0]

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_vector_pair_compatibility()
	await _scene_and_data_contracts()
	_mill_action_authority_gates()
	await _type_aware_owner_state_gates()
	await _interaction_eligibility_and_choice()
	await _intent_boundary_adversarial_tests()
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


func _mill_action_authority_gates() -> void:
	var parsed: Variant = JSON.parse_string(
		FileAccess.get_file_as_string(
			"res://data/survival/world_content/sites/south_crown_mill.json"
		)
	)
	_check(parsed is Dictionary, "Mill source definition parses for owner-readiness checks")
	if not parsed is Dictionary:
		return
	var actions: Dictionary = {}
	for entry: Dictionary in parsed.get("choices", []) + parsed.get("actions", []):
		actions[str(entry.get("action_id", ""))] = entry
	var repair: Dictionary = actions.get("repair_waterwheel", {})
	_check(
		repair.get("requires_capabilities", []).has("cap_salvage")
		and not bool(repair.get("owner_ready_required", false)),
		"Mill repair requires the owner-projected salvage capability, not fixture readiness"
	)
	_check(
		bool(actions.get("recover_fastener", {}).get("owner_ready_required", false)),
		"Mill fastener source remains unavailable without trusted owner readiness"
	)
	var gates: Array = parsed.get("gates", [])
	var retreat_gates := gates.size() == 2
	for gate: Dictionary in gates:
		retreat_gates = retreat_gates and bool(gate.get("retreat_one_way", false))
	_check(retreat_gates, "locked Mill access gates preserve one-way outward retreat")


func _vector_pair_compatibility() -> void:
	var fallback := Vector2(9, 11)
	_check(VECTOR_UTIL.from_pair([4, 8]) == Vector2(4, 8), "valid JSON pair becomes Vector2")
	_check(VECTOR_UTIL.from_pair([4], fallback) == fallback, "short pair safely uses fallback")
	_check(
		VECTOR_UTIL.from_pair([4, 8, 12], fallback) == fallback, "long pair safely uses fallback"
	)
	_check(VECTOR_UTIL.from_pair(["4", 8], fallback) == fallback, "string component is rejected")
	_check(
		VECTOR_UTIL.from_pair([INF, 8], fallback) == fallback, "non-finite component is rejected"
	)
	_check(
		VECTOR_UTIL.from_int_pair([30, 280]) == Vector2i(30, 280),
		"valid canonical cell becomes Vector2i"
	)
	_check(
		VECTOR_UTIL.from_int_pair([30.5, 280], Vector2i(-1, -1)) == Vector2i(-1, -1),
		"fractional canonical cell is rejected without truncation"
	)


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
		var surface_blocker_count := 0
		for child: Node in site.get_children():
			if str(child.name).begins_with("SurfaceBlocker_"):
				surface_blocker_count += 1
		var expected_surface_blockers := 0
		if site.get_source_id() == "poi_crown_south_orchard":
			expected_surface_blockers = 3
		elif site.get_source_id() == "poi_crown_south_mill":
			expected_surface_blockers = 2
		_check(
			surface_blocker_count == expected_surface_blockers,
			"water/deadfall blockers are explicit local physical geometry"
		)
		_check(
			site.definition.get("source", {}).has("poi_id"),
			"site source / anchor identity exists: %s" % site.get_source_id()
		)
		if site.definition.has("visual_layout"):
			_assert_site_art(site)
			match site.get_source_id():
				"poi_crown_south_quarry":
					_check(
						site.has_node(
							"SourceBackedWorldArt/A8_SourceSized_Props/unstable_seam_warning"
						),
						"Quarry warns visibly while both routes remain unworked"
					)
				"poi_crown_south_orchard":
					_check(
						site.has_node(
							"SourceBackedWorldArt/A8_SourceSized_Props/sluice_blocking_deadfall"
						),
						"Orchard shows the fallen sluice before the flow state changes"
					)
				"poi_crown_south_mill":
					_check(
						site.has_node(
							"SourceBackedWorldArt/A8_SourceSized_Props/seized_race_warning"
						),
						"Mill shows the stopped-wheel cue before repair"
					)
		site.queue_free()
		await process_frame


func _assert_site_art(site: NativePoiSite) -> void:
	var ground := site.get_node_or_null("SourceBackedWorldArt/A8_16px_Ground") as TileMapLayer
	_check(ground != null, "local worksite renders a real 16 px atlas-backed TileMapLayer")
	if ground != null:
		_check(
			ground.tile_set.tile_size == Vector2i(16, 16),
			"local terrain uses the A1 16 px tile size"
		)
		_check(
			ground.get_used_cells().size() == 60 * 38,
			"local terrain fills the aligned 960-by-608 canvas"
		)
	var surface_layer := (
		site.get_node_or_null("SourceBackedWorldArt/A8_Surface_Affordances") as TileMapLayer
	)
	_check(surface_layer != null, "local surface affordances use a real source-atlas layer")
	if surface_layer != null:
		_check(
			surface_layer.tile_set.tile_size == Vector2i(16, 16),
			"surface overlay preserves the 16 px source grid"
		)
		var expected_surface_cells := 0
		match site.get_source_id():
			"poi_crown_south_orchard":
				expected_surface_cells = 20
			"poi_crown_south_mill":
				expected_surface_cells = 8
		_check(
			surface_layer.get_used_cells().size() == expected_surface_cells,
			"only authored mud/plank surface overlay cells are rendered"
		)
	var props := site.get_node_or_null("SourceBackedWorldArt/A8_SourceSized_Props")
	_check(
		props != null and props.get_child_count() > 0,
		"local worksite renders source-cleared atlas props"
	)
	if props != null:
		for child: Node in props.get_children():
			if not child is Sprite2D:
				continue
			_check(child.scale == Vector2.ONE, "prop uses its source frame at one-to-one scale")
			_check(
				child.texture_filter == CanvasItem.TEXTURE_FILTER_NEAREST,
				"prop uses nearest filtering"
			)
			_check(
				(
					is_equal_approx(child.position.x, roundf(child.position.x))
					and is_equal_approx(child.position.y, roundf(child.position.y))
				),
				"prop uses an integer-pixel bottom anchor"
			)


func _type_aware_owner_state_gates() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var authority: PoiAuthorityFixture = pair.authority
	var meaningful_action := {
		"action_id": "typed_state_probe",
		"object_id": "typed_state_probe",
		"requires_state": ["gate_state"]
	}
	var open_only_action: Dictionary = meaningful_action.duplicate(true)
	open_only_action["requires_state_values"] = {"gate_state": ["open"]}
	var cases: Array[Dictionary] = [
		{"label": "meaningful String", "present": true, "value": "open", "meaningful": true},
		{"label": "other nonempty String", "present": true, "value": "closed", "meaningful": true},
		{"label": "true Boolean", "present": true, "value": true, "meaningful": true},
		{"label": "false Boolean", "present": true, "value": false, "meaningful": false},
		{"label": "empty String", "present": true, "value": "", "meaningful": false},
		{"label": "whitespace String", "present": true, "value": "  \t", "meaningful": false},
		{"label": "null", "present": true, "value": null, "meaningful": false},
		{"label": "integer", "present": true, "value": 1, "meaningful": false},
		{"label": "array", "present": true, "value": ["open"], "meaningful": false},
		{"label": "object", "present": true, "value": {"state": "open"}, "meaningful": false},
		{"label": "absent", "present": false, "meaningful": false},
	]
	var next_revision := 1
	for case: Dictionary in cases:
		var snapshot: Dictionary = authority.snapshot()
		var projected_states: Dictionary = snapshot.get("site_state", {}).duplicate(true)
		var local_state: Dictionary = {}
		if bool(case.present):
			local_state["gate_state"] = case.get("value", null)
		projected_states[site.get_source_id()] = local_state
		snapshot["site_state"] = projected_states
		snapshot["projection_revision"] = next_revision
		var state_fixture := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
		state_fixture.configure(snapshot)
		var owner_projection: Dictionary = state_fixture.project_state(site.get_source_id())
		_check(
			site.set_projection(owner_projection),
			"owner fixture supplies %s at a fresh revision" % str(case.label)
		)
		var meaningful: bool = site._action_is_available(meaningful_action)
		_check(
			meaningful == bool(case.meaningful),
			"%s state has the expected type-aware prerequisite result" % str(case.label)
		)
		var authorized_value := str(case.get("value", "")) == "open" and bool(case.present)
		_check(
			site._action_is_available(open_only_action) == authorized_value,
			"%s cannot bypass the exact authorized value gate" % str(case.label)
		)
		state_fixture.free()
		next_revision += 1
	_cleanup(pair)


func _interaction_eligibility_and_choice() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var actor: WorldContentTestActor = pair.actor
	var authority: PoiAuthorityFixture = pair.authority
	var initial_projection: Dictionary = authority.project_state(site.get_source_id())
	var foreign_projection: Dictionary = initial_projection.duplicate(true)
	foreign_projection.source_id = "poi_forged_elsewhere"
	_check(not site.set_projection(foreign_projection), "foreign owner projection is rejected")
	var malformed_projection: Dictionary = initial_projection.duplicate(true)
	malformed_projection.clock_seconds = INF
	malformed_projection.projection_revision += 1
	_check(not site.set_projection(malformed_projection), "non-finite owner clock is rejected")
	var intents: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): intents.append(intent))
	actor.global_position = site.get_spawn_position()
	_check(not site.try_interact(actor), "out-of-range action is denied")
	actor.global_position = site.get_stand_position() + Vector2(31, 0)
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
			intent.contract_id == "soh.native_poi.intent.v3" and intent.contract_version == 3,
			"neutral identity and owner context use the unapproved v3 boundary"
		)
		_check(
			(
				intent.keys().size() == 16
				and intent.run_id == "fixture-run-1"
				and intent.phase_id == "ordinary"
				and intent.source_id == "poi_crown_south_quarry"
				and intent.site_instance_id == "poi_crown_south_quarry@fixture-run-1"
				and intent.actor_local_position is Vector2
				and intent.actor_facing is Vector2
				and not intent.has("costs")
				and not intent.has("rewards")
				and not intent.has("cooldown_seconds")
				and not intent.has("catalog_source")
				and not intent.has("provisional_test_only")
			),
			"default scene emits only neutral identity, owner phase and physical approach"
		)
		var result: Dictionary = authority.submit_intent(intent)
		_check(result.status == "committed", "fixture accepts affordable candidate route")
		var mismatched_receipt: Dictionary = result.duplicate(true)
		mismatched_receipt.intent_id = "forged|receipt"
		_check(
			not site.receive_authoritative_result(
				intent.intent_id, mismatched_receipt, authority.project_state(site.get_source_id())
			),
			"receipt for a different intent cannot clear or satisfy the pending action"
		)
		_check(site.has_pending_intent(), "mismatched receipt leaves the matching action pending")
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
			not site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/unstable_seam_warning"),
			"committed west route removes the unstable-seam cue without changing route collision"
		)
		_check(
			site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/west_ramp_chock"),
			"owner-projected west route adds its corresponding source-backed visual"
		)
		_check(
			not site.set_projection(initial_projection),
			"older owner revision cannot roll back a committed Quarry route"
		)
		var conflicting_projection: Dictionary = authority.project_state(site.get_source_id())
		conflicting_projection.site_state.quarry_route = "east_braced"
		_check(
			not site.set_projection(conflicting_projection),
			"same-revision conflicting route state is rejected"
		)
		_check(
			site.get_site_state().quarry_route == "west_chocked",
			"rejected stale/conflicting projections leave the accepted route unchanged"
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
		authority.snapshot().inventory.stone_chunk == 2,
		"fixture-only extraction applies its configured net item delta exactly once"
	)
	_cleanup(pair)

	var leave_pair := await _make_site(0)
	var leave_site: NativePoiSite = leave_pair.site
	var leave_actor: WorldContentTestActor = leave_pair.actor
	var leave_authority: PoiAuthorityFixture = leave_pair.authority
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


func _intent_boundary_adversarial_tests() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var fixture: PoiAuthorityFixture = pair.authority
	var neutral: Dictionary = site._make_intent(site.definition.choices[0])
	var expected_fields := [
		"contract_id",
		"contract_version",
		"intent_id",
		"world_id",
		"run_id",
		"run_epoch",
		"phase_id",
		"observed_phase_projection_revision",
		"source_id",
		"site_instance_id",
		"object_id",
		"action_id",
		"claim_id",
		"observed_projection_revision",
		"actor_local_position",
		"actor_facing"
	]
	_check(
		neutral.size() == expected_fields.size(),
		"default canonical scene emits exactly the neutral v3 field set"
	)
	for field: String in expected_fields:
		_check(neutral.has(field), "neutral action request includes %s" % field)
	for forbidden: String in [
		"costs",
		"rewards",
		"cooldown_seconds",
		"claim_policy",
		"state_delta",
		"unlock_actions",
		"catalog_source",
		"provisional_test_only",
		"a3_approval_ref"
	]:
		_check(not neutral.has(forbidden), "default scene cannot transmit %s" % forbidden)

	var forged_flag := neutral.duplicate(true)
	forged_flag["provisional_test_only"] = true
	_check(
		fixture.submit_intent(forged_flag).status == "rejected",
		"forged client provisional_test_only flag is rejected as an unknown field"
	)
	var forged_source := neutral.duplicate(true)
	forged_source["catalog_source"] = "A3-approved forged path"
	_check(
		fixture.submit_intent(forged_source).status == "rejected",
		"forged client catalog_source is rejected as an unknown field"
	)
	var injected_cost := neutral.duplicate(true)
	injected_cost["costs"] = {"oak_wood": 0}
	_check(
		fixture.submit_intent(injected_cost).status == "rejected",
		"even a zero or forged amount cannot be added to the neutral v3 request"
	)

	var no_approval := FIXTURE_SCRIPT.new()
	no_approval.configure_unapproved_production_probe()
	_check(
		no_approval.submit_intent(neutral).status == "rejected",
		"production probe fails closed when the A3-approved site/action binding is absent"
	)
	_check(
		no_approval.snapshot().inventory.oak_wood == 2,
		"no-approval rejection has no debit or receipt side effect"
	)
	no_approval.free()

	var stale := neutral.duplicate(true)
	fixture.set_capabilities(["cap_salvage"])
	_check(
		fixture.submit_intent(stale).status == "rejected",
		"owner fixture rejects a valid identity carrying a stale observed projection revision"
	)
	_check(
		site.set_projection(fixture.project_state(site.get_source_id())),
		"scene receives the newer owner revision before retrying its neutral choice"
	)
	var fresh := site._make_intent(site.definition.choices[0])
	var accepted := fixture.submit_intent(fresh)
	_check(
		accepted.status == "committed",
		"fixture positive control resolves only its own catalog after a fresh owner revision"
	)
	_check(
		fixture.snapshot().inventory.oak_wood == 0,
		"fake fixture debit is resolved from fixture catalog, not request payload"
	)
	_cleanup(pair)


func _physical_access_and_retreat_basic() -> void:
	for index: int in [0, 1]:
		var pair := await _make_site(index)
		var site: NativePoiSite = pair.site
		var actor: WorldContentTestActor = pair.actor
		var authority: PoiAuthorityFixture = pair.authority
		var spawn := site.get_spawn_position()
		var stand := site.get_stand_position()
		actor.global_position = spawn
		actor.request_test_motion(Vector2(stand.x - spawn.x, 0.0))
		await actor.await_test_motion()
		_check(
			actor.motion_finished and actor.last_collision == null,
			"outer access route traverses without collision: %s" % site.get_source_id()
		)
		actor.request_test_motion(Vector2(0.0, stand.y - actor.global_position.y))
		await actor.await_test_motion()
		_check(
			actor.motion_finished and actor.last_collision == null,
			"approach stand is physically reachable: %s" % site.get_source_id()
		)
		actor.set("facing", Vector2.UP)
		_check(
			site.try_interact(actor),
			"reachable stand accepts its authored route choice: %s" % site.get_source_id()
		)
		var pending: Dictionary = site._pending.duplicate(true)
		var rejection := authority.submit_intent(pending)
		site.receive_authoritative_result(
			pending.intent_id, rejection, authority.project_state(site.get_source_id())
		)
		actor.request_test_motion(Vector2(0.0, spawn.y - actor.global_position.y))
		await actor.await_test_motion()
		actor.request_test_motion(Vector2(spawn.x - actor.global_position.x, 0.0))
		await actor.await_test_motion()
		_check(
			actor.global_position.distance_to(spawn) < 35.0,
			"same approach allows a safe physical retreat: %s" % site.get_source_id()
		)
		_cleanup(pair)


func _authority_failures_and_retry() -> void:
	var pair := await _make_site(0)
	var site: NativePoiSite = pair.site
	var actor: WorldContentTestActor = pair.actor
	var authority: PoiAuthorityFixture = pair.authority
	var submitted: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): submitted.append(intent))
	actor.global_position = site.get_stand_position()
	actor.set("facing", Vector2.UP)
	var before: Dictionary = authority.snapshot()
	before.inventory["oak_wood"] = 0
	var broke_authority := FIXTURE_SCRIPT.new()
	broke_authority.configure(before)
	var broken_result := broke_authority.submit_intent(
		_make_expected_quarry_intent(site, "brace_east_shelf")
	)
	_check(
		broken_result.status == "rejected",
		"insufficient material rejected by authoritative boundary"
	)
	_check(
		broke_authority.snapshot().inventory.oak_wood == 0,
		"failed debit is atomic and changes nothing"
	)
	broke_authority.free()

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
	_check(
		site.get_site_state().is_empty(),
		"interrupted receipt cannot change projected site state or show false success"
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
	var saved_once: Variant = JSON.parse_string(JSON.stringify(authority.snapshot()))
	var replay_fixture := FIXTURE_SCRIPT.new()
	replay_fixture.configure(saved_once if saved_once is Dictionary else {})
	var replay := _with_owner_revision(original, int(replay_fixture.snapshot().projection_revision))
	var duplicate: Dictionary = replay_fixture.submit_intent(replay)
	_check(
		(
			duplicate.status == "rejected"
			and str(duplicate.get("reason", "")).contains("already committed")
		),
		"current-revision replay reaches the reloaded once-only claim ledger"
	)
	_check(
		replay_fixture.snapshot().inventory.oak_wood == 0,
		"replayed claim cannot debit a second time after JSON reload"
	)
	replay_fixture.free()
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
	var actor: WorldContentTestActor = pair.actor
	var authority: PoiAuthorityFixture = pair.authority
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
	var serialized_snapshot := JSON.stringify(snapshot)
	var deserialized_snapshot: Variant = JSON.parse_string(serialized_snapshot)
	_check(
		deserialized_snapshot is Dictionary,
		"owner fixture snapshot survives JSON process serialization"
	)
	var reload_fixture := FIXTURE_SCRIPT.new()
	reload_fixture.configure(deserialized_snapshot if deserialized_snapshot is Dictionary else {})
	var reloaded_projection: Dictionary = reload_fixture.project_state(site.get_source_id())
	_check(
		(
			reloaded_projection.source_id == site.get_source_id()
			and reloaded_projection.projection_revision == snapshot.projection_revision
		),
		"serialized owner projection preserves canonical identity and monotonic revision"
	)
	var replayed_candidate := _with_owner_revision(
		candidate, int(reload_fixture.snapshot().projection_revision)
	)
	var replay_result: Dictionary = reload_fixture.submit_intent(replayed_candidate)
	_check(
		(
			replay_result.status == "rejected"
			and str(replay_result.get("reason", "")).contains("Stale or foreign claim identity")
		),
		"reloaded generation rejects a stale resource claim before any second grant"
	)
	_check(
		reloaded_projection.claim_generation.sluice_reeds == 1,
		"save/reload projection preserves generation"
	)
	_check(
		reloaded_projection.site_state.is_empty(),
		"resource claims do not invent unrelated world facts"
	)
	site.set_projection(reloaded_projection)
	var cooldown_hint := site.get_context_hint(actor)
	_check(
		cooldown_hint.contains("ready in 0:30"),
		"cooldown presentation uses the owner-projected durable clock and a readable timer"
	)
	_check(
		not site.try_interact(actor, 0),
		"scene denies a locally premature retry using the accepted owner projection"
	)
	var too_soon: Dictionary = reload_fixture.submit_intent(
		_clone_claim_with_generation(
			candidate, 1, int(reload_fixture.snapshot().projection_revision)
		)
	)
	_check(too_soon.status == "rejected", "reload preserves candidate cooldown")
	reload_fixture.advance_time(31.0)
	var next_cycle: Dictionary = _clone_claim_with_generation(
		candidate, 1, int(reload_fixture.snapshot().projection_revision)
	)
	var next_result: Dictionary = reload_fixture.submit_intent(next_cycle)
	_check(
		next_result.status == "committed",
		"candidate returns after its authored finite recovery window"
	)
	_check(
		reload_fixture.snapshot().inventory.reed_fibre == 3,
		"new cycle receives one item through authority, not scene code"
	)
	reload_fixture.free()
	_cleanup(pair)

	var orchard := await _make_site(1)
	var orchard_site: NativePoiSite = orchard.site
	var orchard_actor: WorldContentTestActor = orchard.actor
	var orchard_authority: PoiAuthorityFixture = orchard.authority
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
	_check(
		orchard_site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/sluice_blocking_deadfall"),
		"leaving the channel untouched keeps the obstructing log visible"
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
	var cultivation_authority: PoiAuthorityFixture = cultivated.authority
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
		cultivated_site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/flowing_channel_reeds"),
		"accepted irrigation projects a distinct source-backed return-route prop"
	)
	_check(
		not cultivated_site.has_node(
			"SourceBackedWorldArt/A8_SourceSized_Props/sluice_blocking_deadfall"
		),
		"owner-projected flow removes the fallen-sluice blocker cue on revisit"
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
	_check(
		cultivated_site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/graft_mark_herb"),
		"owner-projected graft knowledge adds the source-sized herb marker"
	)
	_cleanup(cultivated)


func _physical_mill_gate_and_retreat() -> void:
	var pair := await _make_site(2)
	var site: NativePoiSite = pair.site
	var actor: WorldContentTestActor = pair.actor
	var authority: PoiAuthorityFixture = pair.authority
	var intents: Array[Dictionary] = []
	site.intent_requested.connect(func(intent: Dictionary): intents.append(intent))
	actor.global_position = Vector2(528, 536)
	actor.set("facing", Vector2.UP)
	await physics_frame
	actor.request_test_motion(Vector2(0, -140))
	await actor.await_test_motion()
	_check(actor.motion_finished, "mill negative traversal ran inside a physics frame")
	_check(
		actor.last_collision != null and actor.global_position.y > 480.0,
		"mill outer gate blocks physical entry without cap_salvage"
	)
	actor.request_test_motion(Vector2(0, 16))
	await actor.await_test_motion()
	_check(
		(
			actor.last_collision == null
			and actor.global_position.distance_to(Vector2(528, 536)) <= 30.0
		),
		"mill outside inspection stand is reachable by a separate physical step"
	)
	var mill_feedback: Array[String] = []
	site.player_feedback.connect(func(message: String): mill_feedback.append(message))
	var mill_inspection_accepted := site.try_interact(actor, 0)
	_check(
		mill_inspection_accepted,
		(
			"mill race is inspectable from outside before salvage capability; feedback=%s"
			% str(mill_feedback)
		)
	)
	var observation: Dictionary = intents.back()
	var observed: Dictionary = authority.submit_intent(observation)
	_check(observed.status == "committed", "outer inspection requires no salvage capability")
	site.receive_authoritative_result(
		observation.intent_id, observed, authority.project_state(site.get_source_id())
	)

	var repair_template: Dictionary = site._make_intent(site.definition.choices[0])
	_check(
		authority.submit_intent(repair_template).status == "rejected",
		"owner refuses the mill repair without salvage capability"
	)
	var repair_stand := Vector2(528, 410)
	authority.set_capabilities(["cap_salvage"])
	site.set_projection(authority.project_state(site.get_source_id()))
	var premature_fastener: Dictionary = site._make_intent(site.definition.actions[1])
	_check(
		authority.submit_intent(premature_fastener).status == "rejected",
		"owner rejects fastener salvage until an accepted wheel-repair state exists"
	)
	await physics_frame
	actor.global_position = Vector2(528, 536)
	actor.request_test_motion(Vector2(0, -140))
	await actor.await_test_motion()
	_check(
		actor.global_position.y < 400.0 and actor.global_position.y > 314.0,
		"salvage capability opens the outer gate but not the un-repaired maintenance walk"
	)
	actor.request_test_motion(Vector2(0, -120))
	await actor.await_test_motion()
	_check(
		actor.last_collision != null and actor.global_position.y > 314.0,
		"inner maintenance gate remains physically closed until the wheel is repaired"
	)
	actor.request_test_motion(repair_stand - actor.global_position)
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and actor.global_position.distance_to(repair_stand) <= 30.0,
		"repair workstation is physically reachable on the near side of the inner gate"
	)
	actor.set("facing", Vector2.UP)
	_check(site.try_interact(actor), "repair interaction is eligible from the near side")
	var repair: Dictionary = intents.back()
	_check(
		repair.action_id == "repair_waterwheel", "authored mill choice is the repair transaction"
	)
	var insufficient_fixture := FIXTURE_SCRIPT.new()
	var poor_snapshot: Dictionary = authority.snapshot()
	poor_snapshot.inventory["oak_wood"] = 0
	poor_snapshot.inventory["iron_scrap"] = 1
	var state_before_failed_repair: Dictionary = poor_snapshot.get("site_state", {}).duplicate(true)
	insufficient_fixture.configure(poor_snapshot)
	var failure: Dictionary = insufficient_fixture.submit_intent(repair)
	_check(failure.status == "rejected", "mill repair requires its non-free material cost")
	_check(
		insufficient_fixture.snapshot().site_state == state_before_failed_repair,
		"failed mill repair leaves machinery and route unchanged"
	)
	insufficient_fixture.free()
	var repaired: Dictionary = authority.submit_intent(repair)
	_check(repaired.status == "committed", "affordable mill repair commits through the owner")
	site.receive_authoritative_result(
		repair.intent_id, repaired, authority.project_state(site.get_source_id())
	)
	_check(
		site.get_site_state().get("mill_wheel", "") == "turning",
		"owner projection visibly turns the repaired wheel"
	)
	_check(
		site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/lit_race_lamp"),
		"owner-projected wheel repair adds the distinct worked-race visual"
	)
	_check(
		not site.has_node("SourceBackedWorldArt/A8_SourceSized_Props/seized_race_warning"),
		"owner-projected repair removes the seized-wheel warning visual"
	)
	await physics_frame
	actor.request_test_motion(Vector2(0, -160))
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and actor.global_position.y < 270.0,
		"accepted repair opens the physical inner gate"
	)
	var salvage_stand := Vector2(678, 278)
	actor.request_test_motion(salvage_stand - actor.global_position)
	await actor.await_test_motion()
	_check(
		actor.global_position.distance_to(salvage_stand) <= 30.0,
		"the separate fastener workstation is physically reachable beyond the repaired gate"
	)
	actor.set("facing", Vector2.UP)
	_check(site.try_interact(actor, 1), "repaired mill exposes its state-gated salvage action")
	var fastener: Dictionary = intents.back()
	_check(
		fastener.action_id == "recover_fastener", "salvage request targets the fastener work face"
	)
	var fastener_result: Dictionary = authority.submit_intent(fastener)
	_check(
		fastener_result.status == "committed",
		"finite mill candidate uses the shared owner contract"
	)
	site.receive_authoritative_result(
		fastener.intent_id, fastener_result, authority.project_state(site.get_source_id())
	)
	_check(
		int(authority.snapshot().inventory.iron_scrap) == 1,
		"finite salvage consequence is applied only by the authority fixture"
	)

	actor.request_test_motion(Vector2(528 - actor.global_position.x, 0))
	await actor.await_test_motion()
	actor.request_test_motion(Vector2(0, 410 - actor.global_position.y))
	await actor.await_test_motion()
	actor.request_test_motion(Vector2(0, 536 - actor.global_position.y))
	await actor.await_test_motion()
	_check(
		actor.last_collision == null and actor.global_position.y >= 520.0,
		"player can retreat through both repaired access gates to the safe outer walk"
	)
	authority.set_capabilities([])
	site.set_projection(authority.project_state(site.get_source_id()))
	await physics_frame
	actor.request_test_motion(Vector2(0, -140))
	await actor.await_test_motion()
	_check(
		actor.last_collision != null and actor.global_position.y > 480.0,
		"removing the owner-projected capability recloses the outer gate"
	)
	_cleanup(pair)

	var leave_pair := await _make_site(2)
	var leave_site: NativePoiSite = leave_pair.site
	var leave_actor: WorldContentTestActor = leave_pair.actor
	var leave_authority: PoiAuthorityFixture = leave_pair.authority
	leave_authority.set_capabilities(["cap_salvage"])
	leave_site.set_projection(leave_authority.project_state(leave_site.get_source_id()))
	leave_actor.global_position = Vector2(528, 410)
	leave_actor.set("facing", Vector2.UP)
	leave_site.cycle_choice(1)
	_check(leave_site.try_interact(leave_actor), "mill offers a real leave-wheel alternative")
	var leave_intent: Dictionary = leave_site._pending.duplicate(true)
	var left_seized: Dictionary = leave_authority.submit_intent(leave_intent)
	_check(left_seized.status == "committed", "leaving the wheel is an owner-committed safe choice")
	leave_site.receive_authoritative_result(
		leave_intent.intent_id,
		left_seized,
		leave_authority.project_state(leave_site.get_source_id())
	)
	_check(
		leave_site.get_site_state().get("mill_wheel", "") == "seized",
		"the leave choice preserves the visibly stopped machinery state"
	)
	leave_actor.global_position = Vector2(528, 410)
	leave_actor.request_test_motion(Vector2(0, -160))
	await leave_actor.await_test_motion()
	_check(
		leave_actor.last_collision != null and leave_actor.global_position.y > 314.0,
		"leaving the wheel seized keeps the inner salvage gate closed"
	)
	leave_actor.request_test_motion(Vector2(0, 126))
	await leave_actor.await_test_motion()
	leave_actor.request_test_motion(Vector2(0, 96))
	await leave_actor.await_test_motion()
	leave_actor.set("facing", Vector2.DOWN)
	_check(
		leave_site.try_exit(leave_actor), "safe no-repair branch keeps the return doorway usable"
	)
	leave_actor.request_test_motion(Vector2(0, 66))
	await leave_actor.await_test_motion()
	_check(
		leave_actor.last_collision == null and leave_actor.global_position.y > 600.0,
		"unrepaired Mill route permits a physical retreat to the exterior"
	)
	_cleanup(leave_pair)


func _make_site(index: int) -> Dictionary:
	var fixture := FIXTURE_SCRIPT.new()
	fixture.configure()
	root.add_child(fixture)
	var packed := load(SCENES[index]) as PackedScene
	var site := packed.instantiate() as NativePoiSite
	root.add_child(site)
	await process_frame
	site.set_projection(fixture.project_state(site.get_source_id()))
	site.apply_run_phase_projection(PHASE_FIXTURE.project(site.definition))
	var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
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


func _make_expected_quarry_intent(site: NativePoiSite, action_id: String) -> Dictionary:
	for group_name: String in ["choices", "actions"]:
		for entry: Dictionary in site.definition.get(group_name, []):
			if str(entry.get("action_id", "")) == action_id:
				return site._make_intent(entry)
	return {}


func _clone_claim_with_generation(
	intent: Dictionary, generation: int, projection_revision: int
) -> Dictionary:
	var copy := intent.duplicate(true)
	var base := "%s/%s/%s" % [copy.source_id, copy.object_id, copy.action_id]
	copy.claim_id = "%s/g%d" % [base, generation]
	copy.observed_projection_revision = projection_revision
	copy.intent_id = (
		"%s|%s|%s|%s|%s|%s|%d|%s|%d|%d"
		% [
			copy.source_id,
			copy.object_id,
			copy.action_id,
			copy.claim_id,
			copy.run_id,
			copy.site_instance_id,
			copy.run_epoch,
			copy.phase_id,
			copy.observed_phase_projection_revision,
			copy.observed_projection_revision
		]
	)
	return copy


func _with_owner_revision(intent: Dictionary, projection_revision: int) -> Dictionary:
	var copy := intent.duplicate(true)
	copy.observed_projection_revision = projection_revision
	copy.intent_id = (
		"%s|%s|%s|%s|%s|%s|%d|%s|%d|%d"
		% [
			copy.source_id,
			copy.object_id,
			copy.action_id,
			copy.claim_id,
			copy.run_id,
			copy.site_instance_id,
			copy.run_epoch,
			copy.phase_id,
			copy.observed_phase_projection_revision,
			copy.observed_projection_revision
		]
	)
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

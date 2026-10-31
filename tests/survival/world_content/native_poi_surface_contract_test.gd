extends SceneTree

# Direct global_position assignments are setup teleports, never traversal proof.

const FIXTURE_SCRIPT := preload(
	"res://game/survival/world_content/scripts/poi_authority_fixture.gd"
)
const ACTOR_SCRIPT := preload("res://tests/survival/world_content/test_actor.gd")
const PHASE_FIXTURE := preload(
	"res://tests/survival/world_content/a8_run_phase_projection_fixture.gd"
)
const SITE_SCENE := "res://game/survival/world_content/scenes/south_orchard_ruin.tscn"

var _failures: Array[String] = []
var _assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _owner_projection_is_the_only_run_state_reset_path()
	if _failures.is_empty():
		print("A8_NATIVE_POI_SURFACE_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print(
			"A8_NATIVE_POI_SURFACE_FAIL failures=%d assertions=%d" % [_failures.size(), _assertions]
		)
		quit(1)


func _owner_projection_is_the_only_run_state_reset_path() -> void:
	var authority := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
	authority.configure()
	root.add_child(authority)
	var site := (load(SITE_SCENE) as PackedScene).instantiate() as NativePoiSite
	root.add_child(site)
	await process_frame
	_check(
		site.set_projection(authority.project_state(site.get_source_id())),
		"site accepts initial test-fixture projection"
	)
	_check(
		site.apply_run_phase_projection(PHASE_FIXTURE.project(site.definition)),
		"test-only run phase projection enables the owner-gated interaction"
	)

	var actor := ACTOR_SCRIPT.new() as WorldContentTestActor
	root.add_child(actor)
	# Setup-only teleport to the physical Orchard approach for the existing
	# neutral action; no route-distance or movement claim is made in this test.
	actor.global_position = site.get_stand_position()
	actor.set("facing", Vector2.UP)
	var interaction_feedback: Array[String] = []
	site.player_feedback.connect(func(message: String): interaction_feedback.append(message))
	var orchard_interaction_accepted := site.try_interact(actor)
	_check(
		orchard_interaction_accepted,
		"Orchard choice prepares a run-local projection; feedback=%s" % str(interaction_feedback)
	)
	var intent: Dictionary = site._pending.duplicate(true)
	var receipt: Dictionary = authority.submit_intent(intent)
	_check(
		receipt.get("status") == "committed",
		"test fixture commits the existing Orchard state choice"
	)
	_check(
		site.receive_authoritative_result(
			intent.intent_id, receipt, authority.project_state(site.get_source_id())
		),
		"site accepts the matching fixture receipt and owner projection"
	)
	_check(
		site.get_site_state().get("orchard_channel") == "flowing",
		"owner projection installs the run-local irrigation state"
	)
	_check(not site.has_method("reset_run_state"), "A8 has no local new-run reset entry point")

	var environment := {
		"contract_id": "soh.a8.environment_presentation_input.v1",
		"site_id": site.get_source_id(),
		"projection_revision": 1,
		"world_time": null,
		"weather": null,
		"tide": null,
	}
	_check(
		site.apply_environment_projection(environment), "environment-only projection is accepted"
	)
	var foreign_environment := environment.duplicate(true)
	foreign_environment.site_id = "poi_forged_elsewhere"
	_check(
		not site.apply_environment_projection(foreign_environment),
		"foreign environment context is rejected"
	)
	var stale_environment := environment.duplicate(true)
	stale_environment.projection_revision = 0
	_check(
		not site.apply_environment_projection(stale_environment),
		"stale environment revision is rejected"
	)
	_check(
		site.get_site_state().get("orchard_channel") == "flowing",
		"environment presentation cannot reset or rewrite run-local owner state"
	)

	# Test-fixture simulation of a newer A0 new-run projection. A8 only renders
	# the supplied projection; this is not SaveService or two-process evidence.
	var reset_snapshot: Dictionary = authority.snapshot()
	reset_snapshot["projection_revision"] = int(reset_snapshot.get("projection_revision", 0)) + 1
	var reset_states: Dictionary = reset_snapshot.get("site_state", {}).duplicate(true)
	reset_states.erase(site.get_source_id())
	reset_snapshot["site_state"] = reset_states
	var reset_authority := FIXTURE_SCRIPT.new() as PoiAuthorityFixture
	reset_authority.configure(reset_snapshot)
	var reset_projection: Dictionary = reset_authority.project_state(site.get_source_id())
	reset_authority.free()
	_check(
		site.set_projection(reset_projection),
		"new-run reset is accepted only through a newer owner projection"
	)
	_check(
		site.get_site_state().is_empty(),
		"A8 reflects the owner's reset projection without locally deleting state"
	)

	actor.queue_free()
	site.queue_free()
	authority.queue_free()
	await process_frame


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("Assertion failed: %s" % message)

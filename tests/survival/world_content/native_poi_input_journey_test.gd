extends SceneTree

## Frame-driven input journeys through the existing A8 pilot using the current
## production Hero scene. All approaches, choices, collision checks, exits, and
## revisits use keyboard events and physics frames. Injected authority is
## projection-only fixture state, never production play.

const PILOT_SCENE := "res://game/survival/world_content/scenes/poi_pilot.tscn"
const CAPTURE_DIR := "res://.artifacts/a8-world-content/input-journeys"
const QUARRY_ID := "poi_crown_south_quarry"
const ORCHARD_ID := "poi_crown_south_orchard"
const MILL_ID := "poi_crown_south_mill"
const EXPECTED_CAPTURE_COUNT := 27

var _pilot: Node
var _failures: Array[String] = []
var _assertions := 0
var _last_axis_collided := false
var _last_collision_name := ""
var _capture_index := 0
var _headless_visual_capture_skipped := false
var _measure_walk := false
var _measured_walk_input_frames := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _journey_quarry("brace_oak", "east_braced", 554.0, 458.0)
	await _journey_quarry("chock_stone", "west_chocked", 458.0, 554.0)
	await _journey_orchard("leave_for_safety", "untouched", false)
	await _journey_orchard("clear_irrigation", "flowing", true)
	await _journey_mill_without_capability()
	await _journey_mill_leave_wheel()
	await _journey_mill_revocation_race()
	await _journey_mill_owner_projected_repair()
	_check(
		_capture_index == EXPECTED_CAPTURE_COUNT,
		(
			"all %d exterior/interior baseline and changed-state captures were requested"
			% EXPECTED_CAPTURE_COUNT
		)
	)
	if _failures.is_empty():
		if _headless_visual_capture_skipped:
			print("A8_NATIVE_POI_INPUT_JOURNEY_CAPTURE_SKIPPED renderer=headless")
		print("A8_NATIVE_POI_INPUT_JOURNEY_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print(
			(
				"A8_NATIVE_POI_INPUT_JOURNEY_FAIL failures=%d assertions=%d"
				% [_failures.size(), _assertions]
			)
		)
		quit(1)


func _journey_quarry(
	choice_option: String, expected_route: String, open_x: float, blocked_x: float
) -> void:
	await _start_pilot({})
	if choice_option == "brace_oak":
		await _capture("quarry-shell-baseline")
	if not await _enter_worksite(QUARRY_ID):
		await _stop_pilot()
		return
	if choice_option == "brace_oak":
		await _capture("quarry-interior-baseline")
	var start: Vector2 = _snapshot().get("position", Vector2.ZERO)
	var stand_ok := await _walk_to(Vector2(506.0, 378.0), "quarry-source-stand")
	_check(stand_ok, "quarry choice approach uses live movement from the interior entry")
	if choice_option == "chock_stone":
		await _press_key(KEY_BRACKETRIGHT)
		_check(
			str(_pilot.get("_feedback").text).contains("Chock the west ramp"),
			"quarry keyboard choice cycle selects the distinct west route"
		)
	await _press_key(KEY_G)
	await _settle()
	var after_choice: Dictionary = _snapshot()
	_check(
		str(after_choice.get("site_state", {}).get("quarry_route", "")) == expected_route,
		"quarry owner projection records %s" % expected_route
	)
	var quarry_feedback_phrase := (
		"east shelf is braced" if expected_route == "east_braced" else "west ramp is chocked"
	)
	_check(
		(
			str(after_choice.get("feedback", "")).contains(quarry_feedback_phrase)
			and str(after_choice.get("feedback", "")).contains("No live item")
		),
		"Quarry choice gives site-specific route feedback without claiming a reward"
	)
	var source_intents_before := _intent_count()
	await _press_key(KEY_H, "quarry-unapproved-extraction")
	var source_attempt: Dictionary = _snapshot()
	_check(
		_intent_count() == source_intents_before,
		"unapproved Quarry extraction emits no A0/A3 source intent"
	)
	var quarry_claim_generations: Dictionary = (
		source_attempt.get("fixture_state", {}).get("claim_generation", {}).get(QUARRY_ID, {})
	)
	var source_generation := int(quarry_claim_generations.get("south_seam_outcrop", 0))
	_check(
		source_generation == 0 and not source_attempt.get("fixture_state", {}).has("inventory"),
		"withheld Quarry source does not claim a generation or mint inventory"
	)
	_check(
		str(source_attempt.get("feedback", "")).contains("not projected this action as ready"),
		"Quarry explains that reward is withheld until an owner readiness projection"
	)
	_check(
		start.distance_to(after_choice.get("position", start)) > 100.0,
		"quarry choice was reached by continuous physical movement"
	)
	_check(
		_has_visual_prop("east_shelf_brace") == (expected_route == "east_braced"),
		"quarry selected route presents only its source-authored brace"
	)
	_check(
		_has_visual_prop("west_ramp_chock") == (expected_route == "west_chocked"),
		"quarry selected route presents only its source-authored chock"
	)
	await _capture("quarry-%s-choice" % expected_route)

	var traversed_open_route := await _walk_to(Vector2(open_x, 378.0))
	var route_attempt := _snapshot()
	_check(
		traversed_open_route,
		(
			"quarry selected route remains traversable; pos=%s target=%s state=%s"
			% [
				str(route_attempt.get("position", Vector2.ZERO)),
				str(Vector2(open_x, 378.0)),
				str(route_attempt.get("site_state", {}))
			]
		)
	)
	var open_reached := await _walk_axis_to("move_up", KEY_W, 220.0)
	_check(
		open_reached and not _last_axis_collided, "quarry owner-selected route is physically open"
	)
	await _walk_axis_to("move_down", KEY_S, 378.0)
	var blocked_route_reached := await _walk_axis_to(
		"move_left" if blocked_x < 500.0 else "move_right",
		KEY_A if blocked_x < 500.0 else KEY_D,
		blocked_x
	)
	_check(blocked_route_reached, "quarry alternate blocker is approached from the south")
	var blocked_reached := await _walk_axis_to("move_up", KEY_W, 220.0)
	var blocked_position: Vector2 = _snapshot().get("position", Vector2.ZERO)
	_check(
		not blocked_reached and _last_axis_collided and blocked_position.y > 345.0,
		"quarry unselected route remains a live collision blocker"
	)
	await _walk_axis_to("move_down", KEY_S, 378.0)
	await _walk_axis_to(
		"move_left" if open_x > 500.0 else "move_right", KEY_A if open_x > 500.0 else KEY_D, 506.0
	)
	await _exit_and_revisit(QUARRY_ID, "quarry_route", expected_route)
	await _stop_pilot()


func _journey_orchard(choice_action: String, expected_channel: String, cross_open: bool) -> void:
	var seed := {"ready_actions": ["read_water_marks"]} if cross_open else {}
	await _start_pilot(seed, 1)
	if cross_open:
		await _capture("orchard-shell-baseline")
	if not await _enter_worksite(ORCHARD_ID):
		await _stop_pilot()
		return
	if cross_open:
		await _capture("orchard-interior-baseline")
	_check(
		await _walk_to(Vector2(510.0, 370.0)),
		"orchard choice reached from the doorway by frame-based movement"
	)
	if choice_action == "leave_for_safety":
		await _press_key(KEY_BRACKETRIGHT)
	await _press_key(KEY_G)
	await _settle()
	var after_choice: Dictionary = _snapshot()
	_check(
		str(after_choice.get("site_state", {}).get("orchard_channel", "")) == expected_channel,
		"orchard choice records %s in owner projection" % expected_channel
	)
	var orchard_feedback_phrase := "Water now runs" if cross_open else "channel stays blocked"
	_check(
		(
			str(after_choice.get("feedback", "")).contains(orchard_feedback_phrase)
			and str(after_choice.get("feedback", "")).contains("No live item")
		),
		"Orchard choice explains its water and safe-return consequence without a reward claim"
	)
	_check(
		_has_visual_prop("flowing_channel_reeds") == cross_open,
		"orchard water route presentation matches owner-projected state"
	)
	if cross_open:
		_check(
			_has_visual_prop("sluice_blocking_deadfall") == false,
			"cleared orchard channel removes the authored deadfall prop"
		)
		await _capture("orchard-flowing-channel")
	else:
		await _walk_axis_to("move_left", KEY_A, 496.0)
		var reached_north_bank := await _walk_axis_to("move_up", KEY_W, 250.0)
		var blocked_position: Vector2 = _snapshot().get("position", Vector2.ZERO)
		_check(
			not reached_north_bank and _last_axis_collided and blocked_position.y > 304.0,
			"untouched orchard channel physically blocks the crossing"
		)
		await _walk_axis_to("move_down", KEY_S, 370.0)
		await _capture("orchard-blocked-channel")
	if cross_open:
		await _walk_axis_to("move_left", KEY_A, 496.0)
		_check(
			await _walk_axis_to("move_up", KEY_W, 250.0),
			"owner-opened orchard boardwalk is traversable under live collision"
		)
		_check(
			await _walk_axis_to("move_down", KEY_S, 370.0),
			"orchard boardwalk returns to the graft-mark work side"
		)
		await _press_key(KEY_W)
		await _press_key(KEY_Y)
		await _settle()
		var graft_attempt := _snapshot()
		var graft_hero := _hero()
		var graft_message := (
			"pos=%s face=%s stand=%.1f feedback=%s"
			% [
				str(graft_hero.global_position),
				str(graft_hero.get("facing_direction")),
				graft_hero.global_position.distance_to(Vector2(510.0, 370.0)),
				str(graft_attempt.get("feedback", "")),
			]
		)
		_check(
			bool(graft_attempt.get("site_state", {}).get("graft_marks_read", false)),
			"owner-ready graft-mark action fails; " + graft_message
		)
		_check(
			_has_visual_prop("graft_mark_herb"),
			"orchard graft-mark reading reveals the source-authored visual cue"
		)
		await _capture("orchard-graft-marks-read")
	await _exit_and_revisit(ORCHARD_ID, "orchard_channel", expected_channel)
	await _stop_pilot()


func _journey_mill_without_capability() -> void:
	await _start_pilot({}, 2)
	await _capture("mill-shell-without-capability")
	if not await _enter_worksite(MILL_ID):
		await _stop_pilot()
		return
	await _capture("mill-interior-without-capability")
	var reached_maintenance := await _walk_axis_to("move_up", KEY_W, 420.0)
	var blocked_position: Vector2 = _snapshot().get("position", Vector2.ZERO)
	_check(
		not reached_maintenance and _last_axis_collided and blocked_position.y > 480.0,
		"mill owner capability gate blocks physical entry without salvage capability"
	)
	_check(
		not _snapshot().get("site_state", {}).has("mill_wheel"),
		"missing capability produces no wheel repair or world-state change"
	)
	var site: NativePoiSite = _pilot.get("_site") as NativePoiSite
	var gate_bodies: Array = site.get("_gate_bodies") if site != null else []
	var outer_gate := gate_bodies[0] as StaticBody2D if not gate_bodies.is_empty() else null
	var outer_shape := (
		outer_gate.get_child(0) as CollisionShape2D if is_instance_valid(outer_gate) else null
	)
	_check(
		(
			outer_shape != null
			and outer_shape.one_way_collision
			and outer_shape.one_way_collision_direction == Vector2.UP
		),
		"locked Mill gate blocks entry from south while preserving outward retreat"
	)
	await _walk_axis_to("move_down", KEY_S, 560.0)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"mill doorway remains a physical retreat when the salvage gate is closed"
	)

	var shell: NativePoiShell = _pilot.get("_shell") as NativePoiShell
	if shell == null:
		_check(false, "Mill exterior is available for the gate falsification journey")
		await _stop_pilot()
		return
	await _walk_axis_to("move_down", KEY_S, shell.get_entry_position().y + 32.0)
	await _walk_axis_to("move_up", KEY_W, shell.get_entry_position().y - 3.0)
	await _press_key(KEY_G)
	await _settle()
	site = _pilot.get("_site") as NativePoiSite
	gate_bodies = site.get("_gate_bodies") if site != null else []
	outer_gate = gate_bodies[0] as StaticBody2D if not gate_bodies.is_empty() else null
	outer_shape = (
		outer_gate.get_child(0) as CollisionShape2D if is_instance_valid(outer_gate) else null
	)
	if outer_shape == null:
		_check(false, "Mill outer gate collider is available for isolated mutation")
		await _stop_pilot()
		return
	var safe_direction := outer_shape.one_way_collision_direction
	outer_shape.one_way_collision_direction = Vector2.DOWN
	await _settle()
	var mutant_reached := await _walk_axis_to("move_up", KEY_W, 420.0)
	if mutant_reached and _snapshot().get("position", Vector2.ZERO).y < 480.0:
		print(
			(
				"A8_MUTATION_PROBE_DETECTED mutation=outer_gate_direction_down "
				+ "observation=unauthorized_entry_without_capability"
			)
		)
	else:
		_check(false, "reversed one-way gate mutant was not observed crossing into Mill")
	outer_shape.one_way_collision_direction = safe_direction
	await _settle()
	_check(
		await _walk_axis_to("move_down", KEY_S, 560.0),
		"restored outward-only Mill gate remains retreatable after capability loss"
	)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"owner-projected capability loss does not trap the pilot behind the Mill gate"
	)
	await _stop_pilot()


func _journey_mill_leave_wheel() -> void:
	await _start_pilot({}, 2)
	await _capture("mill-shell-leave-wheel-baseline")
	if not await _enter_worksite(MILL_ID):
		await _stop_pilot()
		return
	await _capture("mill-interior-leave-wheel-baseline")
	_check(
		await _walk_to(Vector2(528.0, 520.0)),
		"Mill leave-wheel alternative is approached physically on the safe exterior side"
	)
	await _press_key(KEY_BRACKETRIGHT)
	_check(
		str(_pilot.get("_feedback").text).contains("Leave the wheel seized"),
		"Mill keyboard choice selects the safe leave-wheel alternative"
	)
	await _press_key(KEY_G)
	await _settle()
	var seized_snapshot: Dictionary = _snapshot()
	_check(
		str(seized_snapshot.get("site_state", {}).get("mill_wheel", "")) == "seized",
		"owner projection records the no-repair Mill alternative"
	)
	_check(
		(
			str(seized_snapshot.get("feedback", "")).contains("wheel stays seized")
			and str(seized_snapshot.get("feedback", "")).contains("No live item")
		),
		"Mill explains the still-seized wheel and safe return without granting salvage"
	)
	await _capture("mill-wheel-left-seized")
	var crossed_closed_gate := await _walk_axis_to("move_up", KEY_W, 420.0)
	var blocked_position: Vector2 = _snapshot().get("position", Vector2.ZERO)
	_check(
		not crossed_closed_gate and _last_axis_collided and blocked_position.y > 480.0,
		"leave-wheel alternative keeps unauthorized physical entry behind the closed gate"
	)
	await _walk_axis_to("move_down", KEY_S, 560.0)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"leave-wheel decision retains a safe physical retreat to the exterior"
	)
	if not await _enter_worksite(MILL_ID):
		await _stop_pilot()
		return
	_check(
		str(_snapshot().get("site_state", {}).get("mill_wheel", "")) == "seized",
		"Mill revisit preserves the owner-projected seized-wheel state"
	)
	await _capture("mill-wheel-seized-revisit")
	await _walk_axis_to("move_down", KEY_S, 560.0)
	await _press_key(KEY_G)
	await _settle()
	await _stop_pilot()


func _journey_mill_revocation_race() -> void:
	# The physical input creates a pending neutral request. The fixture owner
	# revokes its projection before validation, so the old revision must reject.
	await _start_pilot({"capabilities": ["cap_salvage"]}, 2)
	await _capture("mill-shell-pending-revocation")
	if not await _enter_worksite(MILL_ID):
		await _stop_pilot()
		return
	await _capture("mill-interior-pending-revocation")
	_check(
		await _walk_to(Vector2(528.0, 410.0)),
		"revocation-race action is approached with physical input"
	)
	var authority := _pilot.get("_journey_authority") as PoiJourneyAuthorityFixture
	var site := _pilot.get("_site") as NativePoiSite
	_check(authority != null and site != null, "owner and neutral site are mounted for race")
	if authority == null or site == null:
		await _stop_pilot()
		return
	var owner_callback := Callable(_pilot, "_on_intent_requested")
	_check(
		site.intent_requested.is_connected(owner_callback),
		"neutral request is connected to the test owner before race isolation"
	)
	if site.intent_requested.is_connected(owner_callback):
		site.intent_requested.disconnect(owner_callback)
	await _press_key(KEY_G)
	_check(site.has_pending_intent(), "physical Mill input leaves a neutral request pending")
	var pending_value: Variant = site.get("_pending")
	var pending: Dictionary = pending_value.duplicate(true) if pending_value is Dictionary else {}
	_check(
		str(pending.get("action_id", "")) == "repair_waterwheel",
		"pending request retains exact authored repair identity"
	)
	var intent_id := str(pending.get("intent_id", ""))
	authority.replace_capabilities([])
	var revoked_projection := authority.project_state(MILL_ID)
	_check(
		site.set_projection(revoked_projection),
		"capability revocation advances the owner projection before validation"
	)
	var rejected := authority.submit_intent(pending)
	_check(
		str(rejected.get("status", "")) == "rejected",
		"owner rejects the stale pending request after permission revocation"
	)
	_check(
		str(rejected.get("reason", "")).contains("stale owner-projected journey context"),
		"revocation race is rejected by the changed projection revision"
	)
	_check(
		site.receive_authoritative_result(intent_id, rejected, revoked_projection),
		"neutral pending request accepts the owner's explicit rejection"
	)
	_check(not site.has_pending_intent(), "rejected request clears without a local commit")
	_check(
		not _snapshot().get("site_state", {}).has("mill_wheel"),
		"revocation race cannot manufacture a Mill repair consequence"
	)
	await _capture("mill-pending-request-revoked")
	var exit_position := site.get_exit_position()
	_check(
		await _walk_to(exit_position), "revoked request still permits a continuous physical retreat"
	)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"revoked pending request leaves the physical doorway open for exit"
	)
	await _stop_pilot()


func _journey_mill_owner_projected_repair() -> void:
	# This seed is an explicit A8 test projection, not an A3 binding or live grant.
	await _start_pilot({"capabilities": ["cap_salvage"]}, 2)
	await _capture("mill-shell-owner-projection-seed")
	if not await _enter_worksite(MILL_ID):
		await _stop_pilot()
		return
	await _capture("mill-interior-owner-projection-seed")
	_check(
		await _walk_to(Vector2(528.0, 526.0)),
		"mill exterior observation stand is approached with live input"
	)
	await _press_key(KEY_H)
	await _settle()
	_check(
		bool(_snapshot().get("site_state", {}).get("mill_race_observed", false)),
		"mill race marks can be read without granting an item or completing the site"
	)
	_check(
		await _walk_to(Vector2(528.0, 410.0)),
		"owner-projected salvage gate admits the pilot to the repair approach"
	)
	await _press_key(KEY_G)
	await _settle()
	var repaired_snapshot: Dictionary = _snapshot()
	_check(
		str(repaired_snapshot.get("site_state", {}).get("mill_wheel", "")) == "turning",
		"test-only ready owner projection exposes the authored repair consequence"
	)
	_check(
		(
			str(repaired_snapshot.get("feedback", "")).contains("wheel turns")
			and str(repaired_snapshot.get("feedback", "")).contains("No live item")
		),
		"Mill repair feedback names the turning race and withholds unapproved items"
	)
	var fixture_state: Dictionary = _snapshot().get("fixture_state", {})
	_check(
		(
			not fixture_state.has("inventory")
			and not fixture_state.has("currency")
			and not fixture_state.has("save_data")
		),
		"journey authority has no item, currency, or save mutation surface"
	)
	_check(
		(
			_has_visual_prop("repaired_race_bearing")
			and _has_visual_prop("lit_race_lamp")
			and not _has_visual_prop("seized_race_warning")
		),
		"mill repair updates its source-authored presentation"
	)
	await _capture("mill-owner-projected-wheel-repair")
	# Cross the unknown-depth race above the fixed plank bridge, then approach
	# the bank-side fastener from its authored safe stand.
	await _walk_axis_to("move_up", KEY_W, 270.0)
	await _walk_axis_to("move_right", KEY_D, 678.0)
	await _walk_axis_to("move_up", KEY_W, 248.0)
	_check(
		_hero().global_position.distance_to(Vector2(678.0, 248.0)) <= 30.0,
		(
			"repaired mill route physically reaches the fastener source; position=%s "
			% str(_hero().global_position)
		)
	)
	var intent_count_before := _intent_count()
	await _press_key(KEY_Y)
	await _settle()
	_check(
		_intent_count() == intent_count_before,
		"fastener interaction emits no intent without trusted source readiness"
	)
	_check(
		str(_snapshot().get("site_state", {}).get("mill_wheel", "")) == "turning",
		"unbound fastener source causes no additional owner state change"
	)
	var authority := _pilot.get("_journey_authority") as PoiJourneyAuthorityFixture
	var site := _pilot.get("_site") as NativePoiSite
	_check(
		authority != null and site != null, "Mill owner projection can be refreshed in the fixture"
	)
	if authority != null and site != null:
		authority.replace_capabilities([])
		_check(
			site.set_projection(authority.project_state(MILL_ID)),
			"revoked owner capability projection is accepted with a newer revision"
		)
		await _settle()
		await _capture("mill-fastener-capability-revoked")
		var revoked_intent_count := _intent_count()
		await _press_key(KEY_Y)
		await _settle()
		_check(
			_intent_count() == revoked_intent_count,
			"permission revoked at the fastener prevents a new physical intent"
		)
		_check(
			str(_snapshot().get("site_state", {}).get("mill_wheel", "")) == "turning",
			"capability revocation does not change owner-projected site state"
		)
	await _exit_and_revisit(MILL_ID, "mill_wheel", "turning")
	await _stop_pilot()


func _start_pilot(owner_seed: Dictionary, site_index: int = 0) -> void:
	await _stop_pilot()
	var packed := load(PILOT_SCENE) as PackedScene
	if packed == null:
		_check(false, "existing A8 pilot scene loads")
		return
	_pilot = packed.instantiate()
	_pilot.set("journey_test_mode", true)
	_pilot.set("journey_owner_projection_seed", owner_seed)
	root.add_child(_pilot)
	await _settle()
	var hero_snapshot: Dictionary = _snapshot()
	_check(
		str(hero_snapshot.get("hero_scene_path", "")) == "res://game/characters/knight/knight.tscn",
		"journey uses the current in-game Hero PackedScene"
	)
	_check(
		str(hero_snapshot.get("hero_script_path", "")) == "res://game/characters/knight/knight.gd",
		"journey executes the Hero script from the A8 checkout; A0 source parity remains explicit"
	)
	_check(
		hero_snapshot.get("hero_body_collider_size", Vector2.ZERO) == Vector2(12.0, 16.0),
		"measured Hero body collider is 12 by 16 source pixels"
	)
	_check(
		is_equal_approx(float(hero_snapshot.get("hero_move_speed", -1.0)), 112.0),
		"Hero runtime move speed is read from the checked-out tuning configuration (112 px/s)"
	)
	var viewport_size: Vector2 = hero_snapshot.get("viewport_size", Vector2.ZERO)
	var expected_scale := maxf(1.0, floorf(minf(viewport_size.x / 1280.0, viewport_size.y / 720.0)))
	_check(
		hero_snapshot.get("camera_zoom", Vector2.ZERO) == Vector2(expected_scale, expected_scale),
		"camera uses stable integer scaling at the requested capture resolution"
	)
	_check(
		bool(hero_snapshot.get("journey_mode", false)),
		"pilot uses projection-only journey authority"
	)
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"journey begins at the authored exterior spawn"
	)
	match site_index:
		1:
			await _press_key(KEY_F2)
		2:
			await _press_key(KEY_F3)
	_check(
		(
			str(_snapshot().get("active_kind", "")) == "shell"
			and (
				str(_snapshot().get("source_id", ""))
				== [QUARRY_ID, ORCHARD_ID, MILL_ID][site_index]
			)
		),
		"keyboard POI selection keeps the journey at the requested authored exterior"
	)


func _enter_worksite(expected_source: String) -> bool:
	var hero: CharacterBody2D = _hero()
	if hero == null:
		_check(false, "pilot contains the current Hero CharacterBody2D")
		return false
	var shell: NativePoiShell = _pilot.get("_shell") as NativePoiShell
	if shell == null:
		_check(false, "pilot starts in the source-backed exterior shell")
		return false
	var entry := shell.get_entry_position()
	if hero.global_position.y < entry.y + 32.0:
		await _walk_axis_to("move_down", KEY_S, entry.y + 32.0)
	var before := hero.global_position
	var reached := await _walk_axis_to("move_up", KEY_W, entry.y)
	_check(reached, "exterior doorway is physically approached using keyboard input")
	_check(
		before.distance_to(hero.global_position) > 20.0,
		"exterior approach moves the live actor rather than setting its position"
	)
	await _press_key(KEY_G)
	await _settle()
	var snapshot: Dictionary = _snapshot()
	_check(
		(
			str(snapshot.get("active_kind", "")) == "site"
			and str(snapshot.get("source_id", "")) == expected_source
		),
		(
			(
				"physical doorway signal mounts the exact existing local worksite; active=%s source=%s "
				+ "feedback=%s position=%s trace=%s"
			)
			% [
				str(snapshot.get("active_kind", "")),
				str(snapshot.get("source_id", "")),
				str(snapshot.get("feedback", "")),
				str(snapshot.get("position", Vector2.ZERO)),
				JSON.stringify(snapshot.get("trace", []))
			]
		)
	)
	var trace: Array = snapshot.get("trace", [])
	var entry_event: Dictionary = {}
	for trace_value: Variant in trace:
		if (
			trace_value is Dictionary
			and str(trace_value.get("kind", "")) == "transition"
			and str(trace_value.get("direction", "")) == "enter"
		):
			entry_event = trace_value
	_check(
		str(entry_event.get("direction", "")) == "enter",
		"entry transition signal is recorded from the live doorway request"
	)
	_check(
		(
			str(entry_event.get("run_id", "")) == "fixture-run-1"
			and int(entry_event.get("run_epoch", -1)) == 1
			and str(entry_event.get("phase_id", "")) == "ordinary"
			and int(entry_event.get("observed_phase_projection_revision", -1)) >= 0
			and not str(entry_event.get("site_instance_id", "")).is_empty()
		),
		"doorway transition preserves the owner-projected run and phase boundary"
	)
	return (
		str(snapshot.get("active_kind", "")) == "site"
		and str(snapshot.get("source_id", "")) == expected_source
	)


func _exit_and_revisit(expected_source: String, state_key: String, expected_value: String) -> void:
	var site: NativePoiSite = _pilot.get("_site") as NativePoiSite
	if site == null:
		_check(false, "worksite remains mounted before retreat")
		return
	var exit_position := site.get_exit_position()
	_check(
		await _walk_to(exit_position),
		"player retreats through the interior route to the authored doorway"
	)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"physical exit restores the canonical exterior return shell"
	)
	var shell: NativePoiShell = _pilot.get("_shell") as NativePoiShell
	if shell == null:
		_check(false, "exterior return shell remains available for revisit")
		return
	var entry := shell.get_entry_position()
	await _walk_axis_to("move_down", KEY_S, entry.y + 32.0)
	await _walk_axis_to("move_up", KEY_W, entry.y - 3.0)
	await _press_key(KEY_G)
	await _settle()
	var snapshot: Dictionary = _snapshot()
	_check(
		(
			str(snapshot.get("active_kind", "")) == "site"
			and str(snapshot.get("source_id", "")) == expected_source
		),
		"same exterior doorway can be physically revisited"
	)
	_check(
		str(snapshot.get("site_state", {}).get(state_key, "")) == expected_value,
		"owner-projected site state persists across retreat and revisit"
	)
	var trace: Array = snapshot.get("trace", [])
	var enters := 0
	var exits := 0
	for item: Dictionary in trace:
		if str(item.get("direction", "")) == "enter":
			enters += 1
		elif str(item.get("direction", "")) == "exit":
			exits += 1
	_check(enters >= 2 and exits >= 1, "journey trace records entry, exit, and revisit signals")
	await _capture("%s-return-revisit" % expected_source.get_slice("_", -1))


func _walk_to(target: Vector2, measurement_tag: String = "") -> bool:
	var hero := _hero()
	if hero == null:
		return false
	var start_position := hero.global_position
	var physics_frame_start := Engine.get_physics_frames()
	var measure_this_walk := not measurement_tag.is_empty()
	_measured_walk_input_frames = 0
	_measure_walk = measure_this_walk
	var horizontal_action := "move_right" if target.x > hero.global_position.x else "move_left"
	var horizontal_key := KEY_D if target.x > hero.global_position.x else KEY_A
	await _walk_axis_to(horizontal_action, horizontal_key, target.x)
	var horizontal_position := hero.global_position
	var vertical_action := "move_down" if target.y > hero.global_position.y else "move_up"
	var vertical_key := KEY_S if target.y > hero.global_position.y else KEY_W
	await _walk_axis_to(vertical_action, vertical_key, target.y)
	var end_position := hero.global_position
	if end_position.distance_to(target) > 14.0:
		print("A8_POINT %s %s %s %s" % [start_position, horizontal_position, end_position, target])
	_measure_walk = false
	if measure_this_walk:
		var physics_frames := Engine.get_physics_frames() - physics_frame_start
		var path_length := (
			start_position.distance_to(horizontal_position)
			+ horizontal_position.distance_to(end_position)
		)
		var hz := maxi(1, Engine.physics_ticks_per_second)
		print(
			(
				(
					"A8_HERO_ROUTE_MEASURE tag=%s source=%s start=%s stand=%s path_px=%.2f "
					% [
						measurement_tag,
						QUARRY_ID,
						str(start_position),
						str(end_position),
						path_length
					]
				)
				+ (
					"held_physics_frames=%d elapsed_physics_frames=%d elapsed_physics_seconds=%.3f "
					% [
						_measured_walk_input_frames,
						physics_frames,
						float(physics_frames) / float(hz)
					]
				)
				+ "speed_px_per_second=%.2f body=12x16" % float(hero.get("move_speed"))
			)
		)
	return end_position.distance_to(target) <= 18.0


func _walk_axis_to(action: String, keycode: Key, coordinate: float) -> bool:
	var hero := _hero()
	if hero == null:
		_last_axis_collided = false
		return false
	var starting_position := hero.global_position
	var starting_value := (
		hero.global_position.x if action in ["move_left", "move_right"] else hero.global_position.y
	)
	var reached := absf(starting_value - coordinate) <= 5.0
	_last_axis_collided = false
	_last_collision_name = ""
	if reached:
		return true
	Input.action_press(action)
	await _send_key(keycode, true)
	var best_distance := absf(starting_value - coordinate)
	var stalled_frames := 0
	for _frame: int in range(240):
		await physics_frame
		if _measure_walk:
			_measured_walk_input_frames += 1
		var current := hero.global_position
		var current_value := current.x if action in ["move_left", "move_right"] else current.y
		var distance := absf(current_value - coordinate)
		var crossed_target := (
			current_value >= coordinate
			if action in ["move_right", "move_down"]
			else current_value <= coordinate
		)
		if distance <= 5.0 or crossed_target:
			reached = true
			break
		if distance < best_distance - 0.15:
			best_distance = distance
			stalled_frames = 0
		else:
			stalled_frames += 1
		if hero.get_slide_collision_count() > 0:
			_last_axis_collided = true
			var collider: Object = hero.get_slide_collision(0).get_collider()
			_last_collision_name = str(collider.name) if collider is Node else str(collider)
			if stalled_frames >= 30:
				break
	Input.action_release(action)
	await _send_key(keycode, false)
	for _frame: int in range(60):
		if hero.velocity.length() <= 1.0:
			break
		await physics_frame
		await process_frame
	await _settle()
	var ending_value := (
		hero.global_position.x if action in ["move_left", "move_right"] else hero.global_position.y
	)
	if not reached:
		print(
			(
				"A8_HERO_AXIS_RESULT action=%s target=%.1f start=%s end=%s collided=%s state=%s collider=%s"
				% [
					action,
					coordinate,
					str(starting_position),
					str(hero.global_position),
					str(_last_axis_collided),
					str(_snapshot().get("site_state", {})),
					_last_collision_name,
				]
			)
		)
	_check(
		reached or hero.global_position.distance_to(starting_position) > 0.5 or _last_axis_collided,
		"keyboard movement or collision is observed on %s" % action
	)
	return reached or absf(ending_value - coordinate) <= 5.0


func _press_key(keycode: Key, measurement_tag: String = "") -> void:
	var physics_frame_start := Engine.get_physics_frames()
	await _send_key(keycode, true)
	await physics_frame
	await _send_key(keycode, false)
	await _settle()
	if not measurement_tag.is_empty():
		var elapsed_frames := Engine.get_physics_frames() - physics_frame_start
		var hz := maxi(1, Engine.physics_ticks_per_second)
		print(
			(
				"A8_HERO_INTERACTION_MEASURE tag=%s key=H held_presses=1 " % measurement_tag
				+ (
					"physical_request_frames=%d physical_request_seconds=%.3f"
					% [elapsed_frames, float(elapsed_frames) / float(hz)]
				)
			)
		)


func _send_key(keycode: Key, is_pressed: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	event.keycode = keycode
	event.pressed = is_pressed
	Input.parse_input_event(event)


func _settle() -> void:
	await process_frame
	await physics_frame
	await process_frame


func _hero() -> CharacterBody2D:
	return _pilot.get("_hero") as CharacterBody2D if is_instance_valid(_pilot) else null


func _snapshot() -> Dictionary:
	return _pilot.call("get_journey_snapshot") if is_instance_valid(_pilot) else {}


func _has_visual_prop(prop_id: String) -> bool:
	if not is_instance_valid(_pilot):
		return false
	var site: NativePoiSite = _pilot.get("_site") as NativePoiSite
	if site == null:
		return false
	var art: Node2D = site.get("_art") as Node2D
	if art == null:
		return false
	var props := art.get_node_or_null("A8_SourceSized_Props") as Node2D
	return props != null and props.has_node(prop_id)


func _intent_count() -> int:
	var count := 0
	for item: Dictionary in _snapshot().get("trace", []):
		if str(item.get("kind", "")) == "intent":
			count += 1
	return count


func _capture(label: String) -> void:
	if not is_instance_valid(_pilot):
		return
	var absolute_dir := ProjectSettings.globalize_path(CAPTURE_DIR)
	var capture_suffix := OS.get_environment("SOH_A8_CAPTURE_SUBDIR")
	var expected_size := Vector2i.ZERO
	var dimensions := capture_suffix.split("x", false)
	if dimensions.size() == 2:
		expected_size = Vector2i(int(dimensions[0]), int(dimensions[1]))
		if expected_size.x > 0 and expected_size.y > 0:
			root.size = expected_size
		else:
			expected_size = Vector2i.ZERO
	if not capture_suffix.is_empty():
		absolute_dir = absolute_dir.path_join(capture_suffix)
	await process_frame
	await process_frame
	_capture_index += 1
	DirAccess.make_dir_recursive_absolute(absolute_dir)
	if DisplayServer.get_name() == "headless":
		_headless_visual_capture_skipped = true
		return
	var image := root.get_texture().get_image()
	if expected_size != Vector2i.ZERO:
		_check(
			image.get_size() == expected_size,
			(
				"native screenshot uses the requested %dx%d back buffer"
				% [expected_size.x, expected_size.y]
			)
		)
	var output_path := "%s/%02d-%s.png" % [absolute_dir, _capture_index, label]
	var result := image.save_png(output_path)
	_check(result == OK, "journey visual capture saved: %s" % output_path.get_file())


func _stop_pilot() -> void:
	if is_instance_valid(_pilot):
		root.remove_child(_pilot)
		_pilot.queue_free()
		_pilot = null
	await _settle()


func _check(condition: bool, message: String) -> void:
	_assertions += 1
	if not condition:
		_failures.append("ASSERTION FAILED: " + message)
		push_error("Assertion failed: " + message)

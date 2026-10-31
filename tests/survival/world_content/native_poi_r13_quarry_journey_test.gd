extends "res://tests/survival/world_content/native_poi_input_journey_test.gd"

## Focused R13 exterior clue and Quarry journey; reuses physical-input harness.


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _journey_exterior_clue(0, QUARRY_ID, "Cut marks:")
	await _journey_exterior_clue(1, ORCHARD_ID, "Graft marks:")
	await _journey_quarry_deep_return()
	_check(
		_capture_index == 6, "R13 exterior clues and Quarry lock/open/revisit visuals were captured"
	)
	if _failures.is_empty():
		if _headless_visual_capture_skipped:
			print("A8_R13_QUARRY_CAPTURE_SKIPPED renderer=headless")
		print("A8_R13_QUARRY_JOURNEY_PASS assertions=%d" % _assertions)
		quit(0)
	else:
		for failure: String in _failures:
			push_error(failure)
		print(
			"A8_R13_QUARRY_JOURNEY_FAIL failures=%d assertions=%d" % [_failures.size(), _assertions]
		)
		quit(1)


func _journey_exterior_clue(site_index: int, expected_source: String, phrase: String) -> void:
	await _start_pilot({}, site_index)
	var shell := _pilot.get("_shell") as NativePoiShell
	_check(shell != null, "canonical exterior shell is mounted for its authored clue")
	if shell == null:
		await _stop_pilot()
		return
	var clue: Dictionary = shell.definition.get("approach_clue", {})
	var clue_pair: Array = clue.get("local_px", [0, 0])
	var clue_position := Vector2(float(clue_pair[0]), float(clue_pair[1]))
	var entry := shell.get_entry_position()
	_check(
		await _walk_axis_to("move_up", KEY_W, entry.y - 3.0),
		"actor walks through the south entrance into the exterior shell"
	)
	var horizontal_action := (
		"move_right" if clue_position.x > _hero().global_position.x else "move_left"
	)
	var horizontal_key := KEY_D if clue_position.x > _hero().global_position.x else KEY_A
	_check(
		await _walk_axis_to(horizontal_action, horizontal_key, clue_position.x),
		"actor reaches the exterior clue marker without a position injection"
	)
	_check(
		await _walk_axis_to("move_up", KEY_W, clue_position.y),
		"actor reaches the source-authored exterior clue by live movement"
	)
	await _settle()
	_check(
		(
			str(shell.definition.get("source", {}).get("poi_id", "")) == expected_source
			and shell.get_context_hint(_hero()).contains(phrase)
		),
		"%s exterior clue is visible outside the interior-entry transaction" % expected_source
	)
	await _capture("%s-exterior-clue" % expected_source.get_slice("_", -1))
	await _stop_pilot()


func _journey_quarry_deep_return() -> void:
	var seed := {"ready_actions": ["inspect_cut_marks", "open_quarry_deep_gate", "survey_deep_cut"]}
	await _start_pilot(seed)
	if not await _enter_worksite(QUARRY_ID):
		await _stop_pilot()
		return
	await _capture("quarry-deep-ordinary-baseline")
	_check(
		await _walk_to(Vector2(506.0, 378.0)),
		"quarry clue stand is reached by continuous quiet-exploration movement"
	)
	var intents_before := _intent_count()
	await _press_key(KEY_Y)
	var clue_snapshot: Dictionary = _snapshot()
	_check(
		(
			_intent_count() == intents_before + 1
			and str(clue_snapshot.get("site_state", {}).get("quarry_clue", "")) == "read"
		),
		"Quarry exterior clue is a physical information interaction, not an item grant"
	)
	_check(
		(
			str(clue_snapshot.get("feedback", "")).contains("Cut marks point")
			and not bool(clue_snapshot.get("trace", []).back().get("contains_reward_fields", true))
		),
		"clue feedback is useful and its neutral request contains no reward fields"
	)
	var clue_intent_count := _intent_count()
	await _press_key(KEY_Y)
	_check(
		_intent_count() == clue_intent_count,
		"repeated clue interaction is rejected after the owner-projected read"
	)
	await _press_key(KEY_G)
	_check(
		str(_snapshot().get("site_state", {}).get("quarry_route", "")) == "east_braced",
		"first visit makes the east-brace versus west-chock preparation decision"
	)
	_check(
		(
			not _snapshot().get("fixture_state", {}).has("inventory")
			and not _snapshot().get("fixture_state", {}).has("currency")
			and not _snapshot().get("fixture_state", {}).has("save_data")
		),
		"Quarry journey fixture contains no inventory, currency, or SaveService surface"
	)
	var site := _pilot.get("_site") as NativePoiSite
	_check(site != null, "Quarry deep test has the authored local destination mounted")
	if site == null:
		await _stop_pilot()
		return
	_check(
		await _walk_to(Vector2(520.0, 220.0)),
		"counterweight door is approached from the chosen physical route"
	)
	await _capture("quarry-deep-locked-no-capability")
	var gate_reached := await _walk_axis_to("move_up", KEY_W, 170.0)
	var gate_position: Vector2 = _hero().global_position
	_check(
		not gate_reached and _last_axis_collided and gate_position.y > 200.0,
		"deep counterweight door physically blocks the unprepared approach"
	)
	var authority := _pilot.get("_journey_authority") as PoiJourneyAuthorityFixture
	_check(authority != null, "Quarry has a projection-only owner fixture for native seam tests")
	if authority == null:
		await _stop_pilot()
		return
	authority.replace_capabilities(["cap_salvage"])
	_check(
		site.set_projection(authority.project_state(QUARRY_ID)),
		"owner projection can provide the existing salvage credential without local mutation"
	)
	var gate_body := site.get("_gate_bodies")[0] as StaticBody2D
	_check(
		gate_body.collision_layer != 0,
		"missing cap_power_1 keeps the deep gate physically closed after cap_salvage appears"
	)
	var rejected_open_count := _intent_count()
	await _press_key(KEY_T)
	_check(
		(
			_intent_count() == rejected_open_count
			and str(_pilot.get("_feedback").text).contains("Required capability")
		),
		"missing power blocks the gate interaction without emitting a request"
	)
	var exit_position := site.get_exit_position()
	_check(
		await _walk_to(exit_position),
		"locked Quarry retains a physical south retreat to the doorway"
	)
	await _press_key(KEY_G)
	await _settle()
	_check(
		str(_snapshot().get("active_kind", "")) == "shell",
		"retreat unloads the Quarry scene and returns to the same source shell"
	)
	authority.replace_capabilities(["cap_salvage", "cap_power_1"])
	if not await _enter_worksite(QUARRY_ID):
		await _stop_pilot()
		return
	_check(
		str(_snapshot().get("site_state", {}).get("quarry_route", "")) == "east_braced",
		"later visit restores the same owner-projected preparation choice"
	)
	_check(
		await _walk_to(Vector2(520.0, 220.0)),
		"prepared return reaches the powered counterweight stand physically"
	)
	var gate_open_count := _intent_count()
	await _press_key(KEY_T)
	_check(
		(
			_intent_count() == gate_open_count + 1
			and str(_snapshot().get("site_state", {}).get("quarry_deep_gate", "")) == "open"
		),
		"owner-projected credential plus power releases the physical deep gate"
	)
	await _settle()
	gate_body = (_pilot.get("_site") as NativePoiSite).get("_gate_bodies")[0] as StaticBody2D
	_check(
		gate_body.collision_layer == 0,
		"opened owner projection removes only the deep-gate collider"
	)
	_check(
		_has_visual_prop("counterweight_live_lamp") and not _has_visual_prop("deep_gate_bar_1"),
		"powered deep return changes the gate silhouette and source-art readiness cue"
	)
	await _capture("quarry-deep-powered-open")
	var repeat_open_count := _intent_count()
	await _press_key(KEY_T)
	_check(
		_intent_count() == repeat_open_count,
		"repeated deep-gate interaction cannot replay its consumed source action"
	)
	_check(
		await _walk_to(Vector2(480.0, 138.0)),
		"prepared actor traverses the locked section and marked scree by live collision"
	)
	var survey_count := _intent_count()
	await _press_key(KEY_V)
	var survey_snapshot: Dictionary = _snapshot()
	_check(
		(
			_intent_count() == survey_count + 1
			and str(survey_snapshot.get("site_state", {}).get("deep_seam_note", "")) == "read"
		),
		"deep action yields a partial route clue without a material or currency grant"
	)
	_check(
		_has_visual_prop("deep_route_marks_read"),
		"deep survey changes authored presentation only after the owner projection"
	)
	_check(
		(
			not bool(survey_snapshot.get("trace", []).back().get("contains_reward_fields", true))
			and not bool(
				survey_snapshot.get("trace", []).back().get("fixture_snapshot_has_inventory", true)
			)
		),
		"deep neutral intent and owner fixture contain no reward fields or inventory"
	)
	var repeated_survey_count := _intent_count()
	await _press_key(KEY_V)
	_check(
		_intent_count() == repeated_survey_count,
		"repeated deep survey cannot replay after owner-projected completion"
	)
	authority.replace_capabilities(["cap_salvage"])
	authority.replace_site_state(
		QUARRY_ID,
		{
			"quarry_clue": "read",
			"quarry_route": "east_braced",
			"quarry_deep_gate": "locked",
			"deep_seam_note": "read"
		}
	)
	_check(
		(_pilot.get("_site") as NativePoiSite).set_projection(authority.project_state(QUARRY_ID)),
		"owner revocation projects the gate back to a visibly locked state"
	)
	await _settle()
	gate_body = (_pilot.get("_site") as NativePoiSite).get("_gate_bodies")[0] as StaticBody2D
	_check(
		gate_body.collision_layer != 0 and _has_visual_prop("deep_gate_bar_1"),
		"missing power restores both the locked silhouette and physical gate collider"
	)
	_check(
		await _walk_axis_to("move_down", KEY_S, 160.0),
		"deep scree lets the actor descend to the marked retreat lane"
	)
	_check(
		await _walk_axis_to("move_right", KEY_D, 520.0),
		"marked retreat lane reaches the counterweight gate from its deep side"
	)
	_check(
		await _walk_axis_to("move_down", KEY_S, 220.0),
		"one-way powered gate still permits safe physical retreat after power revocation"
	)
	await _exit_and_revisit(QUARRY_ID, "deep_seam_note", "read")
	var final_trace: Array = _snapshot().get("trace", [])
	var stable_instance := ""
	var transition_instances: Array[String] = []
	var quarry_intents := 0
	for event: Variant in final_trace:
		if not event is Dictionary:
			continue
		if str(event.get("kind", "")) == "transition":
			transition_instances.append(str(event.get("site_instance_id", "")))
			_check(
				str(event.get("poi_id", "")) == QUARRY_ID,
				"all entry/exit transitions preserve the Quarry source identity"
			)
		if str(event.get("kind", "")) == "intent":
			quarry_intents += 1
			_check(
				(
					str(event.get("source_id", "")) == QUARRY_ID
					and not bool(event.get("contains_reward_fields", true))
				),
				"all Quarry intents retain their canonical source and neutral shape"
			)
			var instance_id := str(event.get("site_instance_id", ""))
			if stable_instance.is_empty():
				stable_instance = instance_id
			else:
				_check(
					instance_id == stable_instance,
					"revisited Quarry actions keep the same owner site-instance identity"
				)
	for instance_id: String in transition_instances:
		_check(
			instance_id == stable_instance,
			"entry and exit transitions retain the same durable-source instance identifier"
		)
	_check(
		(
			quarry_intents == 4
			and not stable_instance.is_empty()
			and not transition_instances.is_empty()
		),
		"clue, preparation, gate and deep survey retain four source-bound neutral events"
	)
	await _stop_pilot()

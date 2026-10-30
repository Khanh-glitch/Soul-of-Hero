extends Node

## Native gate for the A6 survival return UI.
##
## Runs on a real Godot 4.7 binary with the production autoloads, loads the real
## `.tscn` files and drives them through the states the design asks for:
##
##   * a 2 h / 18 h / 48 h return, and a return where the owners published nothing;
##   * a first run and a second run, with steps already completed out of order;
##   * a dismissed digest that must not come back on the next refresh;
##   * an empty season record that still opens without inventing history;
##   * card geometry at 720p / 1440p / 2160p (measured, not rendered);
##   * text hygiene: no contract strings, source paths or fixture labels on screen;
##   * and a byte-level check that nothing here touches A0's save.
##
## Run it as its own scene so no A0 route has to know this gate exists:
##   godot --headless --path . res://tests/survival/ui/a6_survival_return_native_test.tscn
##
## What this proves is NATIVE_HEADLESS: real scenes, real layout maths, real save
## read. It is not a visual inspection — this sandbox has no GL/Vulkan context, so
## the capture gate stays `--avatar-visual-capture` on a machine with a renderer.

const LAYER_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")
const CONTRACT := preload("res://game/survival/ui/return/a6_projection_contract.gd")
const NOW := 1793318400  # 2026-10-30T00:00:00Z
const RUN_SECONDS := 14 * 24 * 60 * 60

var _checks := 0
var _failures: Array[String] = []
var _layer: A6SurvivalReturnLayer
var _save: Node
var _save_file := ""
var _save_existed := false
var _save_bytes := PackedByteArray()
var _snapshot_before := ""


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	_save = get_tree().root.get_node_or_null("SaveService")
	_expect(_save != null, "the production SaveService autoload is present")
	_capture_save_state()
	_test_contracts()
	await _test_layer_states()
	await _test_guidance_states()
	await _test_record_panel()
	await _test_layout()
	await _test_read_only()
	_finish()


# --- contracts (pure) -------------------------------------------------------


func _test_contracts() -> void:
	var clock := _clock(NOW, 1)
	var accepted := CONTRACT.sanitize_season_clock(clock)
	_expect(bool(accepted.get("available", false)), "a 14-day season clock is accepted")
	_equals(int(accepted.get("run_number", 0)), 1, "the clock keeps the run number")

	var short_clock := _clock(NOW, 1)
	short_clock["ends_at_unix"] = NOW + 13 * 86400
	var short_result := CONTRACT.sanitize_season_clock(short_clock)
	_expect(not bool(short_result.get("available", true)), "a 13-day clock is rejected instead of shown")

	_expect(not bool(CONTRACT.sanitize_season_clock("garbage").get("available", true)), "a non-dictionary clock is rejected")

	_equals(
		CONTRACT.remaining_seconds(accepted, NOW + 2 * 3600),
		RUN_SECONDS - 2 * 3600,
		"two hours into the run, the remaining time is exact",
	)
	var two_hour_view := A6RunCard.build_view(accepted, NOW + 2 * 3600)
	_equals(String(two_hour_view.get("countdown", "")), "13 ngày 22 giờ", "the card counts down in whole units")
	_equals(String(two_hour_view.get("urgency", "")), "calm", "a fresh run is not styled as urgent")

	var last_minute := A6RunCard.build_view(accepted, NOW + RUN_SECONDS - 60)
	_equals(String(last_minute.get("countdown", "")), "1 phút", "the last minute is shown in minutes")
	_expect(not bool(last_minute.get("over", true)), "the run is not over one minute early")

	var spent := A6RunCard.build_view(accepted, NOW + RUN_SECONDS)
	_expect(bool(spent.get("over", false)), "the run ends exactly at the deadline")
	_equals(String(spent.get("countdown", "")), "Đã khép", "an ended run says so instead of counting")

	var digest := _digest(NOW, 18 * 3600, [
		{"kind": "forge", "completed_units": 8, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"},
	])
	var digest_view := A6ReturnDigest.build_view(CONTRACT.sanitize_return_digest(digest))
	_expect(bool(digest_view.get("visible", false)), "an 18-hour forge return produces a card")
	_equals((digest_view.get("rows", []) as Array).size(), 1, "one settled station produces one row")
	var forge_row: Dictionary = (digest_view.get("rows", []) as Array)[0]
	_equals(String(forge_row.get("title", "")), "Lò rèn", "the forge row is labelled in the player's words")
	_equals(String(forge_row.get("detail", "")), "8 thỏi sắt", "the real output is printed")
	_equals(String(forge_row.get("note", "")), "Đã hết nhiên liệu", "the real stop reason is printed")

	var unknown_kind := _digest(NOW, 2 * 3600, [
		{"kind": "smelter_v2", "completed_units": 3, "unit_label": "x", "stop_reason": "fuel_empty"},
	])
	_expect(not bool(CONTRACT.sanitize_return_digest(unknown_kind).get("available", true)), "an unknown station kind is dropped, never printed raw")

	var zero_output := _digest(NOW, 2 * 3600, [
		{"kind": "crop", "completed_units": 0, "unit_label": "quả", "stop_reason": "queue_empty"},
	])
	_expect(not bool(CONTRACT.sanitize_return_digest(zero_output).get("available", true)), "zero output does not become a reward row")

	var wilderness := _digest(NOW, 20 * 3600, [])
	wilderness["provisions"] = {"consumed": 3, "shelter": "wilderness", "hp_floor": true}
	var wilderness_view := CONTRACT.sanitize_return_digest(wilderness)
	_expect(not bool((wilderness_view.get("provisions", {}) as Dictionary).get("hp_floor", true)), "the 1 HP floor is only claimed inside a real home")
	_equals(int((wilderness_view.get("provisions", {}) as Dictionary).get("consumed", 0)), 3, "ration use is still reported outside")

	var labeled := _digest(NOW, 2 * 3600, [])
	labeled["world_changes"] = ["res://game/survival/thing.gd was rebuilt"]
	_expect(not bool(CONTRACT.sanitize_return_digest(labeled).get("available", true)), "a technical world-change string is dropped")

	var history := {
		"contract": "soh.a6.run_history.v1",
		"runs": [
			{"started_at_unix": NOW - 30 * 86400, "ended_at_unix": NOW - 16 * 86400, "end_reason": "deadline", "milestones": ["Giường đầu tiên"]},
			{"started_at_unix": NOW - 15 * 86400, "ended_at_unix": NOW - 86400, "end_reason": "abandoned", "milestones": []},
			{"started_at_unix": NOW - 9 * 86400, "ended_at_unix": NOW - 2 * 86400, "end_reason": "res://nope", "milestones": []},
		],
		"achievements": [
			{"title": "TEST ONLY achievement", "detail": "", "earned_at_unix": NOW - 86400},
			{"title": "Mùa đầu tiên", "detail": "Sống qua 14 ngày", "earned_at_unix": NOW - 86400},
		],
	}
	var history_view := CONTRACT.sanitize_run_history(history)
	_equals((history_view.get("runs", []) as Array).size(), 2, "a run with an unknown end reason is dropped")
	if (history_view.get("runs", []) as Array).size() == 2:
		var newest: Dictionary = (history_view.get("runs", []) as Array)[0]
		var older: Dictionary = (history_view.get("runs", []) as Array)[1]
		_expect(int(newest.get("ended_at_unix", 0)) > int(older.get("ended_at_unix", 0)), "runs are ordered newest first")
	_equals((history_view.get("achievements", []) as Array).size(), 1, "a fixture-labelled achievement is dropped")

	var clear_site := {"contract": "soh.a6.site_cues.v1", "observed_at_unix": NOW, "trail": {}, "threats": []}
	_expect(not bool(A6SiteCueChip.build_view(CONTRACT.sanitize_site_cues(clear_site)).get("visible", true)), "no detected signs means no chip, not a safety verdict")
	var tracked := {
		"contract": "soh.a6.site_cues.v1",
		"observed_at_unix": NOW,
		"trail": {"present": true, "age_seconds": 5400},
		"threats": [{"distance_m": 42.0, "label": "Tiếng bước chân"}, {"distance_m": 900.0, "label": "Ngoài tầm"}],
	}
	var tracked_view := A6SiteCueChip.build_view(CONTRACT.sanitize_site_cues(tracked))
	_expect(bool(tracked_view.get("visible", false)), "a fresh trace produces a cue chip")
	_equals(String(tracked_view.get("trail", "")), "Dấu vết còn mới · 1 giờ trước", "the trace age is the observed age")
	_equals(String(tracked_view.get("threat", "")), "Tiếng bước chân · 42 m", "only the nearest realistic threat is shown")


# --- layer / cards ----------------------------------------------------------


func _test_layer_states() -> void:
	await _mount({})
	_expect(_layer != null, "the return layer scene instantiates")
	_expect(not _layer.run_card.visible, "no season projection means no season chip")
	_expect(not _layer.return_digest.visible, "no return digest means no return card")

	# A 2 h return with nothing settled: still no card, because there is nothing
	# true to say yet.
	await _mount({"season_clock": _clock(NOW - 2 * 3600, 1), "return_digest": {}, "guidance_facts": _facts_all_done()})
	_expect(_layer.run_card.visible, "a published clock shows the season chip")
	_equals(_layer.run_card.countdown_label.text, "13 ngày 22 giờ", "the chip renders the countdown")
	_expect(not _layer.return_digest.visible, "an empty digest stays hidden")

	# 18 h return with real forge output.
	var settle_18 := {"return_digest": _digest(NOW, 18 * 3600, [
		{"kind": "forge", "completed_units": 5, "unit_label": "thỏi đồng", "stop_reason": "input_empty"},
		{"kind": "crop", "completed_units": 3, "unit_label": "củ cải", "stop_reason": "queue_empty"},
	])}
	await _mount(settle_18)
	_expect(_layer.return_digest.visible, "an 18-hour return with real output shows the card")
	_equals(_layer.return_digest.row_list.get_child_count(), 2, "both settled stations get a row")

	# 48 h return with a full store and starvation inside the home.
	var digest_48 := _digest(NOW, 48 * 3600, [
		{"kind": "forge", "completed_units": 12, "unit_label": "thỏi sắt", "stop_reason": "output_full"},
	])
	digest_48["provisions"] = {"consumed": 6, "shelter": "home", "hp_floor": true}
	await _mount({"return_digest": digest_48})
	_expect(_layer.return_digest.visible, "a 48-hour return shows the card")
	_equals(_layer.return_digest.row_list.get_child_count(), 3, "output, rations and the shelter collapse are all reported")

	# Dismissing is remembered across refreshes, and a repeat Continue is a no-op.
	var dismissals := [0]
	_layer.digest_dismissed.connect(func(_id: String) -> void: dismissals[0] += 1)
	_layer.dismiss_digest()
	_layer.dismiss_digest()
	_expect(not _layer.return_digest.visible, "Continue closes the digest")
	_equals(dismissals[0], 1, "pressing Continue twice emits one dismissal")
	_layer.refresh()
	_layer.refresh()
	_expect(not _layer.return_digest.visible, "a dismissed digest does not come back on refresh")

	# An unparsable projection must not resurrect it either.
	await _mount({"return_digest": {"contract": "soh.a6.return_digest.v1", "digest_id": "x"}})
	_expect(not _layer.return_digest.visible, "a digest without settled changes stays hidden")

	_expect(_scan_forbidden().is_empty(), "no contract strings or fixture labels are visible: " + ", ".join(_scan_forbidden()))


func _test_guidance_states() -> void:
	var clock_first := _clock(NOW, 1)
	var clock_second := _clock(NOW, 2)
	var early := {"available": true, "materials": 2, "structures": 0, "bed": false, "storage": false, "recipes": 0}
	await _mount({"season_clock": clock_first, "guidance_facts": early})
	_expect(_layer.guidance_panel.visible, "a first run shows the starter chain")
	_equals(_layer.guidance_panel.step_list.get_child_count(), 5, "the first run lists all five steps")
	_equals(_layer.guidance_panel.kicker_label.text, "BẮT ĐẦU", "the first run is labelled as a start")

	# Second run: compact, one line, and optional.
	await _mount({"season_clock": clock_second, "guidance_facts": early})
	_expect(_layer.guidance_panel.visible, "a second run still offers the next step")
	_equals(_layer.guidance_panel.step_list.get_child_count(), 1, "a second run stays compact")
	_equals(_layer.guidance_panel.kicker_label.text, "GỢI Ý", "the second run is a suggestion, not a tutorial")

	# Out-of-order: the player built the bed and the chest before gathering.
	var out_of_order := {"available": true, "materials": 0, "structures": 2, "bed": true, "storage": true, "recipes": 0}
	await _mount({"season_clock": clock_first, "guidance_facts": out_of_order})
	var rows := _layer.guidance_panel.view().get("rows", []) as Array
	_equals(rows.size(), 5, "out-of-order progress still shows the whole chain on run one")
	var bed_row: Dictionary = rows[2]
	var gather_row: Dictionary = rows[0]
	_expect(bool(bed_row.get("done", false)), "a bed built before the guide is ticked")
	_expect(not bool(gather_row.get("done", true)), "an unperformed step stays open")

	# Everything done: the card removes itself.
	await _mount({"season_clock": clock_first, "guidance_facts": _facts_all_done()})
	_expect(not _layer.guidance_panel.visible, "a finished chain is not shown at all")

	# Dismissal is a session decision, not a permanent one.
	var early_facts := {"available": true, "materials": 0, "structures": 0, "bed": false, "storage": false, "recipes": 0}
	await _mount({"season_clock": clock_first, "guidance_facts": early_facts})
	_layer.dismiss_guidance()
	_layer.refresh()
	_expect(not _layer.guidance_panel.visible, "dismissed guidance stays closed for this session")

	# The real owner state today: survival exists, so the chain is readable; the
	# season clock does not exist, so nothing about a season is claimed.
	await _mount({})
	var facts := A6OwnerProjectionSource.new()
	facts.configure(get_tree())
	var real_facts := facts.guidance_facts()
	_expect(bool(real_facts.get("available", false)), "the guide reads real survival state from A0")
	var real_clock := facts.season_clock()
	_expect(not bool(real_clock.get("available", true)) or int(real_clock.get("run_number", 0)) >= 1, "the season clock is either absent or valid")
	if not bool(real_clock.get("available", false)):
		_expect(not _layer.run_card.visible, "with no owner clock the chip is absent")


func _test_record_panel() -> void:
	await _mount({"season_clock": _clock(NOW - 2 * 3600, 1)})
	_layer.open_record()
	_expect(_layer.record_panel.visible, "the season record opens on demand")
	_expect(_layer.record_panel.runs_empty.visible, "an account with no finished season says so")
	_equals(_layer.record_panel.runs_empty.text, "Chưa có dữ liệu mùa", "without an owner history the record admits it has nothing")
	_expect(_layer.record_panel.achievements_empty.visible, "an account with no achievement says so")
	_expect(_layer.record_panel.close_button.has_focus(), "opening the record focuses its only control")
	_equals(String(_layer.record_panel.now_label.text), "Mùa 01 còn 13 ngày 22 giờ", "the record repeats the live run honestly")
	_layer.close_record()
	_expect(not _layer.record_panel.visible, "the record closes")

	var history := {
		"contract": "soh.a6.run_history.v1",
		"runs": [
			{"started_at_unix": NOW - 30 * 86400, "ended_at_unix": NOW - 16 * 86400, "end_reason": "deadline", "milestones": ["Giường đầu tiên", "Rương đầu tiên"]},
		],
		"achievements": [
			{"title": "Qua mùa đầu", "detail": "Sống trọn 14 ngày", "earned_at_unix": NOW - 16 * 86400},
		],
	}
	await _mount({"season_clock": _clock(NOW, 2), "run_history": history})
	_layer.open_record()
	_equals(_layer.record_panel.run_list.get_child_count(), 1, "one finished season produces one record row")
	_equals(_layer.record_panel.achievement_list.get_child_count(), 1, "one achievement produces one row")
	_expect(not _layer.record_panel.runs_empty.visible, "the empty-state label hides once there is history")
	_expect(_scan_forbidden().is_empty(), "the record stays free of internal strings")
	_layer.close_record()


func _test_layout() -> void:
	var sizes := {
		"run_card": Vector2(228, 64),
		"guidance": Vector2(296, 190),
		"digest": Vector2(316, 168),
		"site_cue": Vector2(220, 34),
		"record": Vector2(460, 320),
	}
	var corner_ids := ["run_card", "guidance", "digest", "site_cue"]
	for view_value: Vector2 in [Vector2(1280, 720), Vector2(2560, 1440), Vector2(3840, 2160)]:
		var items: Array = []
		for id: String in sizes.keys():
			items.append({"id": id, "size": sizes[id]})
		var rects := A6SurvivalReturnLayer.layout_rects(view_value, items)
		_equals(rects.size(), 5, "every card gets a rect at %dx%d" % [int(view_value.x), int(view_value.y)])
		var screen := Rect2(Vector2.ZERO, view_value)
		var inside := true
		for id: String in rects.keys():
			if not screen.encloses(rects[id]):
				inside = false
		_expect(inside, "no card leaves the %dx%d screen" % [int(view_value.x), int(view_value.y)])
		var overlap := ""
		for i in range(corner_ids.size()):
			for j in range(i + 1, corner_ids.size()):
				if (rects[corner_ids[i]] as Rect2).intersects(rects[corner_ids[j]] as Rect2):
					overlap = "%s/%s" % [corner_ids[i], corner_ids[j]]
		_expect(overlap.is_empty(), "corner cards do not overlap at %dx%d %s" % [int(view_value.x), int(view_value.y), overlap])
		var record: Rect2 = rects["record"]
		_expect(record.size.x <= view_value.x - 32.0, "the record fits the width at %dx%d" % [int(view_value.x), int(view_value.y)])
		_expect(absf(record.get_center().x - view_value.x * 0.5) <= 1.0, "the record is centred at %dx%d" % [int(view_value.x), int(view_value.y)])

	# Unknown ids are ignored instead of being stacked at the origin.
	var unknown := A6SurvivalReturnLayer.layout_rects(Vector2(1280, 720), [{"id": "bogus", "size": Vector2(10, 10)}])
	_expect(unknown.is_empty(), "an unknown layout id is ignored")


# --- ownership --------------------------------------------------------------


func _test_read_only() -> void:
	await _mount({
		"season_clock": _clock(NOW, 1),
		"return_digest": _digest(NOW, 18 * 3600, [{"kind": "forge", "completed_units": 2, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"}]),
	})
	_layer.open_record()
	_layer.close_record()
	_layer.dismiss_digest()
	_layer.refresh()
	var snapshot_after := var_to_str(_save.get_snapshot()) if _save != null else ""
	_expect(snapshot_after == _snapshot_before, "showing every card leaves A0's save document byte-identical")
	if not _save_file.is_empty():
		var exists_after := FileAccess.file_exists(_save_file)
		var bytes_after := FileAccess.get_file_as_bytes(_save_file) if exists_after else PackedByteArray()
		_expect(exists_after == _save_existed, "A6 does not create or delete the save file")
		_expect(bytes_after == _save_bytes, "A6 does not rewrite the save file")


# --- helpers ----------------------------------------------------------------


func _mount(overrides: Dictionary) -> void:
	if _layer != null:
		_layer.queue_free()
		_layer = null
		await get_tree().process_frame
	_layer = LAYER_SCENE.instantiate()
	add_child(_layer)
	_layer.configure(get_tree(), overrides, func() -> int: return NOW)
	await get_tree().process_frame
	await get_tree().process_frame


func _clock(start: int, run_number: int) -> Dictionary:
	return {
		"contract": "soh.a6.season_clock.v1",
		"run_id": "run-%02d" % run_number,
		"run_number": run_number,
		"started_at_unix": start,
		"ends_at_unix": start + RUN_SECONDS,
		"ended": false,
		"ended_reason": "",
	}


func _digest(observed: int, away_seconds: int, production: Array) -> Dictionary:
	return {
		"contract": "soh.a6.return_digest.v1",
		"digest_id": "digest-%d" % away_seconds,
		"away_seconds": away_seconds,
		"production": production,
		"provisions": {},
		"world_changes": [],
		"observed_at_unix": observed,
	}


func _facts_all_done() -> Dictionary:
	return {"available": true, "materials": 40, "structures": 3, "bed": true, "storage": true, "recipes": 2}


func _capture_save_state() -> void:
	_snapshot_before = var_to_str(_save.get_snapshot()) if _save != null else ""
	_save_file = OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if _save_file.is_empty():
		return
	_save_existed = FileAccess.file_exists(_save_file)
	if _save_existed:
		_save_bytes = FileAccess.get_file_as_bytes(_save_file)


## Every visible word the player could read, checked against the ban list from
## `A6ProjectionContract`. This is what keeps a projection bug from becoming a
## debug console on a release screen.
func _scan_forbidden() -> Array[String]:
	var found: Array[String] = []
	if _layer == null:
		return found
	for node: Node in _layer.find_children("*", "Control", true, false):
		var control := node as Control
		if control == null or not control.is_visible_in_tree():
			continue
		var texts: Array[String] = []
		if control is Label:
			texts.append((control as Label).text)
		elif control is Button:
			texts.append((control as Button).text)
			texts.append((control as Button).tooltip_text)
		for text: String in texts:
			if text.strip_edges().is_empty():
				continue
			for marker: String in CONTRACT.TECHNICAL_MARKERS:
				if text.to_lower().contains(marker.to_lower()):
					found.append("%s in '%s'" % [marker, text])
	return found


func _finish() -> void:
	if _failures.is_empty():
		print("A6 RETURN UI NATIVE PASSED (%d checks)" % _checks)
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("A6 RETURN UI FAIL: " + failure)
	printerr("A6 RETURN UI NATIVE FAILED (%d of %d checks)" % [_failures.size(), _checks])
	get_tree().quit(1)


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _equals(actual: Variant, expected: Variant, label: String) -> void:
	_checks += 1
	if actual != expected:
		_failures.append("%s (got '%s', want '%s')" % [label, str(actual), str(expected)])

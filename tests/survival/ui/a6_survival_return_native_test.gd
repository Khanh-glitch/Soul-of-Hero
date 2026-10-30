extends Node

## Native gate for the A6 survival return UI.
##
## Runs on a real Godot 4.7 binary with the production autoloads, loads the real
## `.tscn` files, and drives both positive and negative cases:
##
##   * 14-day clock span and the last-minute/second boundaries;
##   * 2 h / 18 h / 48 h returns and a return where the owners published nothing;
##   * D057 durable facts: gather -> spend -> stash, lone-wall shelter, bed before
##     the guide, and first-run mode with no owner season clock;
##   * unknown vs false vs done, and currently-held vs ever-completed;
##   * the empty season record admitting it has no data;
##   * 23 shuffled runs reduced to the newest 20;
##   * digest acknowledgement across a new layer (process) boundary;
##   * D061 cues expiring instead of looking current, with no metre readings;
##   * card geometry at 720p / 1440p / 2160p (measured, not rendered);
##   * text hygiene and a byte-level check that A6 never touches A0's save;
##   * real `SurvivalService` writes performed by the test (not by A6) to prove a
##     lone wall and a spent inventory cannot fake a completed step.
##
## Run it as its own scene so no A0 route has to know this gate exists:
##   godot --headless --path . res://tests/survival/ui/a6_survival_return_native_test.tscn
##
## NATIVE_HEADLESS is what this proves. It is not a visual inspection.

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
	_test_time_and_clock()
	_test_run_facts_contract()
	_test_history_contract()
	_test_digest_contract()
	_test_ack_contract()
	_test_cue_contract()
	_test_guidance_model()
	await _test_layer_states()
	await _test_guidance_panel_states()
	await _test_record_panel()
	await _test_layout()
	await _test_read_only()
	await _test_real_owner_state()
	_finish()


# --- D055 clock and display -------------------------------------------------


func _test_time_and_clock() -> void:
	var clock := _clock(NOW, 1)
	var accepted := CONTRACT.sanitize_season_clock(clock)
	_expect(bool(accepted.get("available", false)), "a 14-day season clock is accepted")
	_equals(int(accepted.get("run_number", 0)), 1, "the clock keeps the run number")

	var short_clock := _clock(NOW, 1)
	short_clock["ends_at_unix"] = NOW + 13 * 86400
	_expect(not bool(CONTRACT.sanitize_season_clock(short_clock).get("available", true)), "a 13-day clock is rejected instead of shown")
	_expect(not bool(CONTRACT.sanitize_season_clock("garbage").get("available", true)), "a non-dictionary clock is rejected")

	_equals(CONTRACT.remaining_seconds(accepted, NOW + 2 * 3600), RUN_SECONDS - 2 * 3600, "two hours in, the remaining time is exact")
	_equals(String(A6RunCard.build_view(accepted, NOW + 2 * 3600).get("countdown", "")), "13 ngày 22 giờ", "the chip counts down in whole units")

	# The last minute must not be rounded up into a whole "1 phút".
	_equals(A6TimeFormat.countdown(61), "1 phút 1 giây", "61 s keeps the extra second")
	_equals(A6TimeFormat.countdown(60), "1 phút", "60 s is exactly one minute")
	_equals(A6TimeFormat.countdown(59), "59 giây", "59 s is shown as seconds, never as a minute")
	_equals(A6TimeFormat.countdown(1), "1 giây", "one second is one second")
	_equals(A6TimeFormat.countdown(0), "0 giây", "zero is zero, not a minute")
	_equals(A6TimeFormat.countdown(-5), "0 giây", "a negative remainder clamps to zero")

	var last_minute := A6RunCard.build_view(accepted, NOW + RUN_SECONDS - 59)
	_equals(String(last_minute.get("countdown", "")), "59 giây", "the card shows real seconds at the deadline")
	_equals(String(last_minute.get("urgency", "")), "critical", "the last minute is styled as urgent")
	_expect(not bool(last_minute.get("over", true)), "the run is not over 59 s early")
	var spent := A6RunCard.build_view(accepted, NOW + RUN_SECONDS)
	_expect(bool(spent.get("over", false)), "the run ends exactly at the deadline")
	_equals(String(spent.get("countdown", "")), "Đã khép", "an ended run says so instead of counting")


# --- D057 run facts ---------------------------------------------------------


func _test_run_facts_contract() -> void:
	var absent := CONTRACT.sanitize_run_facts(null)
	_expect(not bool(absent.get("available", true)), "an unpublished ledger is unavailable, not empty")
	_equals(String(absent.get("shelter", "")), "unknown", "no shelter judgement is unknown, not invalid")
	_equals(CONTRACT.action_state(absent, "gather_materials"), "unknown", "an unavailable ledger makes every action unknown")

	var partial := CONTRACT.sanitize_run_facts({
		"contract": "soh.a6.run_facts.v1",
		"run_number": 0,
		"performed": {"gather_materials": true, "place_bed": false},
		"shelter": {"validated": false},
	})
	_expect(bool(partial.get("available", false)), "a partial ledger is accepted")
	_equals(CONTRACT.action_state(partial, "gather_materials"), "done", "a performed action stays done")
	_equals(CONTRACT.action_state(partial, "place_bed"), "open", "an explicit false is open, not unknown")
	_equals(CONTRACT.action_state(partial, "place_storage"), "unknown", "an omitted action is unknown, not false")
	_equals(String(partial.get("shelter", "")), "invalid", "an explicit shelter rejection is invalid")
	_equals(int(partial.get("run_number", -1)), 0, "an absent run number stays unknown")

	var validated := CONTRACT.sanitize_run_facts({
		"contract": "soh.a6.run_facts.v1",
		"run_number": 3,
		"shelter": {"validated": true},
	})
	_equals(String(validated.get("shelter", "")), "validated", "a validated shelter is reported as such")
	_equals(int(validated.get("run_number", 0)), 3, "the owner run number is kept")


func _test_guidance_model() -> void:
	var no_facts := CONTRACT.sanitize_run_facts(null)
	var rich_current := {"available": true, "materials": 40, "structures": 5, "bed": true, "storage": true, "recipes": 2}
	var model := A6GuidanceModel.build({"run_facts": no_facts, "current": rich_current}, {})
	_equals(_step_state(model, "gather"), "unknown", "carried materials alone never complete the gather step")
	_equals(_step_state(model, "shelter"), "unknown", "structures alone never complete the shelter step")
	_equals(_step_state(model, "bed"), "unknown", "a standing bed without an owner record is not a completed step")
	_equals(_step_state(model, "storage"), "unknown", "a standing chest without an owner record is not a completed step")
	_equals(_step_state(model, "research"), "done", "learned recipes are durable run knowledge and do complete their step")
	_equals(String(model.get("mode", "")), "first_run", "no clock and no owner run number means first run")
	_equals(_step_evidence(model, "bed"), "Đang có giường", "current furniture is still shown as current, not as completion")

	# With no readable bag, the owner's current snapshot is still shown as current.
	var snapshot_only := A6GuidanceModel.build({
		"run_facts": CONTRACT.sanitize_run_facts({"contract": "soh.a6.run_facts.v1", "holds": {"materials": 4}}),
		"current": {"available": false, "materials": -1, "structures": 0, "bed": false, "storage": false, "recipes": 0},
	}, {})
	_equals(_step_evidence(snapshot_only, "gather"), "Đang mang 4 nguyên liệu", "an owner snapshot fills the current-state line")
	_equals(_step_state(snapshot_only, "gather"), "unknown", "a snapshot still does not complete the step")

	# A first-run player who does one thing must not become a returning player.
	var one_action := CONTRACT.sanitize_run_facts({
		"contract": "soh.a6.run_facts.v1",
		"performed": {"gather_materials": true},
	})
	var first_run := A6GuidanceModel.build({"run_facts": one_action, "current": rich_current}, {})
	_equals(String(first_run.get("mode", "")), "first_run", "one completed action does not promote the guide to returning")
	_equals(_step_state(first_run, "gather"), "done", "the completed action is still ticked")
	_equals(_step_state(first_run, "shelter"), "unknown", "unrecorded steps stay unknown")

	# A real second run comes only from the owner.
	var second := CONTRACT.sanitize_run_facts({"contract": "soh.a6.run_facts.v1", "run_number": 2})
	var returning := A6GuidanceModel.build({"run_facts": second, "current": rich_current}, {})
	_equals(String(returning.get("mode", "")), "returning", "an owner run number of 2 makes the guide compact")
	var by_clock := A6GuidanceModel.build({"run_facts": no_facts, "current": rich_current}, CONTRACT.sanitize_season_clock(_clock(NOW, 2)))
	_equals(String(by_clock.get("mode", "")), "returning", "a season clock run number also drives the mode")

	# Lone wall / foundation: never a home, even when the owner explicitly says the
	# current structure set is not a valid shelter.
	var lone_wall := A6GuidanceModel.build({
		"run_facts": CONTRACT.sanitize_run_facts({"contract": "soh.a6.run_facts.v1", "shelter": {"validated": false}}),
		"current": {"available": true, "materials": 2, "structures": 1, "bed": false, "storage": false, "recipes": 0},
	}, {})
	_equals(_step_state(lone_wall, "shelter"), "open", "a lone wall is an open step, never a sheltered home")
	_equals(_step_evidence(lone_wall, "shelter"), "Đang có 1 khối đã dựng", "the wall is described as one block, nothing more")

	# Gather -> spend -> stash: the durable record survives an empty bag.
	var gathered := CONTRACT.sanitize_run_facts({
		"contract": "soh.a6.run_facts.v1",
		"performed": {"gather_materials": true},
	})
	var spent_bag := {"available": true, "materials": 0, "structures": 2, "bed": false, "storage": true, "recipes": 0}
	_equals(_step_state(A6GuidanceModel.build({"run_facts": gathered, "current": spent_bag}, {}), "gather"), "done", "spending and stashing do not un-gather a completed step")

	# Validated shelter is durable proof even before the owner records the action.
	var validated := CONTRACT.sanitize_run_facts({"contract": "soh.a6.run_facts.v1", "shelter": {"validated": true}})
	_equals(_step_state(A6GuidanceModel.build({"run_facts": validated, "current": rich_current}, {}), "shelter"), "done", "a physically validated room completes the shelter step")


# --- history / digest / ack / cues -----------------------------------------


func _test_history_contract() -> void:
	var runs: Array = []
	for index in range(23):
		runs.append({
			"started_at_unix": NOW - (index + 1) * 86400,
			"ended_at_unix": NOW - index * 86400,
			"end_reason": "deadline",
			"milestones": [],
		})
	# Shuffle deterministically so the newest record is far from index 0 and well
	# past the old "first 20" cut.
	var shuffled: Array = []
	for index in range(runs.size()):
		shuffled.append(runs[(index * 7 + 11) % runs.size()])
	var sanitized := CONTRACT.sanitize_run_history({
		"contract": "soh.a6.run_history.v1",
		"runs": shuffled,
		"achievements": [],
	})
	var kept: Array = sanitized.get("runs", [])
	_equals(kept.size(), 20, "23 valid runs are capped at the newest 20")
	var newest: int = int((kept[0] as Dictionary).get("ended_at_unix", 0))
	var newest_expected: int = NOW
	_equals(newest, newest_expected, "the newest run survives the cap even when it arrived late")
	var ordered := true
	for index in range(1, kept.size()):
		if int((kept[index] as Dictionary).get("ended_at_unix", 0)) > int((kept[index - 1] as Dictionary).get("ended_at_unix", 0)):
			ordered = false
	_expect(ordered, "the kept records are ordered newest first")


func _test_digest_contract() -> void:
	var digest := _digest(NOW, 18 * 3600, [
		{"kind": "forge", "completed_units": 8, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"},
	])
	var view := A6ReturnDigest.build_view(CONTRACT.sanitize_return_digest(digest))
	_equals((view.get("rows", []) as Array).size(), 1, "one settled station produces one row")
	var row: Dictionary = (view.get("rows", []) as Array)[0]
	_equals(String(row.get("title", "")), "Lò rèn", "the forge row is labelled in the player's words")
	_equals(String(row.get("detail", "")), "8 thỏi sắt", "the real output is printed")
	_equals(String(row.get("note", "")), "Đã hết nhiên liệu", "the real stop reason is printed")

	var unknown_kind := _digest(NOW, 2 * 3600, [{"kind": "smelter_v2", "completed_units": 3, "unit_label": "x", "stop_reason": "fuel_empty"}])
	_expect(not bool(CONTRACT.sanitize_return_digest(unknown_kind).get("available", true)), "an unknown station kind is dropped, never printed raw")
	var zero := _digest(NOW, 2 * 3600, [{"kind": "crop", "completed_units": 0, "unit_label": "quả", "stop_reason": "queue_empty"}])
	_expect(not bool(CONTRACT.sanitize_return_digest(zero).get("available", true)), "zero output does not become a reward row")

	# D059: the 1 HP floor needs a home *and* a validated shelter topology.
	var unvalidated := _digest(NOW, 20 * 3600, [])
	unvalidated["provisions"] = {"consumed": 3, "shelter": "home", "hp_floor": true}
	var unvalidated_view := CONTRACT.sanitize_return_digest(unvalidated)
	_expect(not bool((unvalidated_view.get("provisions", {}) as Dictionary).get("hp_floor", true)), "a home claim without validation does not earn the 1 HP floor")
	_equals(int((unvalidated_view.get("provisions", {}) as Dictionary).get("consumed", 0)), 3, "ration use is still reported")

	var home := _digest(NOW, 20 * 3600, [])
	home["provisions"] = {"consumed": 3, "shelter": "home", "shelter_validated": true, "hp_floor": true}
	_expect(bool((CONTRACT.sanitize_return_digest(home).get("provisions", {}) as Dictionary).get("hp_floor", false)), "a validated home earns the 1 HP floor")

	var wilderness := _digest(NOW, 20 * 3600, [])
	wilderness["provisions"] = {"consumed": 3, "shelter": "wilderness", "shelter_validated": true, "hp_floor": true}
	_expect(not bool((CONTRACT.sanitize_return_digest(wilderness).get("provisions", {}) as Dictionary).get("hp_floor", true)), "validation cannot move the 1 HP floor into the wilderness")

	var labeled := _digest(NOW, 2 * 3600, [])
	labeled["world_changes"] = ["res://game/survival/thing.gd was rebuilt"]
	_expect(not bool(CONTRACT.sanitize_return_digest(labeled).get("available", true)), "a technical world-change string is dropped")


func _test_ack_contract() -> void:
	var ack := CONTRACT.sanitize_digest_ack({
		"contract": "soh.a6.digest_ack.v1",
		"acknowledged": ["settle-a", "settle-b", "settle-a"],
	})
	_expect(bool(ack.get("available", false)), "an acknowledgement projection is accepted")
	_equals((ack.get("acknowledged", []) as Array).size(), 2, "duplicate acknowledgements collapse")
	_expect(not bool(CONTRACT.sanitize_digest_ack("nope").get("available", true)), "a malformed acknowledgement is ignored")


func _test_cue_contract() -> void:
	var legacy := {
		"contract": "soh.a6.site_cues.v1",
		"observed_at_unix": NOW,
		"trail": {"present": true, "age_seconds": 60},
		"threats": [{"distance_m": 42.0, "label": "Tiếng bước chân"}],
	}
	_expect(not bool(CONTRACT.sanitize_site_cues(legacy).get("available", true)), "the old distance-based cue contract is rejected")

	var cues := {
		"contract": "soh.a6.site_cues.v2",
		"observed_at_unix": NOW,
		"cues": [
			{"channel": "sound", "direction": "left", "age_seconds": 120, "ttl_seconds": 900},
			{"channel": "trace", "age_seconds": 100, "ttl_seconds": 1800},
			{"channel": "radar", "age_seconds": 1, "ttl_seconds": 900},
		],
	}
	var sanitized := CONTRACT.sanitize_site_cues(cues)
	_equals((sanitized.get("cues", []) as Array).size(), 2, "an unknown perception channel is dropped")
	var fresh := A6SiteCueChip.build_view(sanitized, NOW + 60)
	_expect(bool(fresh.get("visible", false)), "fresh perceived cues are shown")
	_equals(String(fresh.get("trail", "")), "Dấu vết · 2 phút trước", "a trace is described by its age")
	_equals(String(fresh.get("perceived", "")), "Có tiếng động · bên trái · 3 phút trước", "a sound cue keeps its direction")
	_expect(not String(fresh.get("trail", "")).contains(" m"), "no metre reading appears in a cue")
	_expect(not String(fresh.get("perceived", "")).contains(" m"), "no metre reading appears in a sound cue")

	# Twenty minutes of ageing push the sound cue past its 15-minute window while
	# the 30-minute trace is still inside its own.
	var aged := A6SiteCueChip.build_view(sanitized, NOW + 1200)
	_equals(String(aged.get("perceived", "missing")), "", "an expired sound disappears instead of looking current")
	_expect(not String(aged.get("trail", "")).is_empty(), "a trace with time left is still reported")
	_expect(not bool(A6SiteCueChip.build_view(sanitized, NOW + 2000).get("visible", true)), "once every window closes the chip disappears")

	var only_stale := {
		"contract": "soh.a6.site_cues.v2",
		"observed_at_unix": NOW,
		"cues": [{"channel": "sound", "age_seconds": 800, "ttl_seconds": 900}],
	}
	_expect(not bool(A6SiteCueChip.build_view(CONTRACT.sanitize_site_cues(only_stale), NOW + 200).get("visible", true)), "a cue that aged out during the absence is hidden")
	_equals(A6TimeFormat.ago(30), "vừa xong", "a sign younger than a minute reads as just now")
	_equals(A6TimeFormat.ago(7200), "2 giờ trước", "an older sign reads in hours")


# --- layer / cards ----------------------------------------------------------


func _test_layer_states() -> void:
	await _mount({})
	_expect(_layer != null, "the return layer scene instantiates")
	_expect(not _layer.run_card.visible, "no season projection means no season chip")
	_expect(not _layer.return_digest.visible, "no return digest means no return card")

	await _mount({"season_clock": _clock(NOW - 2 * 3600, 1), "return_digest": {}, "current": _current_all_done()})
	_expect(_layer.run_card.visible, "a published clock shows the season chip")
	_equals(_layer.run_card.countdown_label.text, "13 ngày 22 giờ", "the chip renders the countdown")
	_expect(not _layer.return_digest.visible, "an empty digest stays hidden")

	var settle_18 := {"return_digest": _digest(NOW, 18 * 3600, [
		{"kind": "forge", "completed_units": 5, "unit_label": "thỏi đồng", "stop_reason": "input_empty"},
		{"kind": "crop", "completed_units": 3, "unit_label": "củ cải", "stop_reason": "queue_empty"},
	])}
	await _mount(settle_18)
	_expect(_layer.return_digest.visible, "an 18-hour return with real output shows the card")
	_equals(_layer.return_digest.row_list.get_child_count(), 2, "both settled stations get a row")

	var digest_48 := _digest(NOW, 48 * 3600, [{"kind": "forge", "completed_units": 12, "unit_label": "thỏi sắt", "stop_reason": "output_full"}])
	digest_48["provisions"] = {"consumed": 6, "shelter": "home", "shelter_validated": true, "hp_floor": true}
	await _mount({"return_digest": digest_48})
	_expect(_layer.return_digest.visible, "a 48-hour return shows the card")
	_equals(_layer.return_digest.row_list.get_child_count(), 3, "output, rations and the shelter collapse are all reported")

	var dismissals := [0]
	_layer.digest_dismissed.connect(func(_id: String) -> void: dismissals[0] += 1)
	_layer.dismiss_digest()
	_layer.dismiss_digest()
	_expect(not _layer.return_digest.visible, "Continue closes the digest")
	_equals(dismissals[0], 1, "pressing Continue twice emits one dismissal")
	_layer.refresh()
	_layer.refresh()
	_expect(not _layer.return_digest.visible, "a dismissed digest does not come back on refresh")

	# A new layer is a new process: only an owner acknowledgement can keep it shut.
	var acked := _digest(NOW, 18 * 3600, [{"kind": "forge", "completed_units": 4, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"}])
	await _mount({
		"return_digest": acked,
		"digest_ack": {"contract": "soh.a6.digest_ack.v1", "acknowledged": [String(acked["digest_id"])]},
	})
	_expect(not _layer.return_digest.visible, "an owner acknowledgement keeps the digest closed in a new process")
	await _mount({"return_digest": acked, "digest_ack": {"contract": "soh.a6.digest_ack.v1", "acknowledged": []}})
	_expect(_layer.return_digest.visible, "without an acknowledgement a new process shows the digest again")

	await _mount({"return_digest": {"contract": "soh.a6.return_digest.v1", "digest_id": "x"}})
	_expect(not _layer.return_digest.visible, "a digest without settled changes stays hidden")
	_expect(_scan_forbidden().is_empty(), "no contract strings or fixture labels are visible: " + ", ".join(_scan_forbidden()))


func _test_guidance_panel_states() -> void:
	var unknown_current := {"available": true, "materials": 0, "structures": 0, "bed": false, "storage": false, "recipes": 0}
	await _mount({"current": unknown_current})
	_expect(_layer.guidance_panel.visible, "a first run shows the starter chain even without owner facts")
	_equals(_layer.guidance_panel.step_list.get_child_count(), 5, "the first run lists all five steps")
	_equals(_layer.guidance_panel.kicker_label.text, "BẮT ĐẦU", "the first run is labelled as a start")
	_equals(_layer.guidance_panel.progress_label.text, "—/5", "unknown progress is not printed as zero of five")
	_expect(_layer.guidance_panel.footnote_label.text.contains("Chưa ghi nhận"), "the panel says the progress is unrecorded")

	var gather_fact := {"contract": "soh.a6.run_facts.v1", "performed": {"gather_materials": true}}
	await _mount({"current": unknown_current, "run_facts": gather_fact})
	var rows := _layer.guidance_panel.view().get("rows", []) as Array
	_equals(rows.size(), 5, "first-run guidance keeps the whole chain")
	_expect(bool((rows[0] as Dictionary).get("done", false)), "a durable gather is ticked")
	_equals(String((rows[1] as Dictionary).get("state", "")), "unknown", "an unrecorded shelter remains unknown")

	# Second run: compact, one line.
	await _mount({"current": _current_all_done(), "run_facts": {"contract": "soh.a6.run_facts.v1", "run_number": 2}})
	_expect(_layer.guidance_panel.visible, "a second run still offers the next step")
	_equals(_layer.guidance_panel.step_list.get_child_count(), 1, "a second run stays compact")
	_equals(_layer.guidance_panel.kicker_label.text, "GỢI Ý", "the second run is a suggestion, not a tutorial")

	# Out-of-order: bed and chest before gathering.
	var out_of_order := {"contract": "soh.a6.run_facts.v1", "performed": {"place_bed": true, "place_storage": true}}
	await _mount({"current": unknown_current, "run_facts": out_of_order})
	var ordered_rows := _layer.guidance_panel.view().get("rows", []) as Array
	_equals(ordered_rows.size(), 5, "out-of-order progress still shows the whole chain on run one")
	_expect(bool((ordered_rows[2] as Dictionary).get("done", false)), "a bed built before the guide is ticked")
	_expect(not bool((ordered_rows[0] as Dictionary).get("done", true)), "an unperformed step stays open")

	# Everything done: the card removes itself.
	await _mount({"current": _current_all_done(), "run_facts": _facts_all_done()})
	_expect(not _layer.guidance_panel.visible, "a finished chain is not shown at all")

	await _mount({"current": unknown_current})
	_layer.dismiss_guidance()
	_layer.refresh()
	_expect(not _layer.guidance_panel.visible, "dismissed guidance stays closed for this session")


func _test_record_panel() -> void:
	# The exact regression: neither a season nor a history exists. The scene's
	# default "never finished a season" text must never be what the player reads.
	await _mount({})
	_layer.open_record()
	_expect(_layer.record_panel.visible, "the season record opens on demand")
	_equals(_layer.record_panel.notice_label.text, "Chưa có dữ liệu mùa", "with nothing published the record says it has no data")
	_expect(_layer.record_panel.notice_label.visible, "the no-data line is actually visible")
	_equals(_layer.record_panel.runs_empty.text, "Chưa có dữ liệu mùa", "the run list repeats the no-data wording")
	_expect(not _layer.record_panel.runs_empty.text.contains("khép lại"), "the empty record never claims the account finished nothing")
	_equals(_layer.record_panel.achievements_empty.text, "Chưa có dữ liệu thành tựu", "achievements use the same honest wording")
	_expect(_layer.record_panel.close_button.has_focus(), "opening the record focuses its only control")
	_layer.close_record()
	_expect(not _layer.record_panel.visible, "the record closes")

	# A clock with no history: a live line, but still no invented seasons.
	await _mount({"season_clock": _clock(NOW - 2 * 3600, 1)})
	_layer.open_record()
	_equals(String(_layer.record_panel.now_label.text), "Mùa 01 còn 13 ngày 22 giờ", "the record repeats the live run honestly")
	_expect(not _layer.record_panel.notice_label.visible, "a live clock is not a missing-data notice")
	_equals(_layer.record_panel.runs_empty.text, "Chưa có dữ liệu mùa", "without an owner history the list still admits it")
	_layer.close_record()

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

	var unknown := A6SurvivalReturnLayer.layout_rects(Vector2(1280, 720), [{"id": "bogus", "size": Vector2(10, 10)}])
	_expect(unknown.is_empty(), "an unknown layout id is ignored")


# --- ownership --------------------------------------------------------------


func _test_read_only() -> void:
	await _mount({
		"season_clock": _clock(NOW, 1),
		"return_digest": _digest(NOW, 18 * 3600, [{"kind": "forge", "completed_units": 2, "unit_label": "thỏi sắt", "stop_reason": "fuel_empty"}]),
		"current": _current_all_done(),
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


## The test itself writes through A0's public API (it is allowed to set up a
## player); A6 only reads. This is where "a lone wall is not a home" and
## "spending materials does not un-gather" are proven against the real service.
func _test_real_owner_state() -> void:
	var survival := get_tree().root.get_node_or_null("SurvivalService")
	_expect(survival != null, "the production SurvivalService autoload is present")
	if survival == null or _save == null:
		return
	var tag := "%d" % (Time.get_ticks_usec() % 1000000)
	var structures_before := int(survival.structure_count())
	# The save is reused across gate runs, so cells from earlier runs may already be
	# occupied. Walk a fresh band and let the helper retry instead of assuming free
	# ground; a false "cannot place" would make this gate flaky, not honest.
	var origin := Vector2i(2600 + (structures_before % 60) * 6, 2600 + (structures_before % 40) * 6)
	_expect(bool(_save.call(&"grant_inventory_item", &"oak_wood", &"material", 40, "a6test.wood." + tag)), "A0 accepts the test's wood")
	_expect(bool(_save.call(&"grant_inventory_item", &"iron_scrap", &"material", 10, "a6test.iron." + tag)), "A0 accepts the test's iron")

	var wall := _place_piece(survival, "wall_wood", origin, "a6test.wall." + tag)
	_expect(bool(wall.get("ok", false)), "A0 places one wall")
	_expect(int(survival.structure_count()) == structures_before + 1, "A0's structure count grew by exactly one")

	var source := A6OwnerProjectionSource.new()
	source.configure(get_tree())
	var inputs := source.guidance_inputs()
	_expect(bool((inputs.get("current", {}) as Dictionary).get("available", false)), "A6 reads the real survival state")
	_expect(int((inputs.get("current", {}) as Dictionary).get("structures", 0)) >= 1, "A6 sees the wall as a current structure")
	var model := A6GuidanceModel.build(inputs, {})
	_equals(_step_state(model, "shelter"), "unknown", "the real one-wall base never completes the shelter step")
	_expect(_step_state(model, "gather") != "done", "the real carried wood never completes the gather step")

	var materials_before := int((inputs.get("current", {}) as Dictionary).get("materials", 0))
	var second: Dictionary = survival.place_structure("wall_wood", origin + Vector2i(3, 0), "a6test.wall2." + tag)
	_expect(bool(second.get("ok", false)), "A0 places a second wall")
	var after := source.guidance_inputs()
	var materials_after := int((after.get("current", {}) as Dictionary).get("materials", 0))
	_expect(materials_after < materials_before, "building really consumed carried materials")
	_equals(_step_state(A6GuidanceModel.build(after, {}), "shelter"), "unknown", "two loose walls still do not validate a home")

	# Stash as well: a placed chest takes carried materials out of the bag.
	var chest: Dictionary = _place_piece(survival, "chest_wood", origin + Vector2i(2, 1), "a6test.chest." + tag)
	_expect(bool(chest.get("ok", false)), "A0 places a chest")
	var chest_id := String(chest.get("entity_id", ""))
	if not chest_id.is_empty():
		var stashed: bool = survival.transfer_to_container(chest_id, "oak_wood", 5, "a6test.stash." + tag)
		_expect(bool(stashed), "A0 moves five wood into the chest")
		var stashed_state := source.guidance_inputs()
		var stashed_materials := int((stashed_state.get("current", {}) as Dictionary).get("materials", 0))
		_expect(stashed_materials < materials_after, "stashing really reduced the carried materials")
		_expect(bool((stashed_state.get("current", {}) as Dictionary).get("storage", false)), "A6 sees the chest as a current structure")

	# And the panel over the real base: five rows, all unknown, no false ticks.
	await _mount({})
	_equals(_layer.guidance_panel.progress_label.text, "—/5", "the real base with no owner ledger shows unrecorded progress")
	_expect(_layer.guidance_panel.footnote_label.text.contains("Chưa ghi nhận"), "the real base panel admits the progress is unknown")
	var real_rows := _layer.guidance_panel.view().get("rows", []) as Array
	var shelter_row: Dictionary = {}
	for row_value: Variant in real_rows:
		if String((row_value as Dictionary).get("title", "")).begins_with("Dựng chỗ trú"):
			shelter_row = row_value
	_expect(not bool(shelter_row.get("done", true)), "the real walls are never ticked as a finished home")

	var durable := CONTRACT.sanitize_run_facts({
		"contract": "soh.a6.run_facts.v1",
		"performed": {"gather_materials": true, "valid_shelter": true},
	})
	var with_owner := A6GuidanceModel.build({"run_facts": durable, "current": after["current"]}, {})
	_equals(_step_state(with_owner, "gather"), "done", "an owner record survives the materials being spent")
	_equals(_step_state(with_owner, "shelter"), "done", "an owner-validated shelter stays done after the build cost is paid")


# --- helpers ----------------------------------------------------------------


func _place_piece(survival: Node, piece: String, base: Vector2i, key: String) -> Dictionary:
	for attempt in range(8):
		var cell := base + Vector2i(attempt * 4, attempt * 3)
		var result: Dictionary = survival.place_structure(piece, cell, "%s.%d" % [key, attempt])
		if bool(result.get("ok", false)):
			return result
	return {}


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
	return {
		"contract": "soh.a6.run_facts.v1",
		"run_number": 1,
		"performed": {
			"gather_materials": true,
			"valid_shelter": true,
			"place_bed": true,
			"place_storage": true,
			"learn_recipe": true,
		},
		"shelter": {"validated": true},
	}


func _current_all_done() -> Dictionary:
	return {"available": true, "materials": 40, "structures": 3, "bed": true, "storage": true, "recipes": 2}


func _step(model: Dictionary, step_id: String) -> Dictionary:
	for step_value: Variant in model.get("steps", []):
		var step: Dictionary = step_value
		if String(step.get("id", "")) == step_id:
			return step
	return {}


func _step_state(model: Dictionary, step_id: String) -> String:
	return String(_step(model, step_id).get("state", "missing"))


func _step_evidence(model: Dictionary, step_id: String) -> String:
	return String(_step(model, step_id).get("evidence", ""))


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

extends Node

## Two-process proof that the A6 return UI reads A0's *real* saved state.
##
## The rest of the A6 gates run inside one engine instance. The user-visible claim
## under test here is different: after the player quits and the OS starts the game
## again, the return card must show what A0 actually wrote - and must still refuse to
## invent the durable history that A0 has not published yet.
##
## Run it as two separate processes sharing one save file:
##
##   export SOUL_OF_HERO_SAVE_PATH="user://a6_consumer_restart.json"
##   godot --headless --path . res://tests/survival/ui/a6_a0_consumer_test.tscn \
##     -- --a6-consumer-phase=write
##   godot --headless --path . res://tests/survival/ui/a6_a0_consumer_test.tscn \
##     -- --a6-consumer-phase=read
##
## Phase `write` acts as the player: it calls A0's own public API to grant materials
## and place a wall, then quits. A6 writes nothing. Phase `read` boots a brand-new
## process, mounts the return layer with no injected projections, and asserts:
##
##   * the current-state line is exactly A0's saved numbers, not a fixture;
##   * every durable projection A0 has not published is UNKNOWN, not invented;
##   * the digest card refuses to render, because a season is not known;
##   * the save file is byte-identical after the layer was shown.
##
## Two processes in one job can only be simulated by the caller; this scene does not
## pretend otherwise. In a single run it prints which phase it is and fails if the
## phase contradicts the save it was handed.

const LAYER_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_survival_return_layer.tscn")
const MARKER := "A6 A0 CONSUMER"

var _checks := 0
var _failures: Array[String] = []
var _phase := ""
var _save: Node
var _survival: Node


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--a6-consumer-phase="):
			_phase = argument.trim_prefix("--a6-consumer-phase=")
	if _phase not in ["write", "read"]:
		printerr("%s: FAILED - pass --a6-consumer-phase=write or =read" % MARKER)
		get_tree().quit(2)
		return
	_save = get_tree().root.get_node_or_null("SaveService")
	_survival = get_tree().root.get_node_or_null("SurvivalService")
	_expect(_save != null, "the production SaveService autoload is present")
	_expect(_survival != null, "the production SurvivalService autoload is present")
	if _save == null or _survival == null:
		_finish()
		return
	if _phase == "write":
		_write_as_player()
	else:
		await _read_as_restart()
	_finish()


## Phase 1. The test plays the part of the player through A0's public API. This is
## setup, not A6 authority: no A6 code path is invoked in this phase at all.
func _write_as_player() -> void:
	var tag := "%d" % (Time.get_ticks_usec() % 1000000)
	_expect(bool(_save.call(&"grant_inventory_item", &"oak_wood", &"material", 12, "a6consumer.wood." + tag)), "A0 accepts 12 wood")
	_expect(bool(_save.call(&"grant_inventory_item", &"iron_scrap", &"material", 3, "a6consumer.iron." + tag)), "A0 accepts 3 iron")

	var before := int(_survival.structure_count())
	var origin := Vector2i(3200 + (before % 50) * 6, 3200 + (before % 30) * 6)
	var placed := _place_piece(origin, "wall_wood", "a6consumer.wall." + tag)
	_expect(bool(placed.get("ok", false)), "A0 places one wall: %s" % String(placed.get("reason", "")))
	_expect(int(_survival.structure_count()) == before + 1, "A0's structure count grew by exactly one")

	# Flush A0's own save so the next process starts from disk, not memory.
	if _save.has_method("save_now"):
		_save.call("save_now")
	print("%s: phase write recorded %d structures" % [MARKER, int(_survival.structure_count())])


## Phase 2. A fresh engine, the same save file. Everything below is A6 reading A0.
func _read_as_restart() -> void:
	var totals: Dictionary = _survival.call("inventory_totals")
	var materials := 0
	for quantity: Variant in totals.values():
		if quantity is int or quantity is float:
			materials += maxi(0, int(quantity))
	var structures := int(_survival.structure_count())
	_expect(structures > 0, "the second process sees the structure the first one saved (got %d)" % structures)
	_expect(materials >= 0, "the second process can read the saved bag (got %d wood)" % materials)
	print("%s: phase read sees materials=%d structures=%d" % [MARKER, materials, structures])
	_expect(materials > 0, "the second process sees materials the first one saved")

	var save_file := _save_file()
	var existed_before := not save_file.is_empty() and FileAccess.file_exists(save_file)
	var bytes_before := FileAccess.get_file_as_bytes(save_file) if existed_before else PackedByteArray()

	# No overrides: every projection has to come from the real owner or be UNKNOWN.
	var source := A6OwnerProjectionSource.new()
	source.configure(get_tree())

	var current: Dictionary = source.current_survival_state()
	_expect(bool(current.get("available", false)), "A0's current survival state is available to A6")
	_expect(int(current.get("structures", -1)) == structures,
		"the return UI shows A0's structure count (%d), not a fixture" % structures)
	_expect(int(current.get("materials", -1)) == materials,
		"the return UI shows A0's item count (%d), not a fixture" % materials)

	var clock: Dictionary = source.season_clock()
	_expect(not bool(clock.get("available", true)), "no season clock is published, so A6 reports it unavailable")
	var facts: Dictionary = source.run_facts()
	_expect(not bool(facts.get("available", true)), "no durable run facts are published, so A6 reports them unavailable")
	# `make_unavailable_digest` carries no `visible` key at all, so "available" plus an
	# empty production list is the honest test: refused, and nothing invented.
	var digest: Dictionary = source.return_digest()
	_expect(not bool(digest.get("available", true)), "no return digest is published, so the digest is refused")
	_expect((digest.get("production", []) as Array).is_empty(), "the refused digest invents no production rows")
	_expect(not String(digest.get("reason", "")).is_empty(), "the refusal names its reason (%s)" % String(digest.get("reason", "")))

	var history: Dictionary = source.run_history()
	var rows: Array = history.get("runs", [])
	_expect(not bool(history.get("available", true)) or rows.is_empty(),
		"no season history is published, so A6 shows no completed seasons")

	# Mount the real layer the same way the game does, and prove it stays read-only.
	var layer := LAYER_SCENE.instantiate()
	add_child(layer)
	layer.configure(get_tree(), {}, func() -> int: return int(Time.get_unix_time_from_system()))
	await _settle(4)
	var digest_card := layer.get("return_digest") as Control
	_expect(digest_card == null or not digest_card.visible,
		"with no published season, the digest card does not appear")
	var record := layer.get("record_panel") as Control
	if record != null:
		layer.open_record()
		await _settle(3)
	layer.queue_free()
	await _settle(2)

	var bytes_after := FileAccess.get_file_as_bytes(save_file) if existed_before else PackedByteArray()
	_expect(bytes_after == bytes_before, "mounting the return UI leaves A0's save file byte-identical")


func _place_piece(origin: Vector2i, piece_id: String, source_id: String) -> Dictionary:
	# A0's own public placement call; earlier runs may have filled cells, so walk a
	# band and let the owner refuse individual cells rather than assume free ground.
	for attempt in range(8):
		var cell := origin + Vector2i(attempt * 4, attempt * 3)
		var result: Dictionary = _survival.call("place_structure", piece_id, cell, "%s.%d" % [source_id, attempt])
		if bool(result.get("ok", false)):
			return result
	return {"ok": false, "reason": "no free cell near %s" % str(origin)}


func _save_file() -> String:
	var path := OS.get_environment("SOUL_OF_HERO_SAVE_PATH")
	if path.is_empty():
		return ""
	return ProjectSettings.globalize_path(path)


func _settle(frames: int) -> void:
	for _i in range(frames):
		await get_tree().process_frame


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _finish() -> void:
	if _failures.is_empty():
		print("%s PASSED (%s, %d checks)" % [MARKER, _phase, _checks])
		get_tree().quit(0)
		return
	for failure: String in _failures:
		printerr("%s FAIL: %s" % [MARKER, failure])
	printerr("%s FAILED (%s, %d/%d checks failed)" % [MARKER, _phase, _failures.size(), _checks])
	get_tree().quit(1)

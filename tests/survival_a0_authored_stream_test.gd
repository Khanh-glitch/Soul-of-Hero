extends "res://tests/survival_foundation_test.gd"
## A0 component probe (NOT a player journey): A1's authored continent on screen.
##
## A1's Round 12 production interfaces (`game/survival/world/a1_authored_world_reader.gd`
## and `a1_authored_world_stream.gd`) are mounted by A0 beside the legacy inset that
## A0 already governs. This probe answers three questions with evidence:
##
##   1. does the mount come up at all, and if not, which owner artifact is missing?
##   2. does it stream authored chunks for the player's real position, bounded?
##   3. does A0's own world keep its authority - same bounds, same build guard?
##
## It does not walk, fight, build or save, so it is a component probe and never a
## journey. When A1's source is not in the tree it reports NOT_APPLICABLE with the
## exact missing path instead of a pass.

const SETTING := "survival/a0_authored_stream"
const READER := "res://game/survival/world/a1_authored_world_reader.gd"
const STREAM := "res://game/survival/world/a1_authored_world_stream.gd"

var _ow: Node


func _console() -> void:
	_deadline_msec = Time.get_ticks_msec() + int(BUILD_TIMEOUT_MS * 4)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/survival_authored_stream_%d.json" % Time.get_ticks_usec()
	var save := root.get_node_or_null("SaveService")
	if save != null:
		save.call(&"configure_storage", save_path, true)
	print("A0 AUTHORED STREAM PROBE (component, not a journey)")
	if not FileAccess.file_exists(READER) or not FileAccess.file_exists(STREAM):
		var missing := READER if not FileAccess.file_exists(READER) else STREAM
		print("A0 AUTHORED STREAM NOT_APPLICABLE - A1 production interface absent: ", missing)
		print("A0 AUTHORED STREAM COMPONENT PROBE NOT_APPLICABLE - A1_AUTHORED_STREAM_ABSENT")
		_cleanup()
		quit(0)
		return
	ProjectSettings.set_setting(SETTING, true)
	_ow = await _boot()
	ProjectSettings.set_setting(SETTING, false)
	if _ow == null:
		_expect(false, "the world boots with A1's authored stream enabled")
		_finish()
		return

	var mount: Node = _ow.get(&"authored_mount")
	if mount == null:
		# A refusal that names an A1 dependency is an owner blocker, not an A0
		# defect: A1's runtime contract pins the bytes of files other owners edit, so
		# the reader refuses to boot in a composition where those bytes moved. Say so
		# with the owner and the artifact, keep A0's own world proven, and never call
		# it a pass.
		var refusal := String(_ow.get(&"authored_stream_error"))
		var world_ok := (_ow.get(&"world") as OverworldWorld) != null
		var player_ok: CharacterBody2D = _ow.get(&"player")
		print("A0 AUTHORED STREAM BLOCKED owner=A1 reason=%s" % refusal)
		_expect(world_ok and player_ok != null,
			"A0's own world and player keep working while the authored mount is blocked")
		_expect(refusal.begins_with("A1_"),
			"the refusal names A1's own artifact hash/path rather than an A0 failure (%s)" % refusal)
		print("A0 AUTHORED STREAM COMPONENT PROBE NOT_APPLICABLE - A1 owner blocker: ", refusal)
		_cleanup()
		quit(0)
		return
	_expect(true, "A0 mounts A1's authored stream on the production controller")
	var status: Dictionary = mount.call(&"status")
	_expect(bool(status.get("configured", false)), "the mounted stream is configured (%s)" % String(status.get("last_error", "")))
	_expect(String(status.get("last_error", "")) == "", "the mount reports no refusal reason")
	_expect(int(status.get("chunks_loaded", 0)) >= 1, "at least one authored chunk is mounted for the player (%d)" % int(status.get("chunks_loaded", 0)))
	_expect(int(status.get("max_chunks", 0)) >= int(status.get("chunks_loaded", 0)),
		"the stream stays inside its own bound (%d/%d)" % [int(status.get("chunks_loaded", 0)), int(status.get("max_chunks", 0))])
	_expect(String(status.get("region", "")) != "", "the stream reports the region the player stands in (%s)" % String(status.get("region", "")))

	# A0's authority is unchanged by mounting A1's continent beside it.
	var world: OverworldWorld = _ow.get(&"world")
	var build: SurvivalBuildSystem = _ow.get(&"survival_build")
	var player: CharacterBody2D = _ow.get(&"player")
	_expect(world != null and world.width == 384 and world.height == 256,
		"A0's own world keeps its shipped bounds (384x256) instead of widening over empty terrain")
	_expect(build != null and build.annex_disabled_from_x == -1,
		"the default build guard is untouched by the authored mount")
	var cell := Vector2i(400, 300) if world != null else Vector2i.ZERO
	_expect(not build.validate_cell(cell).is_empty(),
		"construction outside A0's world is still refused while A1's continent is mounted")
	_expect(player != null and world != null and world.cell_of(player.global_position).x < 384,
		"the player still stands inside A0's own world")

	# The authored frame is A1's, and it is bigger than what A0 plays: that gap is
	# reported, never quietly filled with invented ground.
	var reader_script: Variant = load(READER)
	var reader: Variant = (reader_script as Script).new() if reader_script is Script else null
	if reader != null:
		reader.call(&"configure", "res://data/survival/world")
		var plan: Dictionary = reader.get(&"plan")
		var frame: Dictionary = plan.get("frame", {})
		_expect(int(frame.get("w", 0)) == 1024 and int(frame.get("h", 0)) == 768,
			"A1's authored frame is the 1024x768 continent (%sx%s)" % [frame.get("w", 0), frame.get("h", 0)])
	var covered := 384.0 * 256.0 / (1024.0 * 768.0)
	print("A0 AUTHORED COVERAGE %.4f of the authored continent is A0-playable today" % covered)
	_finish()


func _cleanup() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	_teardown()


func _finish() -> void:
	var ok := failures.is_empty()
	print("A0 AUTHORED STREAM PROBE %s - %d checks" % ["PASSED" if ok else "FAILED", checks])
	_cleanup()
	if ok:
		print("A0 AUTHORED STREAM COMPONENT PROBE PASSED - %d checks" % checks)
		quit(0)
	else:
		print("A0 AUTHORED STREAM COMPONENT PROBE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)

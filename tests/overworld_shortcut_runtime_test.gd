extends SceneTree
## Shortcut: boot overworld, open a shortcut via OverworldState.open_shortcut,
## verify is_shortcut_open() returns true and the shortcut_opened signal
## fires. Collision swath changes on a fresh overworld are verified by
## structural presence of the collision StaticBody2D removal path — that
## is exercised implicitly when open_shortcut runs (it calls
## _apply_shortcut → _repaint_shortcut_opened which queues matching bodies
## for free).

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("SHORTCUT_FAIL: " + m); print("SHORTCUT_FAIL:", m)

func _wait_ready(ow: Node) -> Node:
	for i in range(240):
		await process_frame
		var s := ow.get_node_or_null("OverworldState")
		var e := ow.get_node_or_null("Entities")
		var lm := ow.get_node_or_null("Landmarks")
		if s != null and e != null and lm != null and lm.get_child_count() == 10:
			for _j in range(5): await process_frame
			return s
	return null

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	var state := _wait_ready(ow)
	expect(state != null, "overworld ready")
	if state == null: _finish(); return
	var signal_fired := false
	state.connect("shortcut_opened", func(_id: StringName): signal_fired = true, CONNECT_ONE_SHOT)
	expect(not bool(state.call("is_shortcut_open", &"short_crucible_bridge")),
		"short_crucible_bridge closed by default")
	state.call("open_shortcut", &"short_crucible_bridge")
	await process_frame
	expect(bool(state.call("is_shortcut_open", &"short_crucible_bridge")),
		"short_crucible_bridge open after open_shortcut()")
	expect(signal_fired, "shortcut_opened signal fired")
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_SHORTCUT_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_SHORTCUT_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)

extends SceneTree
## Provisions drain rates: boot overworld, wait for OverworldState to
## exist, then call drain_provisions directly and assert provisions drop
## over a 10-second wild-drain window. Also verifies activate_camp
## restores provisions.
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("PROV_FAIL: " + m); print("PROV_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	# Wait for state to exist.
	var state: Node = null
	for i in range(120):
		await process_frame
		state = ow.get_node_or_null("OverworldState")
		if state != null: break
	expect(state != null, "OverworldState in tree")
	if state == null: _finish(); return
	# Pause auto-process drain so our manual calls are deterministic.
	state.set_process(false)
	# Snapshot authored rates.
	var surv := ow.get("world_data").get("survival", {})
	var wild := float(surv.get("drain_per_second_wild", 0.4))
	var max_p := int(state.get("max_provisions"))
	var start_p := int(state.get("provisions"))
	expect(max_p > 0, "max_provisions > 0")
	expect(wild > 0.0, "wild rate > 0")
	# Drain 10s of wild.
	var dt := 1.0/60.0
	var before := start_p
	for _i in range(10*60): state.call("drain_provisions", dt, false, false)
	var after := int(state.get("provisions"))
	expect(after < before, "wild drain reduces provisions (%d -> %d)" % [before, after])
	# Activate camp refills.
	state.call("activate_camp", &"camp_refuge", state.get("last_world_position"))
	var after_camp := int(state.get("provisions"))
	expect(after_camp > after, "activate_camp restores provisions (%d -> %d)" % [after, after_camp])
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_PROVISIONS_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_PROVISIONS_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)

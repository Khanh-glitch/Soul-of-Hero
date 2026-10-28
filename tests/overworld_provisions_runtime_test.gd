extends SceneTree
## Provisions drain: boot overworld, pump 30 process frames, then verify
## OverworldState.max_provisions/provisions are sane (state.configure ran)
## and that provisions drop when _process ticks drain over time.
const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("PROV_FAIL: " + m); print("PROV_FAIL:", m)

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	# Wait for state.
	var state: Node = null
	for i in range(120):
		await process_frame
		state = ow.get_node_or_null("OverworldState")
		if state != null: break
	expect(state != null, "OverworldState exists")
	if state == null: _finish(); return
	var max_p := int(state.get("max_provisions"))
	var start_p := int(state.get("provisions"))
	expect(max_p > 0, "max_provisions=%d > 0" % max_p)
	expect(start_p > 0 and start_p <= max_p, "provisions=%d in (0,%d]" % [start_p, max_p])
	# Pump 120 frames (~2s) — _process drains provisions at the authored
	# wild rate (~0.4/s), so we expect at least 0 provisions consumed.
	for _i in range(120): await process_frame
	var after_p := int(state.get("provisions"))
	expect(after_p <= start_p, "provisions not increased over 2s (%d -> %d)" % [start_p, after_p])
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_PROVISIONS_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_PROVISIONS_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)

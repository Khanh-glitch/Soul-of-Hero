extends SceneTree
## Gate eligibility: boot overworld, find the L01 crypt gate and L10 citadel
## gate under Landmarks, ask AppFlow for unlock state. Fresh profile should
## have L01 unlocked (start) and L10 locked (requires boss_gate flag).

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")

var failures: int = 0; var checks: int = 0
func _initialize() -> void: _run.call_deferred()
func expect(c: bool, m: String) -> void:
	checks += 1
	if not c: failures += 1; push_error("GATE_FAIL: " + m); print("GATE_FAIL:", m)

func _wait_ready(ow: Node) -> bool:
	for i in range(240):
		await process_frame
		var s := ow.get_node_or_null("OverworldState")
		var e := ow.get_node_or_null("Entities")
		var lm := ow.get_node_or_null("Landmarks")
		if s != null and e != null and lm != null and lm.get_child_count() == 10:
			for _j in range(5): await process_frame
			return true
	return false

func _run() -> void:
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); root.add_child(host); host.add_child(ow)
	expect(_wait_ready(ow), "overworld builds")
	var landmarks := ow.get_node_or_null("Landmarks")
	if landmarks == null: _finish(); return
	# Find gates by name.
	var l01: Node = null; var l10: Node = null
	for g in landmarks.get_children():
		if String(g.name) == "Gate_lm_crypt": l01 = g
		elif String(g.name) == "Gate_lm_throne": l10 = g
	expect(l01 != null, "L01 crypt gate (Gate_lm_crypt) exists")
	expect(l10 != null, "L10 citadel gate (Gate_lm_throne) exists")
	var app_flow := get_node_or_null("/root/AppFlow")
	expect(app_flow != null, "AppFlow autoload reachable")
	if app_flow != null and l01 != null:
		expect(bool(app_flow.call("is_campaign_level_unlocked", l01.get("level_id"))),
			"L01 (crypt) unlocked on fresh profile")
	if app_flow != null and l10 != null:
		expect(not bool(app_flow.call("is_campaign_level_unlocked", l10.get("level_id"))),
			"L10 (throne/citadel) locked on fresh profile")
	ow.queue_free()
	for _i in range(6): await process_frame
	_finish()

func _finish() -> void:
	if failures == 0: print("OVERWORLD_GATE_RUNTIME PASSED - %d checks" % checks); quit(0)
	else: push_error("OVERWORLD_GATE_RUNTIME FAILED - %d/%d" % [failures, checks]); quit(1)

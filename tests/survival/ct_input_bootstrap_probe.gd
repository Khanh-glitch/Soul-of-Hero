extends SceneTree
## CT investigative probe, NOT a product component. Run only in the frozen
## A0+A1+A3+A6+A8 composition on an isolated CI worker. Tests why a direct
## --script reader call returns PLAYER_INPUT_MOVE_LEFT before app bootstrap.
##
## This test intentionally calls the real A0 InputBootstrap source as a Node.
## It does not mutate owner files, scenes, items, saves, or runtime settings.

const BOOTSTRAP_PATH := "res://game/autoload/input_bootstrap.gd"
const READER_PATH := "res://game/survival/world/a1_authored_world_reader.gd"

func _initialize() -> void:
	var loaded: Variant = load(READER_PATH)
	var bootstrap: Variant = load(BOOTSTRAP_PATH)
	if not (loaded is Script) or not (bootstrap is Script):
		print("CT_BOOTSTRAP_RESULT FAIL scripts unavailable")
		quit(1)
		return
	var was_present := InputMap.has_action(&"move_left")
	var before: RefCounted = loaded.new()
	var prior_ok: bool = before.call(&"configure")
	var before_reason: String = String(before.get(&"last_error"))
	print("CT_BOOTSTRAP_BEFORE action_registered=%s reader_ok=%s reason=%s" % [
		str(was_present), str(prior_ok), before_reason])
	if was_present or prior_ok or not before_reason.contains("PLAYER_INPUT_MOVE_LEFT"):
		print("CT_BOOTSTRAP_RESULT INCONCLUSIVE_DIRECT_SCRIPT_DID_NOT_REPRODUCE")
		quit(1)
		return

	var input_node: Node = bootstrap.new()
	get_root().add_child(input_node)
	var action_present := InputMap.has_action(&"move_left")
	var bound_events := InputMap.action_get_events(&"move_left").size() if action_present else 0
	print("CT_BOOTSTRAP_AFTER registered=%s events=%d" % [str(action_present), bound_events])
	if not action_present or bound_events <= 0:
		print("CT_BOOTSTRAP_RESULT FAIL_INPUT_BOOTSTRAP_DID_NOT_INSTALL")
		quit(1)
		return

	var after: RefCounted = loaded.new()
	var after_ok: bool = after.call(&"configure")
	var after_reason: String = String(after.get(&"last_error"))
	print("CT_BOOTSTRAP_READER_AFTER ok=%s reason=%s" % [str(after_ok), after_reason])
	if after_ok:
		print("CT_BOOTSTRAP_RESULT PASS_DIRECT_SCRIPT_FALSE_BLOCKER; A1 reader boots after actual input initialization")
		quit(0)
	else:
		print("CT_BOOTSTRAP_RESULT PARTIAL_INPUT_FIXED_OTHER_BLOCKER %s" % after_reason)
		quit(1)

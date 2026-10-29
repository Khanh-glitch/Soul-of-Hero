extends SceneTree
## Checks UI visibility notifications only. Deliberately does NOT claim to test
## A0's polled gameplay input gate or click-through safety in a live world.
const WORKSPACE := preload("res://game/survival/ui/expedition_workspace.tscn")
var failures: Array[String] = []
var checks := 0
var states: Array[bool] = []

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		printerr("FAIL: ", message)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var parent := Control.new()
	root.add_child(parent)
	var workspace: Variant = WORKSPACE.instantiate()
	parent.add_child(workspace)
	workspace.modal_state_changed.connect(func(active: bool): states.append(active))
	check(workspace.is_in_group(&"gameplay_modal"), "workspace root advertises A0's modal discovery group")
	workspace.open_workspace()
	await process_frame
	check(workspace.is_modal_active() and workspace.is_visible_in_tree() and states == [true], "explicit open announces one visible composed modal")
	workspace.show_desk()
	workspace.show_journal()
	check(states == [true], "switching nested views does not pulse aggregate inactive")
	parent.visible = false
	await process_frame
	await process_frame
	check(not workspace.is_modal_active() and states == [true, false], "hidden parent clears reported aggregate modal state")
	parent.visible = true
	await process_frame
	await process_frame
	check(workspace.is_modal_active() and states == [true, false, true], "restored parent re-announces effective visibility")
	workspace.close_workspace()
	check(states == [true, false, true, false], "explicit close clears aggregate state once")
	workspace.open_workspace()
	await process_frame
	workspace.queue_free()
	await process_frame
	check(states[-1] == false, "tree exit releases the UI's reported modal state")
	print("A6 MODAL LIFECYCLE: %d checks, %d failures" % [checks, failures.size()])
	parent.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

extends Control
## Interactive demo only: all state and actions are local test fixtures.
const WORKSPACE := preload("res://game/survival/ui/expedition_workspace.tscn")
const HOST := preload("res://tests/survival/ui/fixture_host_v1.gd")
var host := HOST.new(true)
func _ready() -> void:
	var workspace := WORKSPACE.instantiate()
	workspace.desk.set_developer_diagnostics(true)
	add_child(workspace)
	workspace.apply_snapshot(host.snapshot())
	workspace.request_action.connect(func(action: String, id: String, payload: Dictionary):
		workspace.apply_host_response(host.dispatch(action, id, payload))
	)
	workspace.closed.connect(func(): get_tree().quit())
	workspace.open_workspace()

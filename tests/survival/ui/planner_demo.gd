extends Control
const PLANNER := preload("res://game/survival/ui/expedition_planner.tscn")
const FIXTURE := preload("res://tests/survival/ui/planner_fixture.gd")
func _ready() -> void:
	var planner := PLANNER.instantiate()
	planner.set_developer_diagnostics(true)
	add_child(planner)
	planner.set_snapshot(FIXTURE.snapshot())
	planner.request_action.connect(func(_action: String, _id: String, _payload: Dictionary): planner.resolve_request("Fixture only: no game action was performed."))
	planner.closed.connect(func(): get_tree().quit())
	planner.open_planner()

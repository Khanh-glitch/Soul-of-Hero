@tool
class_name MapAuthoringEntities
extends Node2D

## Dedicated editor layer for drag-and-drop MapElementMarker preset scenes.
## This whole branch is hidden and inert in exported/running gameplay.

@export var show_markers_in_editor := true:
	set(value):
		show_markers_in_editor = value
		if Engine.is_editor_hint():
			visible = value


func _ready() -> void:
	if Engine.is_editor_hint():
		visible = show_markers_in_editor
		return
	visible = false
	process_mode = Node.PROCESS_MODE_DISABLED
	set_process(false)
	set_physics_process(false)
	set_process_input(false)
	set_process_unhandled_input(false)

extends Node2D

@onready var level: DungeonLevel = $Level
@onready var overview_camera: Camera2D = $OverviewCamera


func _ready() -> void:
	RenderingServer.set_default_clear_color(Color.BLACK)
	await get_tree().process_frame
	for candidate: Node in find_children("*", "Camera2D", true, false):
		var camera := candidate as Camera2D
		if camera != null:
			camera.enabled = camera == overview_camera
	var entities := level.get_node_or_null("Entities") as Node2D
	if entities != null:
		entities.visible = false

	var bounds := Rect2(Vector2.ZERO, Vector2(1600.0, 896.0))
	var raw_bounds: Variant = level.level_data.get("metadata", {}).get("camera_bounds", [])
	if raw_bounds is Array and raw_bounds.size() >= 4:
		bounds = Rect2(
			Vector2(float(raw_bounds[0]), float(raw_bounds[1])),
			Vector2(float(raw_bounds[2]), float(raw_bounds[3]))
		)
	var viewport_size := get_viewport_rect().size
	var margin := Vector2(48.0, 48.0)
	var fit_zoom := minf(
		viewport_size.x / (bounds.size.x + margin.x),
		viewport_size.y / (bounds.size.y + margin.y)
	)
	overview_camera.global_position = bounds.get_center()
	overview_camera.zoom = Vector2.ONE * fit_zoom
	overview_camera.enabled = true


class_name SurvivalDeathBag
extends Area2D

## A projection of a durable SaveService death-bag record. No independent item
## state lives here: the service commits recovery or leaves the bag unchanged.
var entity_id := ""
const REACH := 44.0
var _label: Label


func _ready() -> void:
	# Proximity prompts must disappear even when the death modal pauses play.
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group(&"player_interactable")
	add_to_group(&"survival_death_bag")
	collision_layer = 0
	collision_mask = 0
	monitoring = false
	monitorable = false
	_label = Label.new()
	_label.text = "[CLICK] Recover bag"
	_label.position = Vector2(-55, -22)
	_label.size = Vector2(110, 16)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.add_theme_font_size_override("font_size", 9)
	_label.add_theme_constant_override("outline_size", 3)
	_label.visible = false
	add_child(_label)
	queue_redraw()


func _draw() -> void:
	# In-house placeholder, intentionally distinct from a chest.
	draw_rect(Rect2(-6, -11, 12, 10), Color(0.38, 0.24, 0.15))
	draw_rect(Rect2(-4, -14, 8, 4), Color(0.60, 0.45, 0.28))
	draw_rect(Rect2(-4, -10, 8, 1), Color(0.86, 0.74, 0.50))


func _process(_delta: float) -> void:
	if _label == null:
		return
	_label.visible = false
	for node: Node in get_tree().get_nodes_in_group(&"player"):
		if not node is Node2D or bool(node.get(&"dead")):
			continue
		var actor := node as Node2D
		var distance := actor.global_position.distance_to(global_position)
		if distance > REACH:
			continue
		var nearer_bed := false
		for candidate: Node in get_tree().get_nodes_in_group(&"player_interactable"):
			if candidate is SurvivalStructure and (candidate as SurvivalStructure).piece_id == "bed_wood" \
					and (candidate as Node2D).global_position.distance_to(actor.global_position) < distance:
				nearer_bed = true
				break
		_label.visible = not nearer_bed
		break


func can_interact(actor: Node2D) -> bool:
	return actor != null and is_instance_valid(actor) and actor.global_position.distance_to(global_position) <= REACH


func interact(actor: Node2D) -> bool:
	if not can_interact(actor):
		return false
	var service := get_node_or_null("/root/SurvivalService")
	if service == null:
		return false
	var ok := bool(service.call(&"recover_death_bag", entity_id))
	var world := get_parent().get_parent() if get_parent() != null else null
	if world != null and world.has_method(&"_say"):
		world.call(&"_say", "Recovered your bag." if ok else "Make room in your bag first.")
	return true

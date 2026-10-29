class_name SurvivalStructure
extends Area2D

## A placed structure: real sprite, real collision, persistent identity.
##
## Collision is a [StaticBody2D] on layer 1, the same layer the terrain and the
## authored props block on, so the Knight's existing collision mask stops them
## with no change to player code. Foundations are walkable by design (they are
## floor) and so carry no body at all.
##
## The node never owns durable state: `entity_id`, the piece id and the cell come
## from, and are validated against, the survival document. Removing the node from
## the scene (region unload, reload) and rebuilding it from the document must
## produce exactly the same world, which is the property the persistence tests
## assert.

const TILE := 16
const GROUP := &"player_interactable"

@export var entity_id: String = ""
@export var piece_id: String = ""
@export var cell: Vector2i = Vector2i.ZERO


const SERVICE_PATH := "/root/SurvivalService"
const REACH := 44.0
const PIECE_CHEST := "chest_wood"
const PIECE_DOOR := "door_wood"

var _prompt: Label
var _last_interaction: Dictionary = {}


func _ready() -> void:
	# A chest is interactable on its own terms, not because the build system
	# remembered to put it in the group. Anything that materializes a structure —
	# the build system now, a region loader or a save migration later — gets the
	# same behaviour from the same place.
	if piece_id not in [PIECE_CHEST, PIECE_DOOR]:
		return
	add_to_group(GROUP)
	if piece_id == PIECE_CHEST:
		set_meta("container_entity", entity_id)
	_build_prompt()
	refresh_prompt()


func _build_prompt() -> void:
	_prompt = Label.new()
	_prompt.name = "Prompt"
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.position = Vector2(-70, -6)
	_prompt.size = Vector2(140, 14)
	_prompt.add_theme_font_size_override("font_size", 9)
	_prompt.add_theme_color_override("font_color", Color(0.94, 0.9, 0.74))
	_prompt.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.visible = false
	add_child(_prompt)


func service() -> Node:
	return get_node_or_null(SERVICE_PATH)


func chest_contents() -> Dictionary:
	var svc := service()
	if svc == null or piece_id != PIECE_CHEST:
		return {}
	return svc.call(&"container_contents", entity_id)


func _bag_is_empty() -> bool:
	var svc := service()
	if svc == null:
		return true
	return (svc.call(&"inventory_totals") as Dictionary).is_empty()


## Which way the next press will move items. Shown in the prompt so the player is
## never surprised by a press that takes instead of stashes.
func interaction_verb() -> String:
	if piece_id != PIECE_CHEST:
		return ""
	if not _bag_is_empty():
		return "stash"
	if not chest_contents().is_empty():
		return "take"
	return "empty"


func refresh_prompt() -> void:
	if _prompt == null:
		return
	if piece_id == PIECE_DOOR:
		var svc := service()
		if svc == null:
			return
		var record: Dictionary = (svc.call(&"structures") as Dictionary).get(entity_id, {})
		var is_open := bool(record.get("door_open", false))
		var shape := get_node_or_null("Solid/CollisionShape2D") as CollisionShape2D
		if shape != null:
			shape.set_deferred("disabled", is_open)
		var sprite := get_node_or_null("Sprite") as Sprite2D
		if sprite != null:
			sprite.modulate = Color(0.65, 0.75, 0.65, 0.6) if is_open else Color.WHITE
		_prompt.text = "[CLICK] Close door" if is_open else "[CLICK] Open door"
		return
	var contents := chest_contents()
	var total := 0
	for item_id: Variant in contents.keys():
		total += int(contents[item_id])
	match interaction_verb():
		"stash":
			_prompt.text = "[CLICK]  Stash items  (%d/%d)" % [contents.size(), capacity()]
		"take":
			_prompt.text = "[CLICK]  Take all  (%d stored)" % total
		_:
			_prompt.text = "Chest — empty"


func capacity() -> int:
	var svc := service()
	if svc == null:
		return 12
	return int((svc.call(&"piece_definition", PIECE_CHEST) as Dictionary).get("slots", 12))


func can_interact(player: Node2D) -> bool:
	if piece_id not in [PIECE_CHEST, PIECE_DOOR]:
		return false
	if player != null and is_instance_valid(player):
		if player.global_position.distance_to(global_position) > REACH:
			return false
	return piece_id == PIECE_DOOR or interaction_verb() != "empty"


func _doorway_clear() -> bool:
	# Conservative clearance around the cell, accounting for the Hero collider.
	# Scene ownership lives here rather than in the save autoload.
	var centre := global_position + Vector2(8, 8)
	for actor: Node in get_tree().get_nodes_in_group(&"player"):
		if actor is Node2D and (actor as Node2D).global_position.distance_to(centre) < 24.0:
			return false
	return true


func _process(_delta: float) -> void:
	if piece_id != PIECE_DOOR or _prompt == null:
		return
	_prompt.visible = false
	for actor: Node in get_tree().get_nodes_in_group(&"player"):
		if actor is Node2D and (actor as Node2D).global_position.distance_to(global_position) <= REACH:
			_prompt.visible = true
			break


func interact(player: Node2D) -> bool:
	# The chest owns the click even when it has nothing to offer: an empty press
	# that silently becomes an attack swing is how a player loses a structure.
	if piece_id not in [PIECE_CHEST, PIECE_DOOR]:
		return false
	if player != null and is_instance_valid(player):
		if player.global_position.distance_to(global_position) > REACH:
			return false
	var svc := service()
	if svc == null:
		return false
	if piece_id == PIECE_DOOR:
		_last_interaction = svc.call(&"toggle_door", entity_id, Callable(self, "_doorway_clear"))
		refresh_prompt()
		return true
	var verb := interaction_verb()
	var result: Dictionary = {}
	if verb == "stash":
		result = svc.call(&"deposit_all", entity_id)
	elif verb == "take":
		result = svc.call(&"withdraw_all", entity_id)
	else:
		result = {"ok": true, "reason": "empty", "moved": {}}
	_last_interaction = result.duplicate(true)
	var hud := _hud()
	if hud != null:
		var moved: Dictionary = result.get("moved", {})
		var moved_total := 0
		for item_id: Variant in moved.keys():
			moved_total += int(moved[item_id])
		if moved_total > 0:
			hud.call(&"show_prompt",
				"%s %d item%s" % [
					"Stashed" if verb == "stash" else "Took",
					moved_total, "" if moved_total == 1 else "s"],
				1.2)
		elif String(result.get("reason", "")) == "container_full":
			hud.call(&"show_prompt", "The chest is full.", 1.6)
		else:
			hud.call(&"show_prompt", "Nothing to move.", 1.2)
	refresh_prompt()
	return true


func _hud() -> Node:
	var parent := get_parent()
	while parent != null:
		if parent.has_method(&"show_prompt"):
			return parent
		parent = parent.get_parent()
	return null


## Test surface: what the last chest interaction actually did.
func last_interaction() -> Dictionary:
	return _last_interaction.duplicate(true)


static func is_solid_piece(piece_id_value: String) -> bool:
	# Kept in step with data/survival/survival_catalog.json `pieces.*.solid`.
	# A single source would be better; the catalog is data that survives a save
	# and this is a compile-time constant, so the two are asserted equal by
	# tests/survival_build_runtime_test.gd rather than trusted.
	return piece_id_value in ["wall_wood", "door_wood", "chest_wood"]

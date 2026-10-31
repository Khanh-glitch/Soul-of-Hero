class_name SurvivalResourceNode
extends Area2D

## A harvestable world resource with a persistent identity.
##
## The node is a *view*: all durable state (`hits_left`, `depleted_at`, harvest
## count) lives in the survival document inside SaveService, keyed by
## [member node_id]. That split is deliberate — the same tree must be the same
## tree after a reload, after the overworld is rebuilt, and after the player walks
## out of range and back, and an `Area2D` cannot guarantee any of those.
##
## Interaction goes through the existing `player_interactable` convention the
## Knight already implements (`can_interact` / `interact`), so no player input code
## is modified by survival.

signal gathered(node_id: String, item_id: String, quantity: int)

const GROUP := &"player_interactable"
const SERVICE_PATH := "/root/SurvivalService"

@export var node_id: String = ""
@export var resource_kind: String = ""
@export var display_name: String = "Resource"
## How many distinct swings the same node can absorb inside one second. Purely a
## UI guard: the authoritative gate is the transaction key in the service, which
## makes a repeated action a no-op regardless of how it was triggered.
const INTERACT_COOLDOWN := 0.18
const REACH := 44.0

var _used_marker: Polygon2D
var _prompt: Label
var _cooldown := 0.0
var _last_result: Dictionary = {}


func _ready() -> void:
	add_to_group(GROUP)
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	monitorable = false
	if get_node_or_null("Shape") == null:
		var shape := CollisionShape2D.new()
		shape.name = "Shape"
		var circle := CircleShape2D.new()
		circle.radius = 20.0
		shape.shape = circle
		shape.position = Vector2(0, -6)
		add_child(shape)
	_build_overlay()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	refresh()


func _process(delta: float) -> void:
	if _cooldown > 0.0:
		_cooldown = maxf(0.0, _cooldown - delta)


func _build_overlay() -> void:
	# A faint ring under the node while it is still ripe, so the player can see at
	# a glance which visible trees and rocks are actually harvestable. It is drawn
	# on the node, not baked into the prop atlas: the world atlas stays exactly as
	# the overworld artists left it.
	_used_marker = Polygon2D.new()
	_used_marker.name = "Ripe"
	_used_marker.polygon = PackedVector2Array([
		Vector2(-9, -2), Vector2(-3, -6), Vector2(3, -6), Vector2(9, -2),
		Vector2(9, 2), Vector2(3, 6), Vector2(-3, 6), Vector2(-9, 2),
	])
	_used_marker.color = Color(0.62, 0.86, 0.72, 0.22)
	add_child(_used_marker)
	_prompt = Label.new()
	_prompt.name = "Prompt"
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.position = Vector2(-70, 10)
	_prompt.size = Vector2(140, 14)
	_prompt.add_theme_font_size_override("font_size", 9)
	_prompt.add_theme_color_override("font_color", Color(0.92, 0.96, 0.88))
	_prompt.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.06))
	_prompt.add_theme_constant_override("outline_size", 4)
	_prompt.visible = false
	add_child(_prompt)


func service() -> Node:
	return get_node_or_null(SERVICE_PATH)


func refresh() -> void:
	var svc := service()
	if svc == null:
		return
	var state: Dictionary = svc.call(&"resource_state", node_id, resource_kind)
	var definition: Dictionary = svc.call(&"resource_definition", resource_kind)
	var full := maxi(1, int(definition.get("hits", 1)))
	var left := int(state.get("hits_left", full))
	var ripe := bool(svc.call(&"is_node_harvestable", node_id, resource_kind))
	if _used_marker != null:
		_used_marker.visible = ripe
	if _prompt != null:
		_prompt.text = _prompt_text(ripe, left, full)


func _prompt_text(ripe: bool, left: int, full: int) -> String:
	if not ripe:
		return "%s — spent" % display_name
	# Showing the swings left is the readable top-down affordance the fusion
	# blueprint asks for: the player plans a route around what is actually
	# harvestable right now instead of swinging at dead stumps.
	return "[CLICK]  %s  %d/%d" % [display_name, left, full]


func _within_reach(player: Node2D) -> bool:
	return player != null and is_instance_valid(player) and player.global_position.distance_to(global_position) <= REACH


func can_interact(player: Node2D) -> bool:
	var svc := service()
	if svc == null or not _within_reach(player):
		return false
	return bool(svc.call(&"is_node_harvestable", node_id, resource_kind))


func interact(player: Node2D) -> bool:
	# An already-spent *nearby* node still owns the click and explains itself.
	if not _within_reach(player):
		return false
	var svc := service()
	if svc == null:
		return true
	if _cooldown > 0.0:
		return true
	_cooldown = INTERACT_COOLDOWN
	# If the player physically owns an A3 tool that A3 allows on this kind, the
	# swing is one atomic harvest+wear. Otherwise it stays the bare-handed swing:
	# no tool, no wear, and the same yields as before.
	var economy := _economy()
	var tool_id := String(economy.call(&"tool_for_node", node_id, resource_kind)) if economy != null else ""
	var result: Dictionary
	if not tool_id.is_empty():
		result = svc.call(&"harvest_with_tool", node_id, resource_kind, economy, tool_id,
			String(economy.call(&"world_revision")), int(economy.call(&"world_active_seconds")))
	else:
		result = svc.call(&"harvest", node_id, resource_kind)
	_last_result = result
	if bool(result.get("ok", false)):
		gathered.emit(node_id, String(result.get("item_id", "")), int(result.get("quantity", 0)))
		var hud := _hud()
		if hud != null:
			hud.call(&"show_prompt",
				"+%d %s" % [int(result.get("quantity", 0)), _item_label(String(result.get("item_id", "")))],
				1.2)
	else:
		var hud := _hud()
		if hud != null:
			match String(result.get("reason", "")):
				"depleted":
					hud.call(&"show_prompt", "%s is spent — it will regrow." % display_name, 1.6)
				"inventory_full":
					hud.call(&"show_prompt", "Your pack is full.", 1.6)
				_:
					pass
	refresh()
	return true


func _item_label(item_id: String) -> String:
	var svc := service()
	if svc == null:
		return item_id
	var definition: Dictionary = svc.call(&"item_definition", item_id)
	return String(definition.get("label", item_id))


## The live A0 economy session mounted by the overworld, if this run has one.
## Walked up from this node so it also works for a world hosted by a test rig; a
## world without the A3 session simply has no tool swing.
func _economy() -> Node:
	var parent := get_parent()
	while parent != null:
		var session: Variant = parent.get("economy_session")
		if session is Node and (session as Node).get_script() != null:
			return session as Node
		parent = parent.get_parent()
	return null


func _hud() -> Node:
	var parent := get_parent()
	while parent != null:
		if parent.has_method(&"show_prompt"):
			return parent
		parent = parent.get_parent()
	return null


func _on_body_entered(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = true
		refresh()


func _on_body_exited(body: Node) -> void:
	if body.is_in_group(&"player") and _prompt != null:
		_prompt.visible = false


## Test surface: what the last interaction actually did.
func last_result() -> Dictionary:
	return _last_result.duplicate(true)

class_name FieldCodexEntry
extends Control

const DragPreviewScene: PackedScene = preload("res://game/ui/field_codex_drag_preview.tscn")
const LEGENDARY_RARITY_INDEX := 4
const EMPTY_BORDER_COLOR := Color("7f705c")

@onready var icon: TextureRect = %Icon
@onready var fallback: TextureRect = %Fallback
@onready var selection_mark: TextureRect = %SelectionMark
@onready var icon_slot: TextureRect = get_node_or_null("IconSlot") as TextureRect
## FieldCodexEntry is also reused by list-style scenes that intentionally do
## not render an item frame. Rarity visuals are therefore optional children;
## the compact inventory/equipment scenes provide both nodes.
@onready var rarity_glow: TextureRect = get_node_or_null("%RarityGlow") as TextureRect
@onready var rarity_border: TextureRect = get_node_or_null("%RarityBorder") as TextureRect
@onready var title_label: Label = %Title
@onready var detail_label: Label = %Detail
@onready var action_button: Button = %ActionButton
@onready var item_badge: Label = get_node_or_null("%ItemBadge") as Label

var _title := ""
var _detail := ""
var _rarity := &"normal"
var _icon_texture: Texture2D
var _action_text := ""
var _action := Callable()
var _disabled := false
var _drag_payload: Dictionary = {}
var _select_action := Callable()
var _selection_armed := false
var _drag_started := false
var _rarity_effect_tween: Tween
var _rarity_visual_state: Dictionary = {}


func configure(
		title: String,
		detail: String,
		rarity: StringName = &"normal",
		icon_texture: Texture2D = null,
		action_text := "",
		action := Callable(),
		disabled := false,
		drag_payload: Dictionary = {},
		select_action := Callable()
) -> void:
	_title = title
	_detail = detail
	_rarity = rarity
	_icon_texture = icon_texture
	_action_text = action_text
	_action = action
	_disabled = disabled
	_drag_payload = drag_payload.duplicate(true)
	_select_action = select_action
	if is_node_ready():
		_apply()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	action_button.pressed.connect(_on_action_pressed)
	_apply()


func _exit_tree() -> void:
	_stop_rarity_effect()


func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or event.button_index != MOUSE_BUTTON_LEFT:
		return
	if event.pressed:
		_selection_armed = true
		_drag_started = false
		return
	var should_select := _selection_armed and not _drag_started and _select_action.is_valid()
	_selection_armed = false
	_drag_started = false
	if should_select:
		_select_action.call()
		accept_event()


func _get_drag_data(_at_position: Vector2) -> Variant:
	if _disabled or _drag_payload.is_empty():
		return null
	_disarm_selection_for_drag()
	var preview := DragPreviewScene.instantiate() as Control
	var preview_icon := preview.get_node("%Icon") as TextureRect
	preview_icon.texture = _icon_texture
	preview_icon.visible = _icon_texture != null
	set_drag_preview(preview)
	return _drag_payload.duplicate(true)


func _disarm_selection_for_drag() -> void:
	_drag_started = true
	_selection_armed = false


func set_selected(selected: bool) -> void:
	selection_mark.visible = selected


func get_drag_payload() -> Dictionary:
	return _drag_payload.duplicate(true)


func get_rarity_visual_state() -> Dictionary:
	return _rarity_visual_state.duplicate(true)


func _apply() -> void:
	var is_empty_placeholder := (
		_title.is_empty() and _detail.is_empty() and _drag_payload.is_empty()
	)
	title_label.text = _title
	detail_label.text = _detail
	title_label.add_theme_color_override(&"font_color", RarityPalette.on_light_text_color(_rarity))
	_apply_rarity_visual(is_empty_placeholder)
	if icon_slot != null:
		icon_slot.modulate = (
			Color(1.0, 1.0, 1.0, 0.22)
			if is_empty_placeholder
			else Color.WHITE
		)
	icon.texture = _icon_texture
	icon.visible = _icon_texture != null and not is_empty_placeholder
	fallback.visible = _icon_texture == null and not is_empty_placeholder
	action_button.text = _action_text
	action_button.visible = not _action_text.is_empty()
	action_button.disabled = _disabled or not _action.is_valid()
	if item_badge != null:
		item_badge.text = _item_badge_text()
		item_badge.visible = not item_badge.text.is_empty()
	mouse_default_cursor_shape = Control.CURSOR_DRAG if not _drag_payload.is_empty() else Control.CURSOR_POINTING_HAND
	tooltip_text = (
		""
		if is_empty_placeholder
		else "%s  •  %s\nThả chuột để xem  •  kéo vào ô trang bị" % [_title, _detail]
	)


func _item_badge_text() -> String:
	var kind := StringName(_drag_payload.get("kind", &""))
	var item_value: Variant = _drag_payload.get("item", {})
	var item := item_value as Dictionary if item_value is Dictionary else {}
	if kind == &"stackable":
		var quantity := maxi(0, int(item.get("quantity", 0)))
		return "x%d" % quantity if quantity > 1 else ""
	if kind == &"auxiliary_equipment":
		var rank := maxi(0, int(item.get("upgrade_rank", 0)))
		return "+%d" % rank if rank > 0 else ""
	return ""


func _apply_rarity_visual(is_empty_placeholder: bool) -> void:
	_stop_rarity_effect()
	var normalized_rarity := RarityPalette.normalize(_rarity)
	var rarity_index := RarityPalette.index(normalized_rarity)
	var border_color := (
		EMPTY_BORDER_COLOR
		if is_empty_placeholder
		else RarityPalette.color(normalized_rarity)
	)
	border_color.a = 0.22 if is_empty_placeholder else minf(1.0, 0.78 + rarity_index * 0.035)
	var has_rarity_frame := rarity_border != null and rarity_glow != null
	if not has_rarity_frame:
		_rarity_visual_state = {
			"rarity": normalized_rarity,
			"rarity_index": rarity_index,
			"is_empty": is_empty_placeholder,
			"is_pulsing": false,
			"border_color": border_color,
			"glow_alpha": 0.0,
		}
		return
	rarity_border.visible = not is_empty_placeholder
	_set_rarity_tint(rarity_border, border_color)
	rarity_border.modulate = Color.WHITE
	rarity_glow.visible = not is_empty_placeholder and rarity_index > 0
	var is_pulsing := not is_empty_placeholder and rarity_index >= LEGENDARY_RARITY_INDEX
	var glow_alpha := 0.0
	if rarity_glow.visible:
		glow_alpha = 0.08 + rarity_index * 0.025
		_set_rarity_tint(rarity_glow, border_color)
		rarity_glow.modulate = Color(1.0, 1.0, 1.0, glow_alpha)
	if is_pulsing:
		_start_rarity_pulse(normalized_rarity, rarity_index)
	_rarity_visual_state = {
		"rarity": normalized_rarity,
		"rarity_index": rarity_index,
		"is_empty": is_empty_placeholder,
		"is_pulsing": is_pulsing,
		"border_color": border_color,
		"glow_alpha": glow_alpha,
	}


func _start_rarity_pulse(rarity: StringName, rarity_index: int) -> void:
	if rarity_glow == null:
		return
	var tier_above_legendary := rarity_index - LEGENDARY_RARITY_INDEX
	var minimum_alpha := 0.15 + tier_above_legendary * 0.015
	var maximum_alpha := 0.30 + tier_above_legendary * 0.035
	var half_duration := maxf(0.78, 1.08 - tier_above_legendary * 0.08)
	var glow_color := RarityPalette.color(rarity)
	_set_rarity_tint(rarity_glow, glow_color)
	rarity_glow.modulate = Color(1.0, 1.0, 1.0, minimum_alpha)
	_rarity_effect_tween = create_tween().set_loops().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	_rarity_effect_tween.tween_property(
		rarity_glow,
		"modulate:a",
		maximum_alpha,
		half_duration,
	).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_rarity_effect_tween.tween_property(
		rarity_glow,
		"modulate:a",
		minimum_alpha,
		half_duration,
	).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _stop_rarity_effect() -> void:
	if _rarity_effect_tween == null:
		return
	if _rarity_effect_tween.is_valid():
		_rarity_effect_tween.kill()
	_rarity_effect_tween = null


func _set_rarity_tint(target: TextureRect, color: Color) -> void:
	var shader_material := target.material as ShaderMaterial
	if shader_material != null:
		shader_material.set_shader_parameter(&"tint_color", color)
		return
	target.modulate = color


func _on_action_pressed() -> void:
	if _disabled or not _action.is_valid():
		return
	_action.call()

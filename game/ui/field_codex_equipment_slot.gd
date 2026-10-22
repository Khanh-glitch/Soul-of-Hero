class_name FieldCodexEquipmentSlot
extends Control

const DragPreviewScene: PackedScene = preload("res://game/ui/field_codex_drag_preview.tscn")
const LEGENDARY_RARITY_INDEX := 4
const EMPTY_BORDER_COLOR := Color("7f705c")

signal item_dropped(slot_id: StringName, payload: Dictionary)
signal item_selected(accepted_kind: StringName, item: Dictionary)

@onready var slot_frame: TextureRect = %SlotFrame
@onready var rarity_glow: TextureRect = %RarityGlow
@onready var rarity_border: TextureRect = %RarityBorder
@onready var item_icon: TextureRect = %ItemIcon
@onready var empty_mark: TextureRect = %EmptyMark
@onready var slot_label: Label = %SlotLabel
@onready var lock_label: Label = %LockLabel

var _slot_id := &""
var _accepted_kind := &""
var _unlocked := true
var _item: Dictionary = {}
var _slot_title := ""
var _locked_hint := ""
var _accepted_hero_id := ""
var _selection_armed := false
var _drag_started := false
var _rarity_effect_tween: Tween
var _rarity_visual_state: Dictionary = {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_CAN_DROP


func _exit_tree() -> void:
	_stop_rarity_effect()


func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or event.button_index != MOUSE_BUTTON_LEFT:
		return
	if event.pressed:
		_selection_armed = _unlocked and not _item.is_empty()
		_drag_started = false
		return
	var should_select := _selection_armed and not _drag_started \
		and _unlocked and not _item.is_empty()
	_selection_armed = false
	_drag_started = false
	if should_select:
		item_selected.emit(_accepted_kind, _item.duplicate(true))
		accept_event()


func _get_drag_data(_at_position: Vector2) -> Variant:
	var payload := get_drag_payload()
	if payload.is_empty():
		return null
	_disarm_selection_for_drag()
	var preview := DragPreviewScene.instantiate() as Control
	var preview_icon := preview.get_node("%Icon") as TextureRect
	preview_icon.texture = item_icon.texture
	preview_icon.visible = item_icon.texture != null
	set_drag_preview(preview)
	return payload


func _disarm_selection_for_drag() -> void:
	_drag_started = true
	_selection_armed = false


func configure(
		slot_id: StringName,
		title: String,
		accepted_kind: StringName,
		item: Dictionary,
		icon_texture: Texture2D,
		unlocked := true,
		locked_hint := "",
		item_display_name := "",
		rarity_display_name := "",
		accepted_hero_id := "",
) -> void:
	_slot_id = slot_id
	_accepted_kind = accepted_kind
	_item = item.duplicate(true)
	_unlocked = unlocked
	_slot_title = title
	_locked_hint = locked_hint.trim_prefix("LV ").strip_edges()
	_accepted_hero_id = accepted_hero_id.strip_edges().to_lower()
	if not is_node_ready():
		await ready
	var badge := _slot_badge(slot_id)
	slot_label.visible = not badge.is_empty()
	slot_label.text = badge
	item_icon.texture = icon_texture
	var show_slot_silhouette := accepted_kind == &"auxiliary_equipment"
	item_icon.visible = icon_texture != null and (not item.is_empty() or show_slot_silhouette)
	item_icon.modulate = (
		Color(0.42, 0.31, 0.23, 0.18)
		if not unlocked
		else Color(0.42, 0.31, 0.23, 0.34)
		if item.is_empty()
		else Color.WHITE
	)
	# The frame and the compact role badge already communicate an empty target;
	# a second inner placeholder only made the six-slot silhouette noisy.
	empty_mark.visible = false
	lock_label.visible = not unlocked and accepted_kind == &"auxiliary_equipment"
	lock_label.text = _locked_hint if not _locked_hint.is_empty() else "•"
	var rarity: Variant = item.get("rarity", &"normal") if not item.is_empty() else &"normal"
	_apply_rarity_visual(rarity, not unlocked or item.is_empty())
	slot_frame.modulate = (
		Color(1.0, 1.0, 1.0, 0.35)
		if not unlocked
		else Color(1.0, 1.0, 1.0, 0.48)
		if item.is_empty()
		else Color.WHITE
	)
	tooltip_text = _tooltip_text(title, item_display_name, rarity_display_name, _locked_hint)
	mouse_default_cursor_shape = (
		Control.CURSOR_DRAG
		if _unlocked and not _item.is_empty()
		else Control.CURSOR_CAN_DROP
	)


func get_equipment_slot_id() -> StringName:
	return _slot_id


func get_equipped_item() -> Dictionary:
	return _item.duplicate(true)


func get_rarity_visual_state() -> Dictionary:
	return _rarity_visual_state.duplicate(true)


func get_drag_payload() -> Dictionary:
	if not _unlocked or _item.is_empty():
		return {}
	var identity := String(_item.get(
		"instance_id" if _accepted_kind == &"hero_soul" else "uuid",
		"",
	))
	return {
		"key": "%s:%s" % ["soul" if _accepted_kind == &"hero_soul" else "gear", identity],
		"kind": _accepted_kind,
		"item": _item.duplicate(true),
	}


func can_accept_payload(payload: Variant) -> bool:
	if not _unlocked or not payload is Dictionary:
		return false
	var data := payload as Dictionary
	if StringName(data.get("kind", &"")) != _accepted_kind:
		return false
	if _accepted_kind == &"auxiliary_equipment":
		var item_value: Variant = data.get("item", {})
		if not item_value is Dictionary:
			return false
		var legacy_slot := String((item_value as Dictionary).get("slot", ""))
		var hero_slot := String({
			"soul_vessel": "armor",
			"soul_boots": "boots",
			"soul_trace": "jewelry",
		}.get(legacy_slot, ""))
		return StringName(hero_slot) == _slot_id
	if _accepted_kind != &"hero_soul":
		return false
	var hero_item: Variant = data.get("item", {})
	return hero_item is Dictionary and (
		_accepted_hero_id.is_empty()
		or String((hero_item as Dictionary).get("hero_id", "")).strip_edges().to_lower()
			== _accepted_hero_id
	)


func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	return can_accept_payload(data)


func _drop_data(_at_position: Vector2, data: Variant) -> void:
	if not can_accept_payload(data):
		return
	item_dropped.emit(_slot_id, (data as Dictionary).duplicate(true))


func _slot_badge(slot_id: StringName) -> String:
	match slot_id:
		&"hero_weapon": return "W"
		&"armor": return "A"
		&"boots": return "B"
		&"jewelry": return "J"
		_: return ""


func _tooltip_text(
		title: String,
		item_display_name: String,
		rarity_display_name: String,
		locked_hint: String,
) -> String:
	if not _unlocked:
		return (
			"%s — mở ở cấp %s" % [title, locked_hint]
			if not locked_hint.is_empty()
			else "%s — chưa mở" % title
		)
	if _item.is_empty():
		return "%s — kéo vật phẩm tương thích vào đây" % title
	return "%s • %s (%s) — nhấn để xem chi tiết" % [
		title,
		item_display_name,
		rarity_display_name.capitalize(),
	]


func _apply_rarity_visual(rarity: Variant, is_empty_or_locked: bool) -> void:
	_stop_rarity_effect()
	var normalized_rarity := RarityPalette.normalize(rarity)
	var rarity_index := RarityPalette.index(normalized_rarity)
	var border_color := (
		EMPTY_BORDER_COLOR
		if is_empty_or_locked
		else RarityPalette.color(normalized_rarity)
	)
	border_color.a = 0.28 if is_empty_or_locked else minf(1.0, 0.78 + rarity_index * 0.035)
	rarity_border.visible = not is_empty_or_locked
	_set_rarity_tint(rarity_border, border_color)
	rarity_border.modulate = Color.WHITE
	rarity_glow.visible = not is_empty_or_locked and rarity_index > 0
	var is_pulsing := not is_empty_or_locked and rarity_index >= LEGENDARY_RARITY_INDEX
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
		"is_empty": is_empty_or_locked,
		"is_pulsing": is_pulsing,
		"border_color": border_color,
		"glow_alpha": glow_alpha,
	}


func _start_rarity_pulse(rarity: StringName, rarity_index: int) -> void:
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

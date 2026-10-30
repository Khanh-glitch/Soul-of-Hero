class_name ProgressionFocusHud
extends Control

const ENEMY_DISPLAY_NAMES := {
	"skeleton": "CHIẾN BINH XƯƠNG",
	"skeleton_reaper": "TỬ THẦN XƯƠNG",
	"reaper": "TỬ THẦN XƯƠNG",
	"bone_reaper_captain": "ĐỘI TRƯỞNG TỬ THẦN",
	"captain": "ĐỘI TRƯỞNG TỬ THẦN",
	"vampire": "MA CÀ RỒNG",
	"crimson_reaper": "TỬ THẦN HUYẾT SẮC",
	"vampire_castellan": "THÀNH CHỦ MA CÀ RỒNG",
}
const HERO_DISPLAY_NAMES := {
	"sword_hero": "KIẾM SĨ",
	"archer_hero": "CUNG THỦ",
	"axe_hero": "CHIẾN BINH RÌU",
	"wizard_hero": "PHÁP SƯ",
}

signal codex_requested()

# The target's health bar is health, not rarity. It used to take Rarity.color(),
# and normal rarity is near-white (#e8edf2): the fill texture is a flat #e5b67f
# strip, so a normal enemy's bar came out as a featureless sand band across the
# top of the screen - the flat beige rectangle in every fight frame. Rarity keeps
# the name above the bar, which is where it can actually be read; the bar runs from
# the chapter's ember to a deep dried red as the target is worn down.
const FOCUS_HEALTH_FULL := Color(0.88, 0.27, 0.21)
const FOCUS_HEALTH_LOW := Color(0.44, 0.07, 0.10)

const Rarity := preload("res://game/ui/rarity_palette.gd")
const XpPopupScene: PackedScene = preload("res://game/ui/xp_gain_popup.tscn")
const Vfx := preload("res://game/vfx/vfx_catalog.gd")

@onready var focus_panel: Control = %FocusPanel
@onready var focus_name: Label = %FocusName
@onready var focus_health: TextureProgressBar = %FocusHealth
@onready var focus_health_value: Label = %FocusHealthValue
@onready var pickup_prompt: HBoxContainer = %PickupPrompt
@onready var xp_bar: TextureProgressBar = %XpBar
@onready var xp_value: Label = %XpValue
@onready var level_value: Label = %LevelValue
@onready var xp_popup_origin: Control = %XpPopupOrigin
@onready var level_up_banner: Control = %LevelUpBanner
@onready var level_up_label: Label = %LevelUpLabel
@onready var level_up_sfx: AudioStreamPlayer = %LevelUpSfx
@onready var codex_button: Button = %CodexButton

var _player: Node2D
var _combat_target: Node2D
var _combat_target_until_msec := 0
var _loot_focus: Node
var _loot_name := ""
var _loot_rarity := &"normal"
var _loot_can_pickup := false
var _focus_poll_left := 0.0
var _popup_serial := 0
var _xp_tween: Tween
var _event_bus: Node
var _displayed_hero_id := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	focus_panel.hide()
	level_up_banner.hide()
	codex_button.pressed.connect(func() -> void: codex_requested.emit())
	_connect_event_bus()
	_sync_progression_snapshot()


func _exit_tree() -> void:
	if not is_instance_valid(_event_bus):
		return
	for binding: Array in [
		[&"hero_experience_changed", Callable(self, "_on_hero_experience_changed")],
		[&"hero_level_changed", Callable(self, "_on_hero_level_changed")],
		[&"loot_focus_changed", Callable(self, "_on_loot_focus_changed")],
		[&"combat_hit_confirmed", Callable(self, "_on_combat_hit_confirmed")],
	]:
		var signal_name := binding[0] as StringName
		var callback := binding[1] as Callable
		if _event_bus.is_connected(signal_name, callback):
			_event_bus.disconnect(signal_name, callback)
	_event_bus = null


func set_player(player: Node) -> void:
	_player = player as Node2D
	_sync_progression_snapshot()


func _process(delta: float) -> void:
	_focus_poll_left -= delta
	if _focus_poll_left > 0.0:
		return
	_focus_poll_left = 0.10
	if not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group(&"player") as Node2D
	var active_hero_id := _active_hero_id()
	if not active_hero_id.is_empty() and active_hero_id != _displayed_hero_id:
		_sync_progression_snapshot()
	_refresh_focus()


func _connect_event_bus() -> void:
	var bus := get_node_or_null("/root/GameEvents")
	if bus == null:
		return
	_event_bus = bus
	_connect_once(bus, &"hero_experience_changed", Callable(self, "_on_hero_experience_changed"))
	_connect_once(bus, &"hero_level_changed", Callable(self, "_on_hero_level_changed"))
	_connect_once(bus, &"loot_focus_changed", Callable(self, "_on_loot_focus_changed"))
	_connect_once(bus, &"combat_hit_confirmed", Callable(self, "_on_combat_hit_confirmed"))


func _connect_once(source: Object, signal_name: StringName, callback: Callable) -> void:
	if source.has_signal(signal_name) and not source.is_connected(signal_name, callback):
		source.connect(signal_name, callback)


func _sync_progression_snapshot() -> void:
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"get_hero_progression_snapshot"):
		_update_xp(1, 0, 1, 0, false)
		return
	var hero_id := _active_hero_id()
	if hero_id.is_empty():
		hero_id = "sword_hero"
	_displayed_hero_id = hero_id
	var snapshot: Variant = save.call(&"get_hero_progression_snapshot", StringName(hero_id))
	if not snapshot is Dictionary:
		return
	var data := snapshot as Dictionary
	var level := maxi(1, int(data.get("level", 1)))
	var current := maxi(0, int(data.get("xp", 0)))
	var required := maxi(0, int(data.get("xp_required", 0)))
	if required <= 0 and level < 100:
		required = _fallback_required_xp(level)
	_update_xp(level, current, required, 0, false)


func _fallback_required_xp(level: int) -> int:
	# Presentation-only compatibility while loading a save made before the XP
	# curve existed. The authoritative progression service supplies this value.
	return 80 + maxi(0, level - 1) * 24


func _on_hero_experience_changed(
		hero_id: StringName,
		current: int,
		required: int,
		gained: int,
) -> void:
	if String(hero_id) != _active_hero_id():
		return
	_displayed_hero_id = String(hero_id)
	_update_xp(int(level_value.get_meta(&"level", 1)), current, required, gained, true)


func _on_hero_level_changed(hero_id: StringName, level: int, levels_gained: int) -> void:
	if String(hero_id) != _active_hero_id():
		return
	level = maxi(1, level)
	level_value.set_meta(&"level", level)
	level_value.text = "CẤP %d" % level
	_play_level_up(level, maxi(1, levels_gained))
	# The level event may arrive after the rollover XP event. Refreshing from the
	# durable snapshot guarantees the label/bar show the new bucket.
	_sync_progression_snapshot()


# Compatibility entry points for older UI probes. Production connections use
# the Hero-scoped signals above, so account XP can never overwrite the active
# Hero bar during play.
func _on_experience_changed(current: int, required: int, gained: int) -> void:
	_update_xp(int(level_value.get_meta(&"level", 1)), current, required, gained, true)


func _on_level_changed(level: int, levels_gained: int) -> void:
	level = maxi(1, level)
	level_value.set_meta(&"level", level)
	_play_level_up(level, maxi(1, levels_gained))


func _active_hero_id() -> String:
	if is_instance_valid(_player):
		var manager: Variant = _player.get("hero_soul_manager")
		if manager is Object:
			var active: Variant = (manager as Object).get("active_hero")
			if active is HeroDefinition:
				return String((active as HeroDefinition).hero_id)
	var save := get_node_or_null("/root/SaveService")
	if save != null and save.has_method(&"get_snapshot"):
		var snapshot: Dictionary = save.call(&"get_snapshot")
		var team: Dictionary = snapshot.get("soul_team", {}) \
			if snapshot.get("soul_team", {}) is Dictionary else {}
		return String(team.get("active_hero", "sword_hero"))
	return _displayed_hero_id


func _update_xp(
		level: int,
		current: int,
		required: int,
		gained: int,
		animate: bool
) -> void:
	level = maxi(1, level)
	current = maxi(0, current)
	required = maxi(0, required)
	level_value.set_meta(&"level", level)
	level_value.text = "%s • CẤP %d" % [
		String(HERO_DISPLAY_NAMES.get(_displayed_hero_id, "HERO")),
		level,
	]
	var maximum := maxi(1, required)
	var target_value := float(maximum if required <= 0 else mini(current, maximum))
	xp_bar.max_value = maximum
	if is_instance_valid(_xp_tween):
		_xp_tween.kill()
	if animate:
		_xp_tween = create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
		_xp_tween.tween_property(xp_bar, "value", target_value, 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	else:
		xp_bar.value = target_value
	xp_value.text = "TỐI ĐA" if required <= 0 else "%d / %d XP" % [mini(current, maximum), maximum]
	if gained > 0:
		_spawn_xp_popup(gained)


func _spawn_xp_popup(gained: int) -> void:
	var popup := XpPopupScene.instantiate() as XpGainPopup
	if popup == null:
		return
	xp_popup_origin.add_child(popup)
	popup.position = Vector2(-37.0, -4.0)
	popup.configure(gained, _popup_serial)
	_popup_serial += 1


func _play_level_up(level: int, levels_gained: int) -> void:
	level_up_label.text = "LÊN CẤP!  •  CẤP %d" % level
	if levels_gained > 1:
		level_up_label.text += "  (+%d)" % levels_gained
	level_up_banner.show()
	level_up_banner.modulate = Color(1, 1, 1, 0)
	level_up_banner.scale = Vector2.ONE * 0.72
	level_up_banner.pivot_offset = level_up_banner.size * 0.5
	var tween := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	tween.tween_property(level_up_banner, "modulate:a", 1.0, 0.10)
	tween.parallel().tween_property(level_up_banner, "scale", Vector2.ONE * 1.08, 0.20).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_interval(0.58)
	tween.tween_property(level_up_banner, "modulate:a", 0.0, 0.24)
	tween.tween_callback(level_up_banner.hide)
	level_up_sfx.play()
	_spawn_level_up_vfx()


func _spawn_level_up_vfx() -> void:
	if not is_instance_valid(_player):
		return
	var parent := _player.get_parent()
	if parent == null:
		return
	var center := _player.global_position + Vector2(0, -15)
	Vfx.spawn(parent, &"world_sparkle", center, 0.0, 1.45, Color("fff08a"), 180)
	Vfx.spawn(parent, &"world_sparkle", center + Vector2(-15, 5), -0.3, 1.0, Color("ffad45"), 179)
	Vfx.spawn(parent, &"world_sparkle", center + Vector2(15, 5), 0.3, 1.0, Color("fff4c2"), 179)


func _on_combat_hit_confirmed(
		target: Node,
		_actual_amount: int,
		_world_position: Vector2,
		_context: Dictionary
) -> void:
	if target is Node2D and target.is_in_group(&"enemies"):
		_combat_target = target as Node2D
		_combat_target_until_msec = Time.get_ticks_msec() + 2800


func _on_loot_focus_changed(
		loot: Node,
		display_name: String,
		rarity: StringName,
		can_pickup: bool
) -> void:
	_loot_focus = loot
	_loot_name = display_name.strip_edges()
	_loot_rarity = Rarity.normalize(rarity)
	_loot_can_pickup = can_pickup
	_refresh_focus()


func _refresh_focus() -> void:
	if is_instance_valid(_loot_focus) and not _loot_name.is_empty():
		_present_loot_focus()
		return
	_loot_focus = null
	var target := _resolve_enemy_focus()
	if is_instance_valid(target):
		_present_enemy_focus(target)
	else:
		focus_panel.hide()


func _resolve_enemy_focus() -> Node2D:
	if is_instance_valid(_combat_target) and Time.get_ticks_msec() <= _combat_target_until_msec:
		return _combat_target
	_combat_target = null
	if not is_instance_valid(_player):
		return null
	var nearest: Node2D
	var nearest_distance_squared := 260.0 * 260.0
	for raw_enemy: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not raw_enemy is Node2D or raw_enemy.is_queued_for_deletion():
			continue
		var enemy := raw_enemy as Node2D
		var health := _numeric_property(enemy, &"health", 0.0)
		if health <= 0.0:
			continue
		var distance_squared := _player.global_position.distance_squared_to(enemy.global_position)
		if distance_squared < nearest_distance_squared:
			nearest = enemy
			nearest_distance_squared = distance_squared
	return nearest


func _present_enemy_focus(enemy: Node2D) -> void:
	var rarity: Variant = enemy.get_meta(
		&"loot_rarity",
		enemy.get_meta(&"rarity_id", enemy.get_meta(&"rarity", &"normal"))
	)
	var color := Rarity.color(rarity)
	focus_name.text = "%s (Cấp %d)" % [_enemy_display_name(enemy), _enemy_level(enemy)]
	focus_name.add_theme_color_override(&"font_color", color)
	var maximum := maxi(1, roundi(_numeric_property(enemy, &"max_health", 1.0)))
	var current := clampi(roundi(_numeric_property(enemy, &"health", float(maximum))), 0, maximum)
	focus_health.max_value = maximum
	focus_health.value = current
	focus_health.tint_progress = FOCUS_HEALTH_FULL.lerp(
		FOCUS_HEALTH_LOW, 1.0 - float(current) / float(maximum)
	)
	focus_health_value.text = "%d / %d" % [current, maximum]
	focus_health.show()
	focus_health_value.show()
	pickup_prompt.hide()
	focus_panel.show()


func _present_loot_focus() -> void:
	var color := Rarity.color(_loot_rarity)
	focus_name.text = "%s • %s" % [_loot_name, Rarity.display_name(_loot_rarity)]
	focus_name.add_theme_color_override(&"font_color", color)
	focus_health.hide()
	focus_health_value.hide()
	pickup_prompt.visible = _loot_can_pickup
	focus_panel.show()


func _enemy_display_name(enemy: Node) -> String:
	# Authored entity identity is more precise than the shared enemy scene/class
	# (captains and bosses deliberately reuse those controllers).
	var entity_type := String(enemy.get_meta(&"level_entity_type", "")).strip_edges().to_lower()
	if ENEMY_DISPLAY_NAMES.has(entity_type):
		return String(ENEMY_DISPLAY_NAMES[entity_type])
	if enemy.has_method(&"get_display_name"):
		var value := String(enemy.call(&"get_display_name")).strip_edges()
		if not value.is_empty():
			return value.to_upper()
	var metadata := String(enemy.get_meta(&"display_name", "")).strip_edges()
	if not metadata.is_empty():
		return metadata.to_upper()
	if enemy is SkeletonEnemy:
		return "CHIẾN BINH XƯƠNG"
	if enemy is AdvancedDungeonEnemy:
		return "TỬ THẦN XƯƠNG" if (enemy as AdvancedDungeonEnemy).get_archetype_id() == &"bone_reaper" else "HÚT MÁU ĐỎ"
	return String(enemy.name).replace("_", " ").to_upper()


func _enemy_level(enemy: Node) -> int:
	for metadata_key: StringName in [&"enemy_level", &"stage_level", &"level"]:
		if not enemy.has_meta(metadata_key):
			continue
		var value: Variant = enemy.get_meta(metadata_key)
		if value is int or value is float:
			return clampi(int(value), 1, 100)
	var session := get_node_or_null("/root/GameSession")
	if session != null:
		var value: Variant = session.get("active_stage_level")
		if value is int or value is float:
			return clampi(int(value), 1, 100)
	return 1


func _numeric_property(object: Object, property_name: StringName, fallback: float) -> float:
	if not is_instance_valid(object):
		return fallback
	for descriptor: Dictionary in object.get_property_list():
		if StringName(descriptor.get("name", &"")) != property_name:
			continue
		var value: Variant = object.get(property_name)
		return float(value) if value is int or value is float else fallback
	return fallback

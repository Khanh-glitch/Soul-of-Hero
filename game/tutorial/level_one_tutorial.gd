class_name LevelOneTutorial
extends CanvasLayer

const ORDER: Array[StringName] = [
	&"movement",
	&"dash",
	&"sword_combo",
	&"passing_slash",
	&"crescent_recoil",
	&"pursuit_execution",
	&"soul_echo",
]

const SUPPORTED_CONTENT_LEVEL_IDS: Array[StringName] = [
	&"chapter_1_level_1",
	&"crypt_entrance_sandbox",
]

const COMBO_TUTORIAL_STEPS := {
	1: &"sword_combo",
	2: &"passing_slash",
	3: &"crescent_recoil",
	4: &"pursuit_execution",
}

const COPY := {
	&"movement": "DI CHUYỂN  •  WASD / JOYSTICK  •  8 HƯỚNG",
	&"dash": "LƯỚT  •  F  •  TIÊU HAO 11 MANA",
	&"sword_combo": "KIẾM NHỊP 1/4 • J / CHUỘT TRÁI • CHÉM MỞ",
	&"passing_slash": "KIẾM NHỊP 2/4 • NỐI TRONG 2 GIÂY • LƯỚT CHÉM",
	&"crescent_recoil": "KIẾM NHỊP 3/4 • SÓNG KIẾM + GIẬT LÙI",
	&"pursuit_execution": "KIẾM NHỊP 4/4 • LAO XUYÊN MỤC TIÊU",
	&"soul_echo": "KỸ NĂNG • E • LINH HỒN CHIẾN BINH",
}

const PROMPT_REGIONS := {
	&"movement": Rect2(288, 32, 16, 16), # W
	&"dash": Rect2(320, 48, 16, 16), # F
	&"sword_combo": Rect2(384, 48, 16, 16), # J
	&"passing_slash": Rect2(384, 48, 16, 16),
	&"crescent_recoil": Rect2(384, 48, 16, 16),
	&"pursuit_execution": Rect2(384, 48, 16, 16),
	&"soul_echo": Rect2(304, 32, 16, 16), # E
}

@onready var panel: PanelContainer = %TutorialPanel
@onready var prompt: TextureRect = %TutorialPrompt
@onready var label: Label = %TutorialLabel

var _player: Node2D
var _movement_origin := Vector2.ZERO
var _active_step: StringName = &""


func _ready() -> void:
	if not _supports_active_run():
		panel.hide()
		set_process(false)
		return
	GameEvents.player_registered.connect(_on_player_registered)
	GameEvents.dash_started.connect(_on_dash_started)
	GameEvents.combat_hit_confirmed.connect(_on_combat_hit_confirmed)
	_refresh_step()


func _supports_active_run() -> bool:
	var app_flow := get_node_or_null("/root/AppFlow")
	if app_flow == null or not app_flow.has_method(&"get_active_run"):
		return true
	var active_run: Dictionary = app_flow.call(&"get_active_run")
	# An empty run is how the gameplay scene is opened directly from the editor
	# and by several focused runtime tests. Preserve tutorial coverage there.
	if active_run.is_empty():
		return true
	var content_level_id := StringName(active_run.get("content_level_id", active_run.get("level_id", &"")))
	return content_level_id in SUPPORTED_CONTENT_LEVEL_IDS


func _process(_delta: float) -> void:
	if _active_step == &"movement" and is_instance_valid(_player):
		if _player.global_position.distance_to(_movement_origin) >= 28.0:
			_complete(&"movement")


func _on_player_registered(player: Node) -> void:
	_player = player as Node2D
	if _player != null:
		_movement_origin = _player.global_position


func _on_dash_started(_direction: Vector2) -> void:
	if _active_step == &"dash":
		_complete(&"dash")


func _on_combat_hit_confirmed(
	_target: Node,
	actual_amount: int,
	_world_position: Vector2,
	context: Dictionary,
) -> void:
	if actual_amount <= 0 or StringName(context.get("hero_id", &"")) != &"sword_hero":
		return
	if _active_step == &"soul_echo":
		if bool(context.get("is_echo", false)):
			_complete(&"soul_echo")
		return
	var tutorial_step := COMBO_TUTORIAL_STEPS.get(
		int(context.get("combo_step", 0)),
		&"",
	) as StringName
	if tutorial_step == _active_step:
		_complete(tutorial_step)


func _complete(step: StringName) -> void:
	if step != _active_step:
		return
	SaveService.set_tutorial_completed(step, "tutorial:level1:%s" % step)
	RealtimeBridge.publish_event("tutorial_completed", {"step": String(step)})
	_refresh_step()


func _refresh_step() -> void:
	var tutorials: Dictionary = SaveService.get_snapshot().get("tutorials", {})
	_active_step = &""
	var active_index := -1
	for index: int in ORDER.size():
		var step := ORDER[index]
		if not bool(tutorials.get(String(step), false)):
			_active_step = step
			active_index = index
			break
	panel.visible = not _active_step.is_empty()
	if panel.visible:
		label.text = "[%d/%d]  %s" % [active_index + 1, ORDER.size(), String(COPY.get(_active_step, ""))]
		_apply_prompt(_active_step)


func _apply_prompt(step: StringName) -> void:
	var current := prompt.texture as AtlasTexture
	if current == null:
		prompt.hide()
		return
	var next_prompt := AtlasTexture.new()
	next_prompt.atlas = current.atlas
	next_prompt.region = PROMPT_REGIONS.get(step, Rect2(384, 48, 16, 16))
	prompt.texture = next_prompt
	prompt.custom_minimum_size.x = 36.0 if step == &"dash" else 18.0
	prompt.show()

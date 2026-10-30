extends Node

## Automatically skins the whole application shell with the curated UI cues.
## Buttons created later by routed screens are picked up through `node_added`.

const UI_ROOT := "res://assets/audio/sfx/rpg_essentials/"
const HOVER_STREAM := preload(UI_ROOT + "ui_hover.wav")
const CONFIRM_STREAM := preload(UI_ROOT + "ui_confirm.wav")
const CANCEL_STREAM := preload(UI_ROOT + "ui_cancel.wav")
const DENIED_STREAM := preload(UI_ROOT + "ui_denied.wav")

const CANCEL_TOKENS: PackedStringArray = [
	"back", "return", "cancel", "close", "quit", "decline", "exit",
	"quay", "tro_lai", "dong", "thoat", "huy",
]

@export var playback_enabled := true
@export_range(-30.0, -3.0, 0.5) var hover_volume_db := -22.0
@export_range(-30.0, -3.0, 0.5) var action_volume_db := -16.0

var _hover_player: AudioStreamPlayer
var _action_player: AudioStreamPlayer
var _last_hover_msec := -1000


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_hover_player = _create_player("HoverVoice")
	_action_player = _create_player("ActionVoice")
	get_tree().node_added.connect(_on_node_added)
	call_deferred("_bind_existing_controls")


func _create_player(player_name: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.name = player_name
	player.bus = &"UI"
	player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(player)
	return player


func _bind_existing_controls() -> void:
	_bind_branch(get_tree().root)


func _bind_branch(node: Node) -> void:
	_bind_control(node)
	for child: Node in node.get_children():
		_bind_branch(child)


func _on_node_added(node: Node) -> void:
	call_deferred("_bind_control", node)


func _bind_control(node: Variant) -> void:
	# Routed screens can be replaced before this deferred call runs. Accept a
	# Variant so a freed node arrives as null instead of causing a typed-call
	# conversion error during fast route changes and test teardown.
	if not is_instance_valid(node) or not node is BaseButton or node.has_meta(&"asset_ui_audio_bound"):
		return
	var button := node as BaseButton
	button.set_meta(&"asset_ui_audio_bound", true)
	button.mouse_entered.connect(_on_button_hover.bind(button))
	button.focus_entered.connect(_on_button_hover.bind(button))
	button.pressed.connect(_on_button_pressed.bind(button))


func _on_button_hover(button: BaseButton) -> void:
	if not playback_enabled or not is_instance_valid(button):
		return
	var now := Time.get_ticks_msec()
	if now - _last_hover_msec < 70:
		return
	_last_hover_msec = now
	if button.disabled:
		_play(_action_player, DENIED_STREAM, action_volume_db)
	else:
		_play(_hover_player, HOVER_STREAM, hover_volume_db)


func _on_button_pressed(button: BaseButton) -> void:
	if not playback_enabled or not is_instance_valid(button):
		return
	var stream: AudioStream = CANCEL_STREAM if _is_cancel_action(button) else CONFIRM_STREAM
	_play(_action_player, stream, action_volume_db)


func _is_cancel_action(button: BaseButton) -> bool:
	var identity := String(button.name).to_snake_case()
	if button is Button:
		identity += "_" + (button as Button).text.to_snake_case()
	for token: String in CANCEL_TOKENS:
		if identity.contains(token):
			return true
	return false


func _play(player: AudioStreamPlayer, stream: AudioStream, volume_db: float) -> void:
	# Dummy audio cannot be heard, even with a visible display (for example
	# Xvfb). Starting a voice there can retain playback resources at shutdown.
	# Real audio drivers still receive the same cues on desktop and Web.
	if AudioServer.get_driver_name() == "Dummy" or not is_instance_valid(player) or stream == null:
		return
	player.stop()
	player.stream = stream
	player.volume_db = volume_db
	player.pitch_scale = 1.0
	player.play()

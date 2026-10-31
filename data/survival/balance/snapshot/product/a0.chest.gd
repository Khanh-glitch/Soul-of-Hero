class_name RewardChest
extends Area2D

signal opened(score_reward: int, contained_sigil: bool)

const CHEST_VISUAL_CATALOG := preload(
	"res://game/world/interactables/chest_visual_catalog.gd"
)
const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const VfxCatalog := preload("res://game/vfx/vfx_catalog.gd")

@export_range(0, 9999, 1) var score_reward: int = 150
@export var contains_sigil := false:
	set(value):
		contains_sigil = value
		_refresh_visual_if_ready()
		_request_source_reconfiguration()
@export_enum("Automatic:auto", "Regular:regular", "Monster:monster") \
	var chest_family := "auto":
	set(value):
		chest_family = String(value).strip_edges().to_lower()
		_refresh_visual_if_ready()
		_request_source_reconfiguration()
@export var guaranteed_jackpot := false:
	set(value):
		guaranteed_jackpot = value
		_refresh_visual_if_ready()
		_request_source_reconfiguration()
@export var interaction_message := "Nhấn chuột trái để mở rương"
@export_enum(
	"Random:random", "Normal:normal", "Magic:magic", "Rare:rare", "Epic:epic",
	"Legendary:legendary", "Crystal:crystal", "Mythic:mythic", "Eternal:eternal",
) var rarity_override := "random"

@onready var animated_sprite: AnimatedSprite2D = %AnimatedSprite2D
@onready var collision_shape: CollisionShape2D = %CollisionShape2D

var _nearby_player: Node2D
var _is_open := false
var _interaction_locked := false
var _locked_message := "Defeat the branch guardians before claiming this chest."
var _open_authority: Callable
var _loot_rarity: StringName = &"normal"
var _visual_entry: Dictionary = {}


func _ready() -> void:
	add_to_group(&"player_interactable")
	add_to_group(&"loot_chests")
	_refresh_visual_if_ready()
	animated_sprite.animation_finished.connect(_on_animation_finished)
	animated_sprite.play(&"closed")
	var director := get_node_or_null("/root/LootDirector")
	if director != null and director.has_method(&"configure_world_source"):
		director.call(&"configure_world_source", self, &"chest")


func can_interact(player: Node2D) -> bool:
	return not _is_open and not _interaction_locked and is_instance_valid(player) \
		and player == _nearby_player


func interact(player: Node2D) -> bool:
	if _interaction_locked and is_instance_valid(player) and player == _nearby_player:
		_emit_toast(_locked_message)
		return true
	if not can_interact(player):
		return false
	# A special encounter may require its canonical event to commit before this
	# physical chest grants score/sigil or changes to the open state.
	if _open_authority.is_valid() \
			and not bool(_open_authority.call(score_reward, contains_sigil, self)):
		_emit_toast("The chest seal held. Try again.")
		return true
	_open()
	return true


func set_open_authority(authority: Callable) -> void:
	_open_authority = authority


func set_interaction_locked(value: bool, reason: String = "") -> void:
	_interaction_locked = value
	if not reason.strip_edges().is_empty():
		_locked_message = reason
	if _interaction_locked and is_instance_valid(_nearby_player):
		_emit_toast(_locked_message)


func is_interaction_locked() -> bool:
	return _interaction_locked


func is_open() -> bool:
	return _is_open


func set_loot_rarity(value: Variant) -> void:
	_loot_rarity = RARITY_PALETTE.normalize(value)
	_refresh_visual_if_ready()


func get_loot_rarity() -> StringName:
	return _loot_rarity


func set_chest_family(value: Variant) -> void:
	chest_family = String(value)


func get_chest_family() -> StringName:
	return CHEST_VISUAL_CATALOG.resolve_family(chest_family, contains_sigil)


func set_guaranteed_jackpot(value: bool) -> void:
	guaranteed_jackpot = value


func is_guaranteed_jackpot() -> bool:
	return guaranteed_jackpot


func get_minimum_loot_rarity() -> StringName:
	if guaranteed_jackpot:
		return &"eternal"
	return &"rare" if get_chest_family() == CHEST_VISUAL_CATALOG.FAMILY_MONSTER \
		else &"normal"


func get_visual_entry() -> Dictionary:
	return _resolve_visual_entry().duplicate(true)


func get_display_name() -> String:
	return String(_resolve_visual_entry().get("display_name", "Rương Kho Báu"))


func get_target_payload() -> Dictionary:
	var entry := _resolve_visual_entry()
	return {
		"node": self,
		"kind": &"chest",
		"role": &"chest",
		"chest_family": get_chest_family(),
		"display_name": String(entry.get("display_name", "Rương Kho Báu")),
		"rarity": _loot_rarity,
		"rarity_name": RARITY_PALETTE.display_name(_loot_rarity),
		"rarity_color": RARITY_PALETTE.color(_loot_rarity),
		"visual_id": StringName(entry.get("id", &"")),
		"visual_tier": int(entry.get("tier", 1)),
		"guaranteed_jackpot": guaranteed_jackpot,
		"can_interact": not _is_open and not _interaction_locked,
	}


func _on_body_entered(body: Node2D) -> void:
	if _is_open or not body.is_in_group(&"player"):
		return
	_nearby_player = body
	_emit_toast(_locked_message if _interaction_locked else interaction_message)


func _on_body_exited(body: Node2D) -> void:
	if body == _nearby_player:
		_nearby_player = null


func _open() -> void:
	if _is_open:
		return
	_is_open = true
	var session := get_node_or_null("/root/GameSession")
	if session != null:
		if session.has_method(&"add_score"):
			session.call(&"add_score", score_reward)
		if contains_sigil and session.has_method(&"collect_sigil"):
			session.call(&"collect_sigil")
	VfxCatalog.spawn(
		get_parent(),
		&"world_sparkle",
		global_position + Vector2(0.0, -17.0),
		0.0,
		1.15,
		Color(1.0, 0.78, 0.24, 0.90),
		7,
	)
	VfxCatalog.spawn(
		get_parent(),
		&"smoke_puff",
		global_position + Vector2(0.0, -12.0),
		-PI * 0.5,
		0.62,
		Color(0.82, 0.72, 0.54, 0.38),
		6,
	)
	var entry := _resolve_visual_entry()
	_emit_combat_cue(&"chest_open", global_position, {
		"source": &"reward_chest",
		"material": StringName(entry.get("material", &"wood")),
		"family": get_chest_family(),
		"rarity": _loot_rarity,
	})
	var director := get_node_or_null("/root/LootDirector")
	if director != null and director.has_method(&"spawn_chest_burst"):
		if guaranteed_jackpot:
			director.call(&"spawn_chest_burst", self, true)
		else:
			director.call(&"spawn_chest_burst", self)
	opened.emit(score_reward, contains_sigil)
	_emit_toast(
		"Bạn tìm thấy ấn ký và %d điểm!" % score_reward
		if contains_sigil
		else "Bạn nhận được %d điểm!" % score_reward
	)
	animated_sprite.play(&"opening")
	collision_shape.set_deferred(&"disabled", true)


func _on_animation_finished() -> void:
	if animated_sprite.animation == &"opening":
		animated_sprite.play(&"open")


func _resolve_visual_entry() -> Dictionary:
	return CHEST_VISUAL_CATALOG.entry_for(
		_loot_rarity,
		get_chest_family(),
		guaranteed_jackpot,
	)


func _refresh_visual_if_ready() -> void:
	if not is_instance_valid(animated_sprite):
		return
	var next_entry := _resolve_visual_entry()
	if next_entry.is_empty():
		return
	var next_id := StringName(next_entry.get("id", &""))
	if StringName(_visual_entry.get("id", &"")) == next_id \
			and animated_sprite.sprite_frames != null:
		return
	_visual_entry = next_entry
	animated_sprite.sprite_frames = CHEST_VISUAL_CATALOG.make_sprite_frames(_visual_entry)
	animated_sprite.play(&"open" if _is_open else &"closed")


func _emit_toast(message: String) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal(&"toast_requested", message)


func _emit_combat_cue(cue_id: StringName, position: Vector2, payload: Dictionary) -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null:
		events.emit_signal(&"combat_cue_requested", cue_id, position, payload)


func _request_source_reconfiguration() -> void:
	if not is_inside_tree() or not is_node_ready():
		return
	var director := get_node_or_null("/root/LootDirector")
	if director != null and director.has_method(&"configure_world_source"):
		director.call_deferred(&"configure_world_source", self, &"chest")

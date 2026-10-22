extends Node

const DEFAULT_REQUIRED_SIGILS := 3
const DIFFICULTY_RULES := preload("res://game/meta/progression/difficulty_rules.gd")

var score := 0
var sigils := 0
var required_sigils := DEFAULT_REQUIRED_SIGILS
var checkpoint := Vector2(104.0, 104.0)
var objective_finished := false
var encounter_enemy_total := 0
var encounter_enemy_defeated := 0
var encounter_objective_cleared := true
var active_run_id := ""
var active_level_id: StringName = &""
var active_stage_level := 1
var active_difficulty: StringName = DIFFICULTY_RULES.DEFAULT_DIFFICULTY
var _difficulty_modifiers: Dictionary = DIFFICULTY_RULES.stage_modifiers(1, active_difficulty)


func configure_run(
		run_id: String,
		level_id: StringName,
		stage_level: int,
		difficulty_id: StringName = DIFFICULTY_RULES.DEFAULT_DIFFICULTY,
) -> void:
	active_run_id = run_id.strip_edges()
	active_level_id = level_id
	active_stage_level = clampi(stage_level, 1, 100)
	active_difficulty = DIFFICULTY_RULES.normalize_id(difficulty_id)
	_difficulty_modifiers = DIFFICULTY_RULES.stage_modifiers(
		active_stage_level,
		active_difficulty,
	)


func get_active_difficulty() -> StringName:
	return active_difficulty


func get_difficulty_modifiers() -> Dictionary:
	return _difficulty_modifiers.duplicate(true)


func get_run_configuration() -> Dictionary:
	return {
		"run_id": active_run_id,
		"level_id": active_level_id,
		"stage_level": active_stage_level,
		"difficulty": active_difficulty,
		"modifiers": get_difficulty_modifiers(),
	}


func reset_run() -> void:
	score = 0
	sigils = 0
	checkpoint = Vector2(104.0, 104.0)
	objective_finished = false
	encounter_enemy_total = 0
	encounter_enemy_defeated = 0
	encounter_objective_cleared = true
	GameEvents.score_changed.emit(score)
	GameEvents.sigil_collected.emit(sigils, required_sigils)
	GameEvents.encounter_objective_changed.emit(0, 0, true)


func configure_objective(next_required_sigils: int) -> void:
	required_sigils = clampi(next_required_sigils, 1, 99)
	sigils = mini(sigils, required_sigils)
	GameEvents.sigil_collected.emit(sigils, required_sigils)


func add_score(amount: int) -> void:
	score = maxi(0, score + amount)
	GameEvents.score_changed.emit(score)


func configure_encounter_objective(total_enemies: int) -> void:
	encounter_enemy_total = maxi(0, total_enemies)
	encounter_enemy_defeated = 0
	encounter_objective_cleared = encounter_enemy_total == 0
	GameEvents.encounter_objective_changed.emit(
		encounter_enemy_defeated,
		encounter_enemy_total,
		encounter_objective_cleared,
	)


func update_encounter_objective(defeated: int, total: int, cleared: bool) -> void:
	encounter_enemy_total = maxi(0, total)
	encounter_enemy_defeated = clampi(defeated, 0, encounter_enemy_total)
	encounter_objective_cleared = cleared if encounter_enemy_total > 0 else true
	GameEvents.encounter_objective_changed.emit(
		encounter_enemy_defeated,
		encounter_enemy_total,
		encounter_objective_cleared,
	)


func collect_sigil() -> void:
	sigils = mini(required_sigils, sigils + 1)
	GameEvents.sigil_collected.emit(sigils, required_sigils)
	if sigils >= required_sigils:
		if encounter_objective_cleared:
			GameEvents.toast_requested.emit("Đủ %d ấn ký — cổng thoát đã mở!" % required_sigils)
		else:
			GameEvents.toast_requested.emit(
				"Đủ %d ấn ký — còn %d kẻ địch phải hạ." % [
					required_sigils,
					maxi(0, encounter_enemy_total - encounter_enemy_defeated),
				]
			)


func set_checkpoint(new_position: Vector2) -> void:
	checkpoint = new_position
	GameEvents.checkpoint_changed.emit(checkpoint)
	GameEvents.toast_requested.emit("Đã kích hoạt điểm hồi sinh")


func complete_objective() -> void:
	if objective_finished:
		return
	objective_finished = true
	GameEvents.objective_completed.emit()

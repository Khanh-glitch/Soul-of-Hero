class_name EnemyRuntimeConfigurator
extends RefCounted

## Single authority seam between catalog data and enemy controllers.
##
## Preferred order is instantiate_bound() -> add_child() -> difficulty/Elite.
## Binding before _ready() guarantees scene defaults cannot be captured as the
## authored damage base. apply_definition() also repairs provenance when called
## after add_child but before difficulty projection.

const DifficultyScaler := preload(
	"res://game/characters/enemies/enemy_difficulty_scaler.gd"
)

const DEFINITION_ID_META := &"enemy_definition_id"
const SNAPSHOT_META := &"enemy_runtime_snapshot"
const SNAPSHOT_DATA_META := &"enemy_runtime_snapshot_data"


static func instantiate_bound(definition: EnemyDefinition) -> Node:
	if definition == null or definition.base_scene == null:
		return null
	var enemy := definition.base_scene.instantiate()
	if enemy == null or not apply_definition(enemy, definition):
		if enemy != null:
			enemy.free()
		return null
	return enemy


static func apply_definition(enemy: Node, definition: EnemyDefinition) -> bool:
	if enemy == null or definition == null:
		return false
	if bool(enemy.get_meta(DifficultyScaler.APPLIED_META, false)):
		# Rebinding after stage projection would mix two bases. Fail closed.
		return false
	if not enemy.has_method(&"configure_from_definition"):
		return false
	var snapshot := definition.build_runtime_snapshot()
	if snapshot == null or not snapshot.is_valid():
		return false

	# Skeleton currently captures provenance from _ready(). Clearing first makes
	# the same seam safe for an already-added node that has not been scaled yet.
	enemy.remove_meta(DifficultyScaler.DAMAGE_PROVENANCE_META)
	var configured: Variant = enemy.call(&"configure_from_definition", snapshot)
	if not configured is bool or not bool(configured):
		return false

	enemy.set_meta(DEFINITION_ID_META, snapshot.enemy_id)
	enemy.set_meta(&"runtime_enemy_id", snapshot.enemy_id)
	enemy.set_meta(&"display_name", snapshot.display_name)
	enemy.set_meta(&"enemy_role_tags", snapshot.role_tags.duplicate())
	enemy.set_meta(&"enemy_layout_type_ids", snapshot.layout_type_ids.duplicate())
	enemy.set_meta(&"enemy_density_eligible", snapshot.density_eligible)
	enemy.set_meta(&"attack_behavior_id", snapshot.attack_behavior_id)
	enemy.set_meta(SNAPSHOT_META, snapshot)
	enemy.set_meta(SNAPSHOT_DATA_META, snapshot.to_dictionary())
	DifficultyScaler.capture_authored_damage_provenance(enemy)
	return true


static func get_bound_snapshot(enemy: Node) -> EnemyRuntimeSnapshot:
	if enemy == null:
		return null
	return enemy.get_meta(SNAPSHOT_META, null) as EnemyRuntimeSnapshot

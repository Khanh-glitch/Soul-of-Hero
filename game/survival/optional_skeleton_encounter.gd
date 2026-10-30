extends Node2D
## Experimental opt-in encounter seam, NOT mounted by the production world.
## One existing SkeletonEnemy, no kill bonus, no dungeon changes or new loot.
## Normal Hero damage score still applies; this seam is not production-ready.
## Caller must choose a shape/nav-validated site; configure fails closed if the
## area is near protected places, roads, existing structures or the current Hero.
## World reconstruction must explicitly reconfigure the same site and reserve it
## before player construction is enabled. This is not a released feature.

const RADIUS := 14
const MAX_LEASH := 160.0
const REARM_SECONDS := 60.0
const SAFE_SPAWN_DISTANCE := 320.0
const ENEMY_SCENE := "res://game/characters/enemies/skeleton_enemy.tscn"
## A hit can award the Hero's existing combat score even when score_reward is
## zero. Reserve the existing one-use receipt durably BEFORE exposing an enemy.
## This prevents hit/score effects on failed saves; it is deliberately
## conservative: a crash before the first hit can consume the encounter.
## Unmounted until fault, gameplay and fairness gates validate this tradeoff.
const CONSUMED_RECEIPT := "survival.encounter.optional_skeleton.first_hit.v1"

var _hero: CharacterBody2D
var _build: SurvivalBuildSystem
var _world: OverworldWorld
var _site := Vector2i(-1, -1)
var _reservation := Rect2i()
var _enemy: CharacterBody2D
var _save: Node
var _spent := false
# In this live session a reserved but not-yet-hit enemy may reappear after a
# retreat. On reload the durable receipt is spent, including pre-hit crashes.
var _reservation_active := false
var _cooldown := 0.0
var _configured := false

func configure(hero: CharacterBody2D, build: SurvivalBuildSystem, nav: OverworldTraversability, site: Vector2i) -> bool:
	if _configured or not is_inside_tree() or hero == null or build == null or nav == null or build.world == null:
		return false
	if get_parent().get_node_or_null("OptionalSkeletonEncounter") != self:
		return false
	var save := get_node_or_null("/root/SaveService")
	if save == null or not save.has_method(&"is_transaction_applied") or not save.has_method(&"transact_once"):
		return false
	var world := build.world
	var center := Vector2(site.x * 16 + 8, site.y * 16 + 15)
	if hero.global_position.distance_to(center) <= SAFE_SPAWN_DISTANCE or not nav.in_bounds(site):
		return false
	for endpoint: Dictionary in nav.endpoints(world.data):
		var protected: Vector2i = endpoint["cell"]
		if maxi(absi(site.x - protected.x), absi(site.y - protected.y)) <= RADIUS + 10:
			return false
	if build._near_shortcut(site, RADIUS + 10):
		return false
	var area := Rect2i(site - Vector2i(RADIUS, RADIUS), Vector2i(2 * RADIUS + 1, 2 * RADIUS + 1))
	if area.position.x < 0 or area.position.y < 0 or area.end.x > world.width or area.end.y > world.height:
		return false
	for y in range(area.position.y, area.end.y):
		for x in range(area.position.x, area.end.x):
			if build._on_route_detail(Vector2i(x, y)):
				return false
	for value: Variant in build._placed.values():
		var structure := value as SurvivalStructure
		if is_instance_valid(structure) and area.has_point(structure.cell):
			return false
	var reach := nav.reachable_from(nav.origin_cell())
	if reach[site.y * nav.width + site.x] < 0:
		return false
	var packed := load(ENEMY_SCENE) as PackedScene
	if packed == null:
		return false
	var probe := packed.instantiate() as CharacterBody2D
	if probe == null:
		return false
	var shape := probe.get_node_or_null("BodyCollision") as CollisionShape2D
	var query := PhysicsShapeQueryParameters2D.new()
	if shape == null or shape.shape == null:
		probe.free()
		return false
	query.shape = shape.shape
	query.transform = Transform2D(0.0, center + shape.position)
	query.collision_mask = probe.collision_mask
	query.exclude = [hero.get_rid()]
	var clear := hero.get_world_2d().direct_space_state.intersect_shape(query, 1).is_empty()
	probe.free()
	if not clear:
		return false
	_hero = hero
	_build = build
	_world = world
	_save = save
	_spent = bool(_save.call(&"is_transaction_applied", CONSUMED_RECEIPT))
	_site = site
	_reservation = area
	_build.encounter_exclusions.append(area)
	_configured = true
	# The overworld pauses immediately on death, before this node gets another
	# physics tick. Observe the real death signal to clean up synchronously.
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.has_signal(&"player_died") and not events.is_connected(&"player_died", _on_player_died):
		events.connect(&"player_died", _on_player_died)
	position = center
	var warning := Label.new()
	warning.name = "OptionalEncounterWarning"
	warning.text = "Encounter cleared" if _spent else "DANGER: skeleton nearby — optional"
	warning.position = Vector2(-110, -58)
	warning.size = Vector2(220, 20)
	warning.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	warning.add_theme_font_size_override("font_size", 10)
	warning.add_theme_color_override("font_color", Color(1.0, 0.75, 0.35))
	warning.add_theme_constant_override("outline_size", 4)
	add_child(warning)
	_spawn()
	return true

func _spawn() -> void:
	if not _configured or _spent or is_instance_valid(_enemy) or not is_instance_valid(_hero) \
			or _hero.global_position.distance_to(global_position) <= SAFE_SPAWN_DISTANCE:
		return
	var packed := load(ENEMY_SCENE) as PackedScene
	if packed == null:
		return
	var candidate := packed.instantiate() as CharacterBody2D
	if candidate == null:
		return
	if not _reservation_active:
		var committed := bool(_save.call(&"transact_once", CONSUMED_RECEIPT,
			func(_candidate: Dictionary) -> bool: return true,
			{"kind": "survival_encounter_pre_spawn_reservation", "encounter_id": "optional_skeleton_v1"}))
		if not committed:
			# A post-rename failure may already have reached disk. Subsequent
			# ordinary saves may still use the old memory snapshot. Either way,
			# never expose an enemy in this session after an ambiguous failure.
			candidate.free()
			_spent = true
			var warning := get_node_or_null("OptionalEncounterWarning") as Label
			if warning != null:
				warning.text = "Encounter unavailable: save could not be confirmed"
			push_warning("Optional encounter reservation failed; no enemy was exposed.")
			return
		_reservation_active = true
	_enemy = candidate
	_enemy.name = "BoundedSkeleton"
	_enemy.set("score_reward", 0)
	# The global LootDirector observes every node in the enemies group. Mark
	# only this experimental source as already processed before it enters the
	# tree; otherwise its generic death handler can grant unapproved random loot.
	# This uses the director's existing per-source idempotency guard and leaves
	# all dungeon enemies and the shared loot pipeline unchanged.
	_enemy.set_meta(&"loot_drop_processed", true)
	add_child(_enemy)
	_enemy.set("global_position", global_position)
	_enemy.connect("health_changed", _on_enemy_health_changed)
	_enemy.connect("died", _on_enemy_died)

func _on_enemy_health_changed(current: int, maximum: int) -> void:
	if _spent or current >= maximum or not _configured:
		return
	# The receipt was already committed before the enemy entered the tree; no
	# save is attempted after damage or Hero score has become observable.
	_spent = true
	var warning := get_node_or_null("OptionalEncounterWarning") as Label
	if warning != null:
		warning.text = "Encounter engaged — no respawn"

func _on_enemy_died(_which: Node) -> void:
	_cooldown = REARM_SECONDS

func _on_player_died() -> void:
	if not _configured or not is_instance_valid(_hero) or not bool(_hero.get("dead")):
		return
	if is_instance_valid(_enemy):
		_enemy.queue_free()
		_enemy = null
	_cooldown = REARM_SECONDS

func _physics_process(delta: float) -> void:
	if not _configured or not is_instance_valid(_hero):
		return
	if _cooldown > 0.0:
		_cooldown = maxf(0.0, _cooldown - delta)
	if is_instance_valid(_enemy) and not _enemy.is_queued_for_deletion():
		if bool(_hero.get("dead")) or _enemy.global_position.distance_to(global_position) > MAX_LEASH:
			_enemy.queue_free()
			_enemy = null
			_cooldown = REARM_SECONDS
	elif _cooldown <= 0.0:
		_enemy = null
		_spawn()

func _exit_tree() -> void:
	var events := get_node_or_null("/root/GameEvents")
	if events != null and events.is_connected(&"player_died", _on_player_died):
		events.disconnect(&"player_died", _on_player_died)
	if _configured and is_instance_valid(_build):
		_build.encounter_exclusions.erase(_reservation)

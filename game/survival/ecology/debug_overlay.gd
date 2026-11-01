class_name SOHEcologyDebugOverlay
extends Node2D
## Acceptance-only C08 overlay. It is never mounted by a normal player build:
## the overworld adds it only for a debug executable launched with
## --lw1-c08-debug. It draws existing evidence/knowledge; it creates no trace,
## target, damage, reward or gameplay state.

const POLICY := preload("res://game/survival/ecology/trace_policy.gd")

var _store: Node
var _world: Node
var _label: Label


func configure(store: Node, world: Node) -> void:
	_store = store
	_world = world
	z_index = 4096
	var layer := CanvasLayer.new()
	layer.name = "EcologyDebugCanvas"
	layer.layer = 100
	add_child(layer)
	_label = Label.new()
	_label.name = "EcologyDebugLabel"
	_label.position = Vector2(8, 8)
	_label.size = Vector2(620, 150)
	_label.add_theme_font_size_override(&"font_size", 12)
	_label.add_theme_color_override(&"font_color", Color(1.0, 0.95, 0.65))
	_label.add_theme_color_override(&"font_outline_color", Color(0.0, 0.0, 0.0))
	_label.add_theme_constant_override(&"outline_size", 3)
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layer.add_child(_label)


func _process(_delta: float) -> void:
	queue_redraw()
	if _label == null or _store == null:
		return
	var enemy := _ecology_enemy()
	var knowledge: Dictionary = enemy.call(&"ecology_snapshot") if enemy != null else {}
	var metrics: Dictionary = _store.get(&"metrics")
	_label.text = "C08 ACCEPTANCE DEBUG — not production UI\ntraces=%d surface=%s weather=%s\nenemy=%s\nknowledge=%s\nqueries=%s candidates=%s emitted=%s expired=%s" % [
		int(_store.call(&"trace_count")), String(_store.get(&"surface_status")), String(_store.get(&"weather_status")),
		JSON.stringify(knowledge), JSON.stringify(metrics),
		str(metrics.get("queries", 0)), str(metrics.get("candidates_examined", 0)),
		str(metrics.get("emitted", 0)), str(metrics.get("expired", 0)),
	]


func _draw() -> void:
	if _store == null or not is_instance_valid(_store):
		return
	var traces: Array = _store.call(&"all_traces")
	var by_id := {}
	for raw: Variant in traces:
		var record: Dictionary = raw
		by_id[String(record.get("id", ""))] = record
	for raw: Variant in traces:
		var record: Dictionary = raw
		var position := _position(record)
		var prev_id := String(record.get("prev_id", ""))
		if by_id.has(prev_id):
			var prev: Dictionary = by_id[prev_id]
			draw_line(_position(prev), position, Color(0.35, 0.9, 1.0, 0.55), 1.0)
		var clarity := float(_store.call(&"clarity", String(record.get("id", ""))))
		draw_circle(position, 2.0, Color(0.2, 0.95, 1.0, 0.25 + 0.65 * clarity))
	var enemy := _ecology_enemy()
	if enemy != null:
		draw_circle(enemy.global_position, POLICY.SENSE_RADIUS, Color(1.0, 0.7, 0.2, 0.12))
		draw_arc(enemy.global_position, POLICY.SENSE_RADIUS, 0.0, TAU, 32, Color(1.0, 0.7, 0.2, 0.6), 1.0)
		var snapshot: Dictionary = enemy.call(&"ecology_snapshot")
		var known: Array = snapshot.get("last_known_position", [])
		if known.size() >= 2:
			draw_circle(Vector2(float(known[0]), float(known[1])), 4.0, Color(1.0, 0.3, 0.3, 0.8))


func _ecology_enemy() -> Node:
	if _world == null or not is_instance_valid(_world):
		return null
	for node: Node in get_tree().get_nodes_in_group(&"enemies"):
		if node.has_method(&"ecology_enabled") and bool(node.call(&"ecology_enabled")):
			return node
	return null


func _position(record: Dictionary) -> Vector2:
	var value: Variant = record.get("position", [0.0, 0.0])
	if value is Array and (value as Array).size() >= 2:
		return Vector2(float((value as Array)[0]), float((value as Array)[1]))
	return Vector2.ZERO

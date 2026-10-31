## Live SOH-only receiver of R4 source_a_hit_confirmed; for ALL 20 Fusion slots.
## Never deals damage; only CombatDamage is authoritative. Does not draw Gold actors.
extends Node
class_name Arcana20SOHBinding

signal elemental_contact_confirmed(skill_id: StringName, actor: Node2D,
        element: StringName, damage: int)
signal source_contact_rejected(reason: StringName, skill_id: StringName)

const REGISTRY = preload("res://prototypes/arcana_fusion20/soh_binding/arcana20_soh_registry.gd")
const BODY = preload("res://prototypes/arcana_fusion20/soh_binding/arcana20_soh_body_reaction.gd")

var bridge: Node
var _actors: Dictionary = {}
var _receipts: Dictionary = {}
var _confirmed := 0
var _rejected := 0


func attach_to_bridge(source_bridge: Node) -> bool:
    if source_bridge == null or not source_bridge.has_signal(&"source_a_hit_confirmed"):
        return false
    if is_instance_valid(bridge):
        var cb := Callable(self,"_on_confirmed_hit")
        if bridge.is_connected(&"source_a_hit_confirmed",cb):
            bridge.disconnect(&"source_a_hit_confirmed",cb)
    bridge = source_bridge
    bridge.connect(&"source_a_hit_confirmed",Callable(self,"_on_confirmed_hit"))
    return true


func _exit_tree() -> void:
    if is_instance_valid(bridge):
        var cb := Callable(self,"_on_confirmed_hit")
        if bridge.is_connected(&"source_a_hit_confirmed",cb):
            bridge.disconnect(&"source_a_hit_confirmed",cb)
    bridge = null
    _actors.clear()
    _receipts.clear()


func _reject(reason: StringName, skill_id: StringName) -> void:
    _rejected += 1
    source_contact_rejected.emit(reason,skill_id)


func _on_confirmed_hit(target: Node2D, before_png: PackedByteArray,
        after_png: PackedByteArray, details: Dictionary) -> void:
    var skill_id: StringName = StringName(details.get("skill_id",""))
    var data: Dictionary = REGISTRY.lookup(skill_id)
    if data.is_empty():
        _reject(&"unregistered_fusion20_id",skill_id)
        return
    if not is_instance_valid(target) or not target.is_in_group(&"enemies"):
        _reject(&"not_a_live_SOH_enemy",skill_id)
        return
    var damage := int(details.get("actual_damage",0))
    if damage <= 0 or before_png.is_empty():
        _reject(&"missing_actual_hit_receipt_or_sprite",skill_id)
        return
    var expected: StringName = data["source_element"]
    var element: StringName = StringName(details.get("element",""))
    if element != expected:
        _reject(&"element_mismatch",skill_id)
        return
    var token := "%s|%d|%d" % [
        String(details.get("cast_id","")),
        int(details.get("source_cursor",-1)),
        target.get_instance_id()]
    if _receipts.has(token):
        _reject(&"replayed_receipt",skill_id)
        return
    if String(details.get("cast_id","")).is_empty() or int(details.get("source_cursor",-1)) < 0:
        _reject(&"invalid_contact_id",skill_id)
        return
    _receipts[token] = true
    var id := target.get_instance_id()
    var visual: Arcana20SOHBodyReaction = _actors.get(id)
    if not is_instance_valid(visual):
        visual = BODY.new()
        visual.name = "ArcanaSourceABodyReaction"
        target.add_child(visual)
        if not visual.bind_actor(target):
            visual.queue_free()
            _actors.erase(id)
            _reject(&"no_live_animated_sprite",skill_id)
            return
        _actors[id] = visual
    if not visual.accept_confirmed(element,damage):
        _reject(&"body_visual_did_not_accept",skill_id)
        return
    _confirmed += 1
    elemental_contact_confirmed.emit(skill_id,target,element,damage)


func get_actor_visual(target: Node2D) -> Arcana20SOHBodyReaction:
    var visual: Arcana20SOHBodyReaction = _actors.get(target.get_instance_id())
    return visual if is_instance_valid(visual) else null


func diagnostics() -> Dictionary:
    return {"confirmed": _confirmed, "rejected": _rejected,
        "unique_receipts": _receipts.size(),
        "live_bound_actors": _actors.values().filter(
            func(item): return is_instance_valid(item)).size()}

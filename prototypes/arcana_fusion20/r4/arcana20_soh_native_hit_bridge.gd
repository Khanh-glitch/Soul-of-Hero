## ARCANA Fusion20 R4: native host-admission + authentic SOH AnimatedSprite2D frame port.
## ISOLATED diagnostic, not production mount. This script DOES NOT draw/recreate A/B/C.
## Damage/state/score remain exclusively SOH-owned through CombatDamage.
extends Node

signal source_a_frame_ready(target: Node2D, png: PackedByteArray, details: Dictionary)
signal source_a_hit_confirmed(target: Node2D, before_png: PackedByteArray,
        after_png: PackedByteArray, details: Dictionary)
signal hit_rejected(reason: StringName, identity: String)

var _pending: Dictionary = {}
var _accepted: Dictionary = {}
var _observed: int = 0
var _confirmed: int = 0
var _rejected: int = 0
var _missing_confirmed_event: int = 0


func _ready() -> void:
    var bus := get_node_or_null("/root/GameEvents")
    if bus != null and bus.has_signal(&"combat_hit_confirmed"):
        bus.connect(&"combat_hit_confirmed", Callable(self, "_on_combat_hit_confirmed"))
    else:
        push_warning("Arcana R4 requires SOH GameEvents to capture confirmed hits")


func _exit_tree() -> void:
    var bus := get_node_or_null("/root/GameEvents")
    if bus != null and bus.has_signal(&"combat_hit_confirmed"):
        var cb := Callable(self, "_on_combat_hit_confirmed")
        if bus.is_connected(&"combat_hit_confirmed", cb):
            bus.disconnect(&"combat_hit_confirmed", cb)
    _pending.clear()
    _accepted.clear()


## Capture current SOH sprite atlas frame, not prototype enemy art.
func capture_current_frame(target: Node2D) -> Dictionary:
    if not is_instance_valid(target) or target.is_queued_for_deletion():
        return {}
    var sprite := target.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
    if sprite == null:
        sprite = target.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
    if sprite == null or sprite.sprite_frames == null:
        return {}
    var anim: StringName = sprite.animation
    if not sprite.sprite_frames.has_animation(anim):
        return {}
    var length := sprite.sprite_frames.get_frame_count(anim)
    if length <= 0 or sprite.frame < 0 or sprite.frame >= length:
        return {}
    var tex := sprite.sprite_frames.get_frame_texture(anim, sprite.frame)
    if tex == null:
        return {}
    var img: Image = null
    if tex is AtlasTexture:
        var atlas := tex as AtlasTexture
        if atlas.atlas == null:
            return {}
        var src := atlas.atlas.get_image()
        if src == null or src.is_empty():
            return {}
        var r: Rect2 = atlas.region
        img = src.get_region(Rect2i(Vector2i(roundi(r.position.x), roundi(r.position.y)),
                Vector2i(roundi(r.size.x), roundi(r.size.y))))
    else:
        img = tex.get_image()
    if img == null or img.is_empty():
        return {}
    return {
        "target_instance_id": target.get_instance_id(),
        "target_world": target.global_position,
        "sprite_world": sprite.global_position,
        "sprite_transform": sprite.global_transform,
        "sprite_canvas_transform": sprite.get_global_transform_with_canvas(),
        "sprite_scale": sprite.scale,
        "sprite_flip_h": sprite.flip_h,
        "sprite_flip_v": sprite.flip_v,
        "sprite_modulate": sprite.modulate,
        "animation": String(anim),
        "frame_index": sprite.frame,
        "frame_count": length,
        "size": img.get_size(),
        "png": img.save_png_to_buffer(),
    }


func emit_current_frame(target: Node2D) -> bool:
    var packet := capture_current_frame(target)
    if packet.is_empty():
        return false
    var png: PackedByteArray = packet["png"]
    packet.erase("png")
    _observed += 1
    source_a_frame_ready.emit(target, png, packet)
    return true


func _identity(cast_id: String, source_cursor: int, target: Node2D) -> String:
    return "%s|%d|%d" % [cast_id, source_cursor, target.get_instance_id()]


## Only call after gameplay has authorized this damage amount.
func request_hit(target: Node2D, amount: int, source_world: Vector2,
        cast_id: String, source_cursor: int, skill_id: StringName,
        element: StringName) -> bool:
    if not is_instance_valid(target) or target.is_queued_for_deletion():
        return _reject(&"invalid_target", "")
    var token := _identity(cast_id, source_cursor, target)
    if cast_id.is_empty() or source_cursor < 0 or skill_id.is_empty() or amount <= 0:
        return _reject(&"invalid_request", token)
    if _accepted.has(token) or _pending.has(token):
        return _reject(&"duplicate_identity", token)
    if not target.is_in_group(&"enemies") or not CombatDamage.is_alive(target):
        return _reject(&"unavailable_target", token)
    var frame_before := capture_current_frame(target)
    if frame_before.is_empty():
        return _reject(&"missing_actual_sprite_frame", token)
    _pending[token] = {"target": weakref(target), "before": frame_before,
        "element": element, "skill_id": skill_id, "observed": false,
        "cast_id": cast_id, "source_cursor": source_cursor}
    var context := {
        "source_kind": &"active_skill",
        "skill_id": skill_id,
        "cast_id": cast_id,
        "source_cursor": source_cursor,
        "element": element,
        "hit_position": target.global_position,
        "cue_id": &"heavy_impact",
        "suppress_feedback": true,
        "emit_cue": false,
    }
    var approved := CombatDamage.apply_confirmed(target, amount, source_world, skill_id, context)
    var pending_result: Dictionary = _pending.get(token, {})
    var event_seen := bool(pending_result.get("observed", false))
    _pending.erase(token)
    if not approved:
        return _reject(&"combat_authority_rejected", token)
    _accepted[token] = true
    if not event_seen:
        _missing_confirmed_event += 1
        push_warning("Arcana R4: damage accepted but GameEvents confirmation was not observed")
    return true


func _on_combat_hit_confirmed(target: Node, actual_amount: int,
        hit_world: Vector2, context: Dictionary) -> void:
    if not is_instance_valid(target) or not target is Node2D:
        return
    var cast_id := String(context.get("cast_id", ""))
    var cursor := int(context.get("source_cursor", -1))
    if cast_id.is_empty() or cursor < 0:
        return
    var actor := target as Node2D
    var token := _identity(cast_id, cursor, actor)
    if not _pending.has(token):
        return
    var pending: Dictionary = _pending[token]
    if (pending["target"] as WeakRef).get_ref() != target or actual_amount <= 0:
        return
    if bool(pending["observed"]):
        return
    pending["observed"] = true
    _pending[token] = pending
    var before: Dictionary = pending["before"]
    var after := capture_current_frame(actor)
    var info := {
        "cast_id": cast_id, "source_cursor": cursor,
        "target_instance_id": actor.get_instance_id(),
        "actual_damage": actual_amount, "hit_world": hit_world,
        "target_world": actor.global_position, "element": pending["element"],
        "skill_id": pending["skill_id"],
        "animation_before": before.get("animation", ""),
        "frame_before": before.get("frame_index", -1),
        "animation_after": after.get("animation", ""),
        "frame_after": after.get("frame_index", -1),
        "size": before.get("size", Vector2i.ZERO),
        "sprite_transform": before.get("sprite_transform", Transform2D.IDENTITY),
        "source": "SOH AnimatedSprite2D and confirmed CombatDamage event",
    }
    _confirmed += 1
    source_a_hit_confirmed.emit(actor,
        before.get("png", PackedByteArray()),
        after.get("png", PackedByteArray()), info)


func _reject(reason: StringName, token: String) -> bool:
    _rejected += 1
    hit_rejected.emit(reason, token)
    return false


func stats() -> Dictionary:
    return {"accepted_unique": _accepted.size(),
        "confirmed_events": _confirmed, "rejected": _rejected,
        "frames_observed": _observed,
        "damage_accepted_without_event": _missing_confirmed_event}

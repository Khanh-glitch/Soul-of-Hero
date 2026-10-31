## Source-A enemy-body reaction host on an ACTUAL SOH AnimatedSprite2D frame.
## This is a partial native port of ARCANA A enemies.ts drawAlive; not Gold-final.
## No Gold arena player/enemies/HP/damage render. No damage or status economy mutation.
extends Node2D
class_name Arcana20SOHBodyReaction

const SOURCE_A_DECAY := {
    "fire": 0.20, "water": 0.25, "ice": 0.10,
    "volt": 0.80, "verdant": 0.16, "astral": 0.70
}
const FIRE_RAMP: Array[Vector4] = [
    Vector4(0.00, 0.05, 0.01, 0.02),
    Vector4(0.18, 0.42, 0.04, 0.08),
    Vector4(0.38, 0.95, 0.17, 0.06),
    Vector4(0.60, 1.50, 0.60, 0.10),
    Vector4(0.82, 2.20, 1.50, 0.50),
    Vector4(1.00, 3.00, 2.80, 2.20)
]
var actor: Node2D
var sprite: AnimatedSprite2D
var status: Dictionary = {
    "fire": 0.0, "water": 0.0, "ice": 0.0,
    "volt": 0.0, "verdant": 0.0, "astral": 0.0
}
var clock := 0.0
var seed := 13.0
var confirmed_contacts := 0
var _cached_animation: StringName
var _cached_frame := -1
var _cached_mask: Image
var _top: PackedInt32Array


func bind_actor(target: Node2D) -> bool:
    if not is_instance_valid(target) or target.is_queued_for_deletion():
        return false
    actor = target
    sprite = target.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
    if sprite == null:
        sprite = target.find_child("AnimatedSprite2D", true, false) as AnimatedSprite2D
    if sprite == null or sprite.sprite_frames == null:
        return false
    seed = float(target.get_instance_id() % 101) + 13.0
    z_index = 2
    set_process(true)
    return true


## Called by SOH bridge ONLY on a confirmed CombatDamage event.
func accept_confirmed(element: StringName, actual_damage: int) -> bool:
    if actual_damage <= 0 or not status.has(String(element)) or not is_instance_valid(actor):
        return false
    var key := String(element)
    var increment: float = 0.50
    if key == "water":
        status[key] = 1.0
    elif key == "verdant":
        status[key] = minf(1.0, float(status[key]) + increment * 0.8)
    elif key == "fire":
        status[key] = minf(1.2, float(status[key]) + increment)
    else:
        status[key] = minf(1.0, float(status[key]) + increment)
    confirmed_contacts += 1
    queue_redraw()
    return true


func intensity(element: StringName) -> float:
    return float(status.get(String(element), 0.0))


func _process(delta: float) -> void:
    if not is_instance_valid(actor) or actor.is_queued_for_deletion():
        queue_free()
        return
    var any_active := false
    for key in status.keys():
        var old_value := float(status[key])
        if old_value > 0.0:
            status[key] = maxf(0.0, old_value - float(SOURCE_A_DECAY[key]) * delta)
            any_active = true
    if any_active:
        clock += delta
        queue_redraw()


## Source A hash2, signed 32-bit JS integer semantics.
func _hash2(x: float, y: float) -> float:
    var h := int(x * 374761393.0 + y * 668265263.0) & 0xffffffff
    if h >= 0x80000000:
        h -= 0x100000000
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    if h >= 0x80000000:
        h -= 0x100000000
    return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


func _vnoise(x: float, y: float) -> float:
    var xi := floori(x)
    var yi := floori(y)
    var u := x - float(xi)
    var v := y - float(yi)
    u = u * u * (3.0 - 2.0 * u)
    v = v * v * (3.0 - 2.0 * v)
    return lerpf(
        lerpf(_hash2(xi, yi), _hash2(xi + 1, yi), u),
        lerpf(_hash2(xi, yi + 1), _hash2(xi + 1, yi + 1), u), v)


func _fire_col(h: float) -> Vector3:
    var t := floorf(clampf(h, 0.0, 1.0) * 9.0) / 9.0
    for i in range(FIRE_RAMP.size() - 1):
        var a := FIRE_RAMP[i]
        var b := FIRE_RAMP[i + 1]
        if t <= b.x:
            var k := clampf((t - a.x) / maxf(0.00001, b.x - a.x), 0.0, 1.0)
            return Vector3(lerpf(a.y,b.y,k), lerpf(a.z,b.z,k), lerpf(a.w,b.w,k))
    var last: Vector4 = FIRE_RAMP[FIRE_RAMP.size() - 1]
    return Vector3(last.y,last.z,last.w)


func _mask() -> bool:
    if sprite == null or sprite.sprite_frames == null or not sprite.sprite_frames.has_animation(sprite.animation):
        return false
    if _cached_mask != null and _cached_animation == sprite.animation and _cached_frame == sprite.frame:
        return true
    var texture := sprite.sprite_frames.get_frame_texture(sprite.animation, sprite.frame)
    if texture == null:
        return false
    var img: Image = null
    if texture is AtlasTexture:
        var a := texture as AtlasTexture
        if a.atlas == null:
            return false
        var raw := a.atlas.get_image()
        if raw == null or raw.is_empty():
            return false
        img = raw.get_region(Rect2i(
            Vector2i(roundi(a.region.position.x), roundi(a.region.position.y)),
            Vector2i(roundi(a.region.size.x), roundi(a.region.size.y))))
    else:
        img = texture.get_image()
    if img == null or img.is_empty():
        return false
    _cached_mask = img
    _cached_animation = sprite.animation
    _cached_frame = sprite.frame
    _top.resize(img.get_width())
    for col in range(img.get_width()):
        _top[col] = -1
        for row in range(img.get_height()):
            if img.get_pixel(col,row).a > 0.05:
                _top[col] = row
                break
    return true


func _point(col: float, row: float) -> Vector2:
    var w := float(_cached_mask.get_width())
    var h := float(_cached_mask.get_height())
    var sx := sprite.scale.x * (-1.0 if sprite.flip_h else 1.0)
    var sy := sprite.scale.y * (-1.0 if sprite.flip_v else 1.0)
    var x := col - (w * 0.5 if sprite.centered else 0.0) + sprite.offset.x
    var y := row - (h * 0.5 if sprite.centered else 0.0) + sprite.offset.y
    return sprite.position + Vector2(x * sx, y * sy)


func _dot(point: Vector2, color: Color, size: float = 1.0) -> void:
    var pixel := maxf(0.5, size)
    draw_rect(Rect2(point, Vector2(pixel,pixel)), color, true)


func _draw() -> void:
    if not _mask():
        return
    var w := _cached_mask.get_width()
    var h := _cached_mask.get_height()
    var fire := intensity(&"fire")
    var wet := intensity(&"water")
    var ice := intensity(&"ice")
    var shock := intensity(&"volt")
    var root := intensity(&"verdant")
    var warp := intensity(&"astral")
    if fire + wet + ice + shock + root + warp <= 0.0:
        return

    # Real sprite pixels only; source A's status treatments follow current animation.
    for row in range(h):
        for col in range(w):
            if _cached_mask.get_pixel(col,row).a <= 0.05:
                continue
            var pt := _point(float(col),float(row))
            if wet > 0.0:
                _dot(pt, Color(0.04,0.13,0.22,0.13*wet))
            if ice > 0.0:
                _dot(pt, Color(0.30,0.68,1.0,0.28*ice))
            if fire > 0.05 and _hash2(float(col*3)+seed,float(row*5)) > 0.76:
                var v := _fire_col(fire*(0.45+0.4*sin(clock*9.0+col+row)))
                _dot(pt,Color(clampf(v.x*0.6,0,1),clampf(v.y*0.6,0,1),
                    clampf(v.z*0.6,0,1),0.8))
            if root > 0.0 and _hash2(float(col)+seed,float(row*3)) > 0.96:
                _dot(pt,Color(0.2,0.7,0.3,0.35*root))

    # Fire tongues: original A drawAlive outline-top/vnoise/timing equations.
    if fire > 0.05:
        for col in range(w):
            if _top[col] < 0:
                continue
            var top := float(_top[col])
            var lf := minf(1.2,fire)*(2.0+6.0*_vnoise(col*0.6+seed,clock*7.0))
            for k in range(ceili(lf)):
                var u := float(k)/maxf(0.00001,lf)
                var c := _fire_col((1.0-u)*minf(1.0,fire)*0.95+0.05)
                var pos := _point(float(col),top-float(k))
                pos.x += sin(clock*11.0+col+k*0.7)*u*1.3
                _dot(pos,Color(clampf(c.x,0,1),clampf(c.y,0,1),
                    clampf(c.z,0,1),0.85*(1.0-u*0.4)))

    # Frozen crystalline shell: original A 7-sided angular shell/silhouette.
    if ice > 0.3:
        var k := clampf((ice-0.3)/0.35,0.0,1.0)
        var center := _point(w*0.5,h*0.5)
        var rx := w*0.62+2.0
        var ry := h*0.62+2.0
        var poly := PackedVector2Array()
        for si in range(7):
            var a := float(si)*TAU/7.0
            var rad := 0.82+_hash2(seed,float(si))*0.3
            poly.append(center+Vector2(cos(a)*rx*rad,sin(a)*ry*rad))
        for i in range(poly.size()):
            draw_line(poly[i],poly[(i+1)%poly.size()],Color(0.55,0.85,1.0,0.8*k),1.0)

    # Root vines: original A two bands, each advances over real sprite's width.
    if root > 0.08:
        for band in range(2):
            var base_row := float(h)*(0.5+float(band)*0.3)
            var reach := clampf(root*1.5,0.0,1.0)
            for col in range(int(w*reach)):
                var y := base_row+sin(col*0.9+seed+band*2.0)*1.6
                _dot(_point(col,y),Color(0.07,0.4+band*0.1,0.08,root))
                if col%3 == 0:
                    _dot(_point(col,y-1.0),Color(0.3,0.7,0.25,root))

    # Shock: source A frame-hash-gated on-body arcs, not whole-stage lightning.
    var frame := floori(clock*30.0)
    if shock > 0.2 and _hash2(frame,seed*3.0) > 0.4:
        var r1 := _hash2(frame,seed+1.0)
        var r2 := _hash2(frame+7.0,seed+2.0)
        var x0 := r1*float(w)
        var x1 := r2*float(w)
        var y0 := float(h)*(0.8-0.6*r2)
        var y1 := float(h)*(0.8-0.6*r1)
        var last := _point(x0,y0)
        for k in range(1,6):
            var u := float(k)/5.0
            var jit := (_hash2(frame*31+k,seed)-0.5)*3.0*sin(u*PI)
            var pt := _point(lerpf(x0,x1,u)+jit,lerpf(y0,y1,u))
            draw_line(last,pt,Color(0.6,0.85,1.0,shock),1.0)
            last=pt

    # Astral warp uses A double offset silhouettes; true target mask, no Gold enemy.
    if warp > 0.05:
        var off := warp*(4.0+2.0*sin(clock*9.0))
        for row in range(0,h,2):
            for col in range(0,w,2):
                if _cached_mask.get_pixel(col,row).a <= 0.05:
                    continue
                var pt := _point(col,row)
                _dot(pt+Vector2(-off,0),Color(0.9,0.05,0.35,warp*0.45))
                _dot(pt+Vector2(off,-1),Color(0.15,0.35,1.0,warp*0.45))

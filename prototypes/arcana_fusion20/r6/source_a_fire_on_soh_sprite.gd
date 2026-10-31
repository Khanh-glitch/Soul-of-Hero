## ARCANA A original on-body FIRE reaction, adapted to a real SOH AnimatedSprite2D.
## Equations and 6-stop fire ramp come from sources/A/src/engine/enemies.ts:
## drawAlive() burn tongues and fire-lit silhouette, math.ts hash2/vnoise/R("fire").
## This draws on the target's CURRENT atlas mask, not a handmade generic flame sprite.
## Presentation only; SOH CombatDamage controls damage, status, HP and deaths.
extends Node2D
class_name ArcanaAOnBodyFire

const FIRE_RAMP := [
    Vector4(0.00,0.05,0.01,0.02),
    Vector4(0.18,0.42,0.04,0.08),
    Vector4(0.38,0.95,0.17,0.06),
    Vector4(0.60,1.50,0.60,0.10),
    Vector4(0.82,2.20,1.50,0.50),
    Vector4(1.00,3.00,2.80,2.20),
]

var actor: Node2D
var sprite: AnimatedSprite2D
var burn: float = 0.0
var clock: float = 0.0
var seed: float = 1.0
var _cached_anim: StringName
var _cached_frame := -1
var _cached_top: PackedInt32Array = PackedInt32Array()
var _cached_pixels: Image


func _ready() -> void:
    var mat := CanvasItemMaterial.new()
    mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
    material = mat
    z_index = 3
    set_process(true)


func bind_actor(target: Node2D) -> bool:
    if not is_instance_valid(target):
        return false
    actor = target
    sprite = target.get_node_or_null("AnimatedSprite2D") as AnimatedSprite2D
    seed = float(target.get_instance_id() % 131) * 0.1
    return sprite != null and sprite.sprite_frames != null


func ignite(confirmed_damage: int, _hit_world: Vector2) -> bool:
    if confirmed_damage <= 0 or not is_instance_valid(actor) or sprite == null:
        return false
    # A damageEnemy() default burn accumulation is (0.3 + f*0.5), with f=0.4.
    burn = minf(1.2, burn + 0.5)
    queue_redraw()
    return true


func _process(delta: float) -> void:
    if burn <= 0.05:
        return
    clock += delta
    # Original A updateEnemy(): burn = max(0, burn - dt * 0.2).
    burn = maxf(0.0, burn - delta * 0.2)
    queue_redraw()


func _hash2(x: float, y: float) -> float:
    # JS signed 32-bit hash2 port, preserving its shifts/overflow/unsigned result.
    var h := (int(x * 374761393.0 + y * 668265263.0) & 0xffffffff)
    if h >= 0x80000000: h -= 0x100000000
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    if h >= 0x80000000: h -= 0x100000000
    return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


func _vnoise(x: float, y: float) -> float:
    var xi := floori(x)
    var yi := floori(y)
    var xf := x - float(xi)
    var yf := y - float(yi)
    var u := xf * xf * (3.0 - 2.0 * xf)
    var v := yf * yf * (3.0 - 2.0 * yf)
    var a := _hash2(float(xi),float(yi))
    var b := _hash2(float(xi+1),float(yi))
    var c := _hash2(float(xi),float(yi+1))
    var d := _hash2(float(xi+1),float(yi+1))
    return lerpf(lerpf(a,b,u),lerpf(c,d,u),v)


func _fire_col(h: float) -> Vector3:
    # Original A: R("fire", floor(clamp(h) * 9) / 9).
    var t := floorf(clampf(h,0.0,1.0)*9.0)/9.0
    for i in range(FIRE_RAMP.size()-1):
        var a: Vector4 = FIRE_RAMP[i]
        var b: Vector4 = FIRE_RAMP[i+1]
        if t <= b.x:
            var q := clampf((t-a.x)/maxf(0.000001,b.x-a.x),0.0,1.0)
            return Vector3(lerpf(a.y,b.y,q),lerpf(a.z,b.z,q),lerpf(a.w,b.w,q))
    var last: Vector4 = FIRE_RAMP[FIRE_RAMP.size()-1]
    return Vector3(last.y,last.z,last.w)


func _current_mask() -> bool:
    if sprite == null or sprite.sprite_frames == null:
        return false
    if _cached_frame == sprite.frame and _cached_anim == sprite.animation and _cached_pixels != null:
        return true
    var texture := sprite.sprite_frames.get_frame_texture(sprite.animation,sprite.frame)
    if texture == null:
        return false
    if texture is AtlasTexture:
        var atlas := texture as AtlasTexture
        if atlas.atlas == null:
            return false
        var original := atlas.atlas.get_image()
        if original == null or original.is_empty():
            return false
        var r := atlas.region
        _cached_pixels = original.get_region(Rect2i(
            Vector2i(roundi(r.position.x),roundi(r.position.y)),
            Vector2i(roundi(r.size.x),roundi(r.size.y))))
    else:
        _cached_pixels = texture.get_image()
    if _cached_pixels == null or _cached_pixels.is_empty():
        return false
    var w := _cached_pixels.get_width()
    var h := _cached_pixels.get_height()
    _cached_top.resize(w)
    for col in range(w):
        _cached_top[col] = -1
        for row in range(h):
            if _cached_pixels.get_pixel(col,row).a > 0.05:
                _cached_top[col] = row
                break
    _cached_frame = sprite.frame
    _cached_anim = sprite.animation
    return true


func _draw() -> void:
    if burn <= 0.05 or not _current_mask():
        return
    var w := _cached_pixels.get_width()
    var h := _cached_pixels.get_height()
    var sx := sprite.scale.x
    var sy := sprite.scale.y
    var xflip := -1.0 if sprite.flip_h else 1.0
    # Burn light drawn directly on CURRENT opaque sprite pixels.
    for col in range(w):
        for row in range(h):
            if _cached_pixels.get_pixel(col,row).a <= 0.05:
                continue
            if _hash2(float(col*3)+seed,float(row*5)) > 0.76:
                var hval := burn*(0.45+0.4*sin(clock*9.0+col+row))
                var fc := _fire_col(hval)
                var onbody := Vector2(sprite.position.x + (float(col)-w*0.5+0.5)*sx*xflip,
                    sprite.position.y + (float(row)-h*0.5+0.5)*sy)
                draw_rect(Rect2(onbody,Vector2(absf(sx),absf(sy))),
                    Color(minf(fc.x*0.6,1.0),minf(fc.y*0.6,1.0),minf(fc.z*0.6,1.0),0.68),true)
    # Exact source-A silhouette-top-edge, vnoise, timing and tongue placement.
    for col in range(w):
        var top := _cached_top[col]
        if top < 0:
            continue
        var x := sprite.position.x + (float(col)-w*0.5+0.5)*sx*xflip
        var y := sprite.position.y + (float(top)-h*0.5)*sy
        var lf := minf(1.2,burn)*(2.0+6.0*_vnoise(float(col)*0.6+seed,clock*7.0))
        for k in range(ceili(lf)):
            var u := float(k)/maxf(lf,0.001)
            var color := _fire_col((1.0-u)*minf(1.0,burn)*0.95+0.05)
            var flame_pos := Vector2(x+sin(clock*11.0+col+k*0.7)*u*1.3*sx,
                y-float(k)*sy)
            draw_rect(Rect2(flame_pos,Vector2(absf(sx),absf(sy))),
                Color(minf(color.x,1.0),minf(color.y,1.0),minf(color.z,1.0),
                    0.85*(1.0-u*0.4)),true)

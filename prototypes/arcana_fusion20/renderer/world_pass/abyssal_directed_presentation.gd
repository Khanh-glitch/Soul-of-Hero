## R20 #05 B ONLY: authored presentation over the real world, not a source
## replacement, combat event, source framebuffer, or copied background.
## The original A and C players continue to simulate/render unchanged. This
## target-centered, world-up layer adds a low water wash, breaking crests,
## gravity-driven spray and settling rings. It stays below actors (z=0).
extends Node2D
class_name AbyssalDirectedPresentation

const DEEP := Color(0.027, 0.122, 0.243, 0.48)
const WATER := Color(0.078, 0.373, 0.557, 0.48)
const BLUE := Color(0.122, 0.561, 0.722, 0.74)
const CREST := Color(0.263, 0.753, 0.863, 0.88)
const FOAM := Color(0.663, 0.914, 0.957, 0.92)
const WHITE := Color(0.847, 0.973, 1.0, 0.96)
var clock: FusionPlayer

func _init() -> void:
    z_index = -22 # terrain and both source layers behind; real actors above
    texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST

func _process(_delta: float) -> void:
    queue_redraw()

func _ink(c: Color, a: float) -> Color:
    return Color(c.r, c.g, c.b, c.a * clampf(a, 0.0, 1.0))

# Short, broken pixel-art ellipses: the negative space is intentional.
func _rings(rx: float, ry: float, _age: float, strength: float, color: Color, step: int = 1) -> void:
    for i in range(96):
        if (i + step * 3) % 11 < 3: continue
        var a := TAU * float(i) / 96.0
        var x := roundf(cos(a) * rx)
        var y := roundf(sin(a) * ry)
        var w := 2.0 + float((i + step) % 3)
        draw_rect(Rect2(x, y, w, 1.0 + float((i + step) % 2)), _ink(color, strength))

func _draw() -> void:
    if not is_instance_valid(clock): return
    var t := clock.source_time()
    var age := t - 5.0 # original A climax / original C TP, not wall time
    if t < 4.25 or t >= 8.5: return
    # A preparatory pressure ripple, then a dark translucent wash of the actual
    # ground. No screenshot/base texture or invented terrain is drawn here.
    var anticipation := clampf((t - 4.25) / 0.75, 0.0, 1.0)
    if age < 0.0:
        _rings(78.0 + anticipation * 22.0, 28.0 + anticipation * 7.0, age, anticipation * 0.65, CREST, 1)
        return
    var spread := 1.0 - exp(-age * 4.3)
    var wash_fade: float = 1.0 - smoothstep(1.7, 3.35, age)
    var rx := 35.0 + 126.0 * spread
    var ry := 12.0 + 47.0 * spread
    var water := PackedVector2Array()
    for i in range(32):
        var a := TAU * float(i) / 32.0
        water.append(Vector2(roundf(cos(a) * rx), roundf(sin(a) * ry)))
    draw_colored_polygon(water, _ink(DEEP, wash_fade * 0.72))
    _rings(rx, ry, age, wash_fade, BLUE, 2)
    _rings(rx * 0.79, ry * 0.79, age, wash_fade * 0.9, CREST, 3)
    _rings(rx * 0.56, ry * 0.56, age, wash_fade * 0.8, FOAM, 4)
    # Breaking wave wings frame, rather than replace or thicken, the original
    # C column. The tips travel outward and fall as the source eruption settles.
    var wave := sin(PI * clampf(age / 1.35, 0.0, 1.0))
    var flight := clampf(age / 0.55, 0.0, 1.0)
    if wave > 0.001:
        for side_value in [-1.0, 1.0]:
            var side: float = float(side_value)
            for band in range(3):
                var b := float(band)
                var x0 := side * (13.0 + b * 9.0)
                var x1 := side * (45.0 + b * 14.0 + flight * (45.0 + b * 10.0))
                var y0 := 2.0 + b * 3.0
                var y1 := -wave * (39.0 + b * 13.0)
                var ymid := -wave * (58.0 + b * 12.0)
                var wing := PackedVector2Array([
                    Vector2(x0, y0), Vector2(side * (32.0 + b * 12.0), ymid * 0.72),
                    Vector2(x1, y1), Vector2(x1 - side * 7.0, y1 + 8.0),
                    Vector2(side * (31.0 + b * 12.0), ymid * 0.72 + 9.0), Vector2(x0, y0 + 6.0)])
                draw_colored_polygon(wing, _ink(WATER if band == 2 else BLUE, wave * (0.8 - b * 0.12)))
                # Stepped crest marks on the outer edge, not a blurred glow.
                for n in range(5):
                    var u := float(n) / 5.0
                    var x := roundf(lerpf(side * (32.0 + b * 12.0), x1, u))
                    var y := roundf(lerpf(ymid * 0.72, y1, u))
                    draw_rect(Rect2(x, y, 3.0 + float((n + band) % 3), 2.0), _ink(FOAM if band == 0 else CREST, wave))
    # Authored deterministic spray arcs; gravity is always world-down. Their
    # little square tips and short tails are visibly separate from C particles.
    if age < 2.4:
        for i in range(48):
            var launch := float(i % 8) * 0.055
            var q := age - launch
            if q <= 0.0 or q >= 1.65: continue
            var side := -1.0 if i % 2 == 0 else 1.0
            var vx := side * (34.0 + float((i * 37) % 100))
            var vy := 65.0 + float((i * 53) % 125)
            var x := roundf(vx * q)
            var y := roundf(-vy * q + 118.0 * q * q)
            if y > 12.0: continue
            var fade := (1.0 - clampf(q / 1.65, 0.0, 1.0)) * minf(1.0, q * 8.0)
            var size := 1.0 + float(i % 3)
            draw_rect(Rect2(x, y, size, size + 2.0), _ink(WHITE if i % 4 == 0 else FOAM, fade))
            if i % 3 == 0:
                draw_rect(Rect2(x, y - 3.0, 1.0, 3.0), _ink(CREST, fade * 0.8))
    # After the eruption the splash becomes sparse outward rings and foam,
    # then fades to a genuinely empty OUT rather than holding a bright halo.
    if age > 1.0:
        for k in range(3):
            var q := age - 1.0 - float(k) * 0.42
            if q < 0.0 or q > 1.7: continue
            _rings(22.0 + q * 44.0, 8.0 + q * 16.0, age, (1.0 - q / 1.7) * 0.8, FOAM, 6 + k)

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
    var rx := 35.0 + 108.0 * spread
    var ry := 12.0 + 39.0 * spread
    var water := PackedVector2Array()
    for i in range(32):
        var a := TAU * float(i) / 32.0
        water.append(Vector2(roundf(cos(a) * rx), roundf(sin(a) * ry)))
    draw_colored_polygon(water, _ink(DEEP, wash_fade * 0.38))
    _rings(rx, ry, age, wash_fade, BLUE, 2)
    _rings(rx * 0.79, ry * 0.79, age, wash_fade * 0.9, CREST, 3)
    _rings(rx * 0.56, ry * 0.56, age, wash_fade * 0.8, FOAM, 4)
    # Water thrown up by the impact: curved, tapering sheets with a layered
    # blue body and broken pale foam. These are a separate stage-facing
    # presentation, not replacements or rescaling of C's authored column.
    # The three staggered arcs on each side grow, crest and then collapse.
    for side_value in [-1.0, 1.0]:
        var side: float = float(side_value)
        for band in range(3):
            var b := float(band)
            var phase := age - b * 0.075
            if phase <= 0.0 or phase >= 1.55: continue
            var grow := 1.0 - exp(-phase * 8.0)
            var collapse: float = 1.0 - smoothstep(0.70, 1.55, phase)
            var life: float = grow * collapse
            var start_x := side * (10.0 + b * 8.0)
            var tip_x := side * (42.0 + b * 19.0) * (0.5 + 0.5 * grow)
            var height := (67.0 + b * 13.0) * life
            var path: Array[Vector2] = []
            for n in range(9):
                var u := float(n) / 8.0
                var x := lerpf(start_x, tip_x, u)
                var y := -height * sin(u * PI * 0.56) + u * u * 5.0
                path.append(Vector2(roundf(x), roundf(y)))
            var left: Array[Vector2] = []
            var right: Array[Vector2] = []
            for n in range(path.size()):
                var tangent := path[mini(n + 1, 8)] - path[maxi(n - 1, 0)]
                var normal := Vector2(-tangent.y, tangent.x).normalized()
                var u := float(n) / 8.0
                var width := (2.0 + (6.0 + b) * sin(PI * u)) * life
                left.append(path[n] + normal * width)
                right.push_front(path[n] - normal * width)
            var surface := PackedVector2Array(left + right)
            draw_colored_polygon(surface, _ink(BLUE if band == 0 else WATER, life * (0.95 - b * 0.1)))
            # Lighter inner water facets make the fan read as moving liquid,
            # while separated white squares define the splashing crest.
            for n in range(1, 8):
                var point := path[n]
                if (n + band) % 3 != 0:
                    draw_rect(Rect2(roundf(point.x), roundf(point.y), 2.0 + float(band), 3.0), _ink(CREST, life))
                if n > 4 and (n + band) % 2 == 0:
                    draw_rect(Rect2(roundf(point.x + side * 2.0), roundf(point.y - 3.0), 3.0, 2.0), _ink(FOAM, life))
            var tip := path[8]
            draw_rect(Rect2(roundf(tip.x), roundf(tip.y - 1.0), 4.0, 3.0), _ink(WHITE, life))
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

## One live ARCANA Fusion20 cast. Owns source-time state and three pass
## painters: GROUND (z<actors: cracks/scorch/residue), AIR (this node:
## authored FX geometry), LIGHT (additive glow child). Emits visual contact
## and body cues only — combat authority stays with SOH (PR #30 / R4).
## Timelines/durations/climax come from Arcana20SourceCatalog (PR #28).
extends Arcana20Primitives
class_name Arcana20SkillInstance

signal visual_contact(skill_id: int, world_position: Vector2, kind: StringName)
signal body_event_cue(skill_id: int, world_position: Vector2, element: StringName)
signal cast_finished(skill_id: int)

var skill_id: int = 0
var element: String = "astral"
var duration: float = 0.0
var climax: float = 0.0
var origin: Vector2 = Vector2.ZERO
var target: Vector2 = Vector2.ZERO
var facing: float = 1.0
var elapsed: float = 0.0
var source_tick: int = 0
var active: bool = false

var _rng := RandomNumberGenerator.new()
var _contact_done := false
var _ground: Node2D
var _light: Node2D
var _nodes: Array = []      # authored choreography nodes (per-skill build)
var _strokes: Array = []    # calligraphy / script paths
var _max_draw_ms := 0.0

func setup(id: int, caster_world: Vector2, target_world: Vector2, face: float) -> void:
    skill_id = id
    var slot := Arcana20SourceCatalog.slot(id)
    element = String(slot.get("school", "astral"))
    # school -> element ramp key (catalogue schools: fire/water/volt/verdant/astral; 07 is ice-led C)
    if id == 7:
        element = "ice"
    elif element == "fire":
        element = "fire"
    duration = float(slot.get("duration", 8.0))
    if duration <= 0.0:
        duration = 9.0 # D#19 timeline not yet ported; candidate duration, flagged in status registry
    climax = float(slot.get("climax", duration * 0.6))
    if climax <= 0.0:
        climax = duration * 0.68
    origin = caster_world
    target = target_world
    facing = face
    _rng.seed = 1000 + id * 77
    _build()
    _ground = Arcana20PassPainter.new()
    _ground.host = self
    _ground.pass_kind = 0
    _ground.z_index = -5
    _ground.z_as_relative = true
    add_child(_ground)
    _light = Arcana20PassPainter.new()
    _light.host = self
    _light.pass_kind = 1
    _light.z_index = 10
    _light.z_as_relative = true
    var mat := CanvasItemMaterial.new()
    mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
    _light.material = mat
    add_child(_light)

func begin() -> void:
    elapsed = 0.0
    source_tick = 0
    _contact_done = false
    active = true
    set_process(true)
    queue_redraw()

func cancel() -> void:
    if not active:
        return
    active = false
    set_process(false)
    queue_redraw()
    if _ground: _ground.queue_redraw()
    if _light: _light.queue_redraw()
    cast_finished.emit(skill_id)

func _process(delta: float) -> void:
    if not active:
        return
    elapsed += maxf(delta, 0.0)
    source_tick = int(floor(elapsed * 60.0))
    if not _contact_done and elapsed >= climax:
        _contact_done = true
        visual_contact.emit(skill_id, target, &"source_climax")
        body_event_cue.emit(skill_id, target, StringName(element))
    if elapsed >= duration:
        active = false
        set_process(false)
        cast_finished.emit(skill_id)
    queue_redraw()
    if _ground: _ground.queue_redraw()
    if _light: _light.queue_redraw()

func phase_name() -> StringName:
    return Arcana20SourceCatalog.phase(skill_id, elapsed)

# ---------------------------------------------------------------------------
# Per-skill authored builds (positions relative to origin/target, world px)
# ---------------------------------------------------------------------------
func _build() -> void:
    _nodes.clear()
    _strokes.clear()
    var to_target := target - origin
    match skill_id:
        1: # Cinder Crown A+C: crown of flame pillars around target
            for i in range(7):
                var a := TAU * float(i) / 7.0
                _nodes.append({"p": target + Vector2(cos(a) * 46.0, sin(a) * 46.0 * 0.62), "seed": i})
        3: # Meteor Loom B: meteor lanes woven over target area
            for i in range(9):
                var sx := origin.x - 120.0 + float(i) * 26.0 + _rng.randf_range(-8.0, 8.0)
                _nodes.append({"from": Vector2(sx, origin.y - 190.0), "to": target + Vector2(_rng.randf_range(-52.0, 52.0), _rng.randf_range(-18.0, 18.0)), "delay": float(i) * 0.16, "seed": i})
        4: # Ashen Guillotine REDESIGN: diagonal slit -> blade -> one cut
            _nodes.append({"a": target + Vector2(-64.0, -58.0), "b": target + Vector2(64.0, 40.0)})
        5: # Abyssal Bloom A+C: layered bloom petals
            for i in range(8):
                _nodes.append({"a": TAU * float(i) / 8.0, "seed": i})
        6: # Riptide Calligraphy REDESIGN: glyph stroke path with moving tip
            var base := target + Vector2(-52.0, -26.0)
            _strokes = [base, base + Vector2(34, -30), base + Vector2(62, 4), base + Vector2(30, 30), base + Vector2(66, 34), base + Vector2(100, -8)]
        7: # Mirrorfrost Basilica C: pillars + arch
            for i in range(5):
                _nodes.append({"p": target + Vector2(-64.0 + float(i) * 32.0, 0.0), "h": 54.0 + float(i % 2) * 22.0, "seed": i})
        8: # Undertow Maw B: vortex rings + maw
            for i in range(6):
                _nodes.append({"r": 14.0 + float(i) * 11.0, "seed": i})
        9: # Chain Verdict A+B+C: chained nodes with bolts
            var p := origin
            for i in range(5):
                p = p.lerp(target, 0.22) + Vector2(_rng.randf_range(-14.0, 14.0), _rng.randf_range(-20.0, 6.0))
                _nodes.append({"p": p, "seed": i})
            _nodes.append({"p": target, "seed": 9})
        10: # Thunderloom C: woven vertical bolts
            for i in range(6):
                var x := target.x - 55.0 + float(i) * 22.0
                _nodes.append({"from": Vector2(x, target.y - 150.0), "to": Vector2(x + _rng.randf_range(-8.0, 8.0), target.y), "seed": i})
        11: # Volt Carousel A+C09: rotating arc anchors
            for i in range(6):
                _nodes.append({"a": TAU * float(i) / 6.0, "seed": i})
        12: # Skybreaker Script REDESIGN: sky glyph -> causal strikes
            var base := target + Vector2(-48.0, -120.0)
            _strokes = [base, base + Vector2(30, 18), base + Vector2(58, -6), base + Vector2(88, 20)]
            for i in range(4):
                _nodes.append({"x": target.x - 42.0 + float(i) * 28.0, "seed": i})
        13: # Rootwake REDESIGN: directed root growth from caster to target
            var p := origin
            var dir := (target - origin).normalized()
            var side := Vector2(-dir.y, dir.x)
            for i in range(7):
                p += dir * (to_target.length() / 7.0) + side * _rng.randf_range(-16.0, 16.0)
                _nodes.append({"p": p, "seed": i})
        14: # Spore Nebula REDESIGN: causal fungal network nodes
            for i in range(11):
                _nodes.append({"p": target + Vector2(_rng.randf_range(-70.0, 70.0), _rng.randf_range(-34.0, 26.0)), "seed": i})
        15: # Thorn Opera C: thorn arcs in staged acts
            for i in range(9):
                var a := PI * (0.15 + 0.7 * float(i) / 8.0)
                _nodes.append({"a": a, "r": 34.0 + float(i % 3) * 15.0, "seed": i})
        16: # Worldseed A+C: seed -> trunk -> canopy
            for i in range(8):
                _nodes.append({"a": -PI * 0.85 + PI * 0.7 * float(i) / 7.0, "seed": i})
        17: # Event Horizon C: accretion disc + singularity
            for i in range(7):
                _nodes.append({"r": 12.0 + float(i) * 9.0, "seed": i})
        18: # Chronoshard REDESIGN: authored time fractures (crystal shards)
            for i in range(8):
                var a := TAU * float(i) / 8.0
                _nodes.append({"p": target + Vector2(cos(a) * 44.0, sin(a) * 44.0 * 0.62), "a": a, "seed": i})
        19: # Constellation Engine D: star graph that assembles then fires
            for i in range(8):
                var a := TAU * float(i) / 8.0 + 0.3
                _nodes.append({"p": target + Vector2(cos(a) * (38.0 + float(i % 3) * 13.0), sin(a) * 30.0 - 24.0), "seed": i})
        20: # Reality Ripper A+C: crossing reality slashes
            _nodes.append({"a": target + Vector2(-58.0, -44.0), "b": target + Vector2(58.0, 30.0)})
            _nodes.append({"a": target + Vector2(-52.0, 34.0), "b": target + Vector2(62.0, -38.0)})

# ---------------------------------------------------------------------------
# Passes
# ---------------------------------------------------------------------------
func draw_pass(kind: int, cv: Arcana20Primitives) -> void:
    if kind == 0:
        draw_ground_pass(cv)
    else:
        draw_light_pass(cv)

func draw_ground_pass(cv: Arcana20Primitives) -> void:
    if not active:
        return
    var t := elapsed
    var local_target := to_local(target)
    var after := smooth(climax, climax + 0.4, t) * (1.0 - smooth(duration - 1.2, duration, t) * 0.7)
    if after <= 0.0:
        return
    # Scorched/cracked local ground scar (never a pasted arena).
    cv.disc(local_target, 15.0 + 8.0 * after, Color(0.02, 0.015, 0.015, 0.55 * after))
    var crack_rng := RandomNumberGenerator.new()
    crack_rng.seed = 5000 + skill_id
    for k in range(7):
        var a := TAU * float(k) / 7.0 + crack_rng.randf_range(-0.2, 0.2)
        var end := local_target + Vector2(cos(a), sin(a) * 0.6) * (18.0 + 22.0 * after + crack_rng.randf_range(0.0, 10.0))
        cv.stroke(local_target, end, 1.0, Color(0.05, 0.03, 0.02, 0.6 * after))
        cv.stroke(local_target, end, 1.0, ramp_color(element, 0.35 + 0.5 * after, 0.5 * after * (1.0 - smooth(climax + 1.5, duration, t))))

func draw_light_pass(cv: Arcana20Primitives) -> void:
    if not active:
        return
    var t := elapsed
    var lt := to_local(target)
    var lo := to_local(origin)
    var pulse := 0.25 + 0.75 * smooth(climax - 0.4, climax + 0.15, t) * (1.0 - smooth(duration - 0.8, duration, t))
    cv.disc(lt, 26.0, ramp_color(element, 0.75, 0.20 * pulse))
    cv.disc(lt, 13.0, ramp_color(element, 0.95, 0.30 * pulse))
    cv.disc(lo, 10.0, ramp_color(element, 0.6, 0.18 * pulse))

func _draw() -> void:
    if not active:
        return
    var start_us := Time.get_ticks_usec()
    var t := elapsed
    var lt := to_local(target)
    var lo := to_local(origin)
    var open_u := smooth(0.0, climax - 0.5, t)          # anticipation/travel
    var peak := smooth(climax - 0.5, climax + 0.2, t) * (1.0 - smooth(duration - 1.0, duration, t))
    var fade := 1.0 - smooth(duration - 0.9, duration, t)
    match skill_id:
        1:
            for n in _nodes:
                var p: Vector2 = to_local(n.p)
                var h := (26.0 + 14.0 * peak) * open_u
                for k in range(int(h)):
                    px(p + Vector2(sin(t * 9.0 + float(n.seed) * 3.0) * 2.0 * (float(k) / h), -float(k)), ramp_color("fire", 0.45 + 0.5 * (float(k) / h), fade))
                ring(p, 7.0, ramp_color("fire", 0.7, 0.8 * fade))
            ring(lt, 46.0 * open_u, ramp_color("fire", 0.85, fade))
        3:
            for n in _nodes:
                var u := clampf((t - 0.7 - float(n.delay)) / 1.1, 0.0, 1.0)
                if u <= 0.0 or u >= 1.0:
                    continue
                var head: Vector2 = to_local(Vector2(n.from).lerp(n.to, ease_in(u)))
                var tail := head + Vector2(10.0, 26.0)
                stroke(tail, head, 2.0, ramp_color("fire", 0.8, fade))
                disc(head, 3.0, ramp_color("fire", 0.95, fade))
            for i in range(3):
                stroke(lo + Vector2(-30.0 + float(i) * 30.0, -8.0), lt + Vector2(-30.0 + float(i) * 30.0, -20.0), 1.0, ramp_color("fire", 0.55, 0.5 * open_u * fade))
        4:
            var n = _nodes[0]
            var a: Vector2 = to_local(n.a)
            var b: Vector2 = to_local(n.b)
            if t < climax - 0.3:
                stroke(a, b, 1.0, Color(1, 1, 1, 0.35 * open_u)) # slit anticipation
            elif t < climax + 0.12:
                stroke(a + Vector2(-6, -20), b + Vector2(6, 14), 5.0, ramp_color("fire", 0.9, fade)) # the one cut
            else:
                stroke(a, b, 2.0, ramp_color("fire", 0.6, 0.7 * fade))
        5:
            for n in _nodes:
                var a: float = n.a
                var r := 12.0 + 30.0 * open_u
                var p := lt + Vector2(cos(a) * r, sin(a) * r * 0.62)
                disc(p, 5.0 + 4.0 * peak, ramp_color("water", 0.55 + 0.3 * sin(t * 3.0 + a), fade))
            ring(lt, 20.0 + 26.0 * open_u, ramp_color("water", 0.8, fade), 0.62)
            disc(lt, 6.0, ramp_color("water", 0.95, fade))
        6, 12:
            var total := 0.0
            var pts: Array = []
            for p in _strokes:
                pts.append(to_local(p))
            for i in range(pts.size() - 1):
                total += pts[i].distance_to(pts[i + 1])
            var draw_len := total * clampf(t / maxf(0.1, climax), 0.0, 1.0)
            var acc := 0.0
            var tip := pts[0]
            for i in range(pts.size() - 1):
                var seg := pts[i].distance_to(pts[i + 1])
                if acc + seg <= draw_len:
                    stroke(pts[i], pts[i + 1], 2.0, ramp_color(element, 0.8, fade))
                    tip = pts[i + 1]
                elif acc < draw_len:
                    tip = pts[i].lerp(pts[i + 1], (draw_len - acc) / seg)
                    stroke(pts[i], tip, 2.0, ramp_color(element, 0.9, fade))
                acc += seg
            disc(tip, 3.0, ramp_color(element, 1.0, fade))
            if skill_id == 12 and t >= climax:
                for n in _nodes:
                    bolt(Vector2(to_local(Vector2(n.x, target.y - 130.0)).x, lt.y - 130.0), Vector2(to_local(Vector2(n.x, target.y)).x, lt.y), ramp_color("volt", 0.9, fade), 5.0, _rng, 1.5)
        7:
            for n in _nodes:
                var p: Vector2 = to_local(n.p)
                var h: float = n.h * open_u
                for k in range(int(h)):
                    px(p + Vector2(0, -float(k)), ramp_color("ice", 0.5 + 0.4 * (float(k) / h), fade), 3.0 if k % 5 == 0 else 2.0)
            stroke(to_local(_nodes[0].p) + Vector2(0, -float(_nodes[0].h) * open_u), to_local(_nodes[4].p) + Vector2(0, -float(_nodes[4].h) * open_u), 2.0, ramp_color("ice", 0.85, fade))
            ring(lt, 66.0, ramp_color("ice", 0.7, 0.6 * fade))
        8:
            for n in _nodes:
                ring(lt, float(n.r) * (0.7 + 0.3 * sin(t * 2.0 + float(n.seed))), ramp_color("water", 0.6, 0.7 * fade))
            var jaw := 6.0 + 10.0 * peak
            stroke(lt + Vector2(-16, 4), lt + Vector2(0, jaw), 3.0, ramp_color("water", 0.85, fade))
            stroke(lt + Vector2(16, 4), lt + Vector2(0, jaw), 3.0, ramp_color("water", 0.85, fade))
        9, 10, 11:
            if skill_id == 9:
                var prev := lo
                for n in _nodes:
                    var p: Vector2 = to_local(n.p)
                    if t > 0.4:
                        bolt(prev, p, ramp_color("volt", 0.85, fade), 4.0, _rng, 1.5)
                    disc(p, 3.0, ramp_color("volt", 0.95, fade))
                    prev = p
            elif skill_id == 10:
                for n in _nodes:
                    if t > 0.3:
                        bolt(to_local(n.from), to_local(n.to), ramp_color("volt", 0.8, fade), 6.0, _rng, 1.5)
                stroke(lt + Vector2(-55, 0), lt + Vector2(55, 0), 1.0, ramp_color("volt", 0.6, 0.6 * fade))
            else:
                var prev2: Vector2 = Vector2.ZERO
                for i in range(_nodes.size()):
                    var n = _nodes[i]
                    var a: float = float(n.a) + t * 1.4
                    var p := lt + Vector2(cos(a) * 40.0, sin(a) * 40.0 * 0.62)
                    disc(p, 3.5, ramp_color("volt", 0.9, fade))
                    if i > 0:
                        bolt(prev2, p, ramp_color("volt", 0.7, 0.8 * fade), 3.0, _rng, 1.0)
                    prev2 = p
                ring(lt, 40.0, ramp_color("volt", 0.6, 0.5 * fade))
        13:
            var prev := lo
            for i in range(_nodes.size()):
                var n = _nodes[i]
                var p: Vector2 = to_local(n.p)
                if t > 0.3 + float(i) * 0.22:
                    stroke(prev, p, 3.0 - float(i) * 0.2, ramp_color("verdant", 0.55, fade))
                    disc(p, 2.5, ramp_color("verdant", 0.75, fade))
                prev = p
        14:
            for i in range(_nodes.size()):
                var n = _nodes[i]
                var p: Vector2 = to_local(n.p)
                var grow := smooth(0.4 + float(i) * 0.16, 1.6 + float(i) * 0.16, t)
                if grow > 0.0:
                    disc(p, 2.0 + 3.0 * grow, ramp_color("verdant", 0.65 + 0.3 * sin(t * 4.0 + float(i)), fade))
                    if i > 0:
                        stroke(to_local(_nodes[i - 1].p), p, 1.0, ramp_color("verdant", 0.5, 0.7 * fade * grow))
            disc(lt, 5.0, ramp_color("verdant", 0.9, 0.8 * fade))
        15:
            for n in _nodes:
                var a: float = n.a
                var dir := Vector2(cos(a), -sin(a))
                var base := lt + Vector2(-cos(a) * 8.0, 6.0)
                var tip := base + dir * float(n.r) * open_u
                stroke(base, tip, 2.0, ramp_color("verdant", 0.6, fade))
                px(tip, ramp_color("verdant", 0.95, fade), 2.0)
            ring(lt, 30.0 + 8.0 * peak, ramp_color("verdant", 0.7, 0.6 * fade))
        16:
            var trunk_h := 52.0 * open_u
            stroke(lt + Vector2(0, 4), lt + Vector2(0, -trunk_h), 3.0, ramp_color("verdant", 0.45, fade))
            for n in _nodes:
                var a: float = n.a
                var bp := lt + Vector2(0, -trunk_h)
                var tip := bp + Vector2(cos(a) * 30.0, sin(a) * 18.0)
                stroke(bp, tip, 1.5, ramp_color("verdant", 0.6, fade))
                disc(tip, 3.0 + 2.0 * peak, ramp_color("verdant", 0.85, fade))
            disc(lt, 4.0 + 3.0 * peak, ramp_color("verdant", 0.95, fade))
        17:
            disc(lt, 7.0, Color(0, 0, 0, 0.95))
            for n in _nodes:
                var r: float = n.r
                var steps := 26
                for i in range(steps):
                    var a := TAU * float(i) / float(steps) + t * (0.9 - r * 0.006)
                    px(lt + Vector2(cos(a) * r, sin(a) * r * 0.4), ramp_color("astral", 0.55 + 0.4 * (float(i % 5) / 5.0), fade))
            ring(lt, 16.0 + 4.0 * sin(t * 2.4), ramp_color("astral", 0.95, fade), 0.4)
        18:
            for n in _nodes:
                var p: Vector2 = to_local(n.p)
                var a: float = n.a
                var dir := Vector2(cos(a), sin(a))
                var perp := Vector2(-dir.y, dir.x)
                var sz := (5.0 + 7.0 * peak)
                stroke(p - dir * sz, p + dir * sz, 2.0, ramp_color("ice", 0.8, fade))
                stroke(p - perp * sz * 0.4, p + perp * sz * 0.4, 1.5, ramp_color("astral", 0.85, fade))
            ring(lt, 30.0 + 14.0 * peak, ramp_color("astral", 0.7, 0.7 * fade))
        19:
            var prev := Vector2.ZERO
            for i in range(_nodes.size()):
                var n = _nodes[i]
                var p: Vector2 = to_local(n.p)
                var lit_u := smooth(0.3 + float(i) * 0.24, 0.9 + float(i) * 0.24, t)
                if lit_u > 0.0:
                    disc(p, 2.0 + 2.0 * lit_u, ramp_color("astral", 0.95, fade))
                    if i > 0:
                        stroke(prev, p, 1.0, ramp_color("astral", 0.75, 0.8 * fade * lit_u))
                prev = p
            if t >= climax:
                bolt(lt + Vector2(0, -24), lt, ramp_color("astral", 1.0, fade), 3.0, _rng, 2.0)
        20:
            for n in _nodes:
                var a: Vector2 = to_local(n.a)
                var b: Vector2 = to_local(n.b)
                var u := clampf(t / maxf(0.1, climax), 0.0, 1.0)
                stroke(a, a.lerp(b, u), 3.0, ramp_color("astral", 0.9, fade))
                stroke(a + Vector2(2, 2), a.lerp(b, u) + Vector2(2, 2), 1.0, Color(1, 1, 1, 0.7 * fade))
            disc(lt, 4.0 + 6.0 * peak, ramp_color("astral", 1.0, fade))
    _max_draw_ms = maxf(_max_draw_ms, float(Time.get_ticks_usec() - start_us) / 1000.0)

func diagnostics() -> Dictionary:
    return {"skill_id": skill_id, "canonical_id": String(Arcana20SourceCatalog.canonical_id(skill_id)),
        "elapsed": elapsed, "source_tick": source_tick, "phase": String(phase_name()),
        "active": active, "contact_emitted": _contact_done, "max_draw_ms": _max_draw_ms}

## A20 displaced-ground debris, fused onto the selected C20 rift contour.
## Original A RNG, spawn/drag/lifetime and bilinear additive splats are kept;
## the 27 A path indices are mapped to the ONE selected C contour, not drawn
## as a second tear. A's clock is retimed through the existing fusion mapping.
## The source colors are live-world samples, never Gold's demo floor.
extends RefCounted
class_name ARealityRipperDebris

const STEP := 1.0 / 60.0
var rng: AMath.ARng
var particles: Array[Dictionary] = []
var tick := 0

func setup() -> void:
    rng = AMath.ARng.new(0x7ea4)
    # Original A constructor consumes 27 x/y path jitters and 64 bands.
    for i in range(27):
        rng.rangef(-5.0, 5.0)
        rng.rangef(-7.0, 7.0)
    for i in range(64):
        rng.rangef(0.0, 1.0)
        rng.rangef(-1.0, 1.0)
        rng.intf(0, 9999)
    particles.clear()
    tick = 0

func advance_to(source_time: float, contour: Callable) -> void:
    var target := floori(source_time * 60.0 + 0.000001)
    while tick < target:
        tick += 1
        var t := float(tick) * STEP
        if t > 5.3 and t < 5.7 and particles.size() < 320:
            for i in range(24):
                var u := rng.next()
                var anchor: Dictionary = contour.call(float(floori(u * 26.0)) / 26.0)
                var angle := rng.angle()
                var speed := rng.rangef(60.0, 340.0)
                var life := rng.rangef(0.5, 1.8)
                var size := rng.intf(1, 4)
                var seed := rng.intf(0, 9999)
                var k := rng.next()
                particles.append({"x": float(anchor.x), "y": float(anchor.y),
                    "px": float(anchor.x), "py": float(anchor.y),
                    "vx": cos(angle) * speed, "vy": sin(angle) * speed / 1.4,
                    "life": life, "max": life, "size": size, "seed": seed, "k": k})
        var retained: Array[Dictionary] = []
        for p in particles:
            p.px = p.x
            p.py = p.y
            p.vx = float(p.vx) * exp(-1.8 * STEP)
            p.vy = float(p.vy) * exp(-1.8 * STEP)
            p.x = float(p.x) + float(p.vx) * STEP
            p.y = float(p.y) + float(p.vy) * STEP
            p.life = float(p.life) - STEP
            if float(p.life) > 0.0: retained.append(p)
        particles = retained

func render(frame: CFrame) -> void:
    if not frame.track_world_fragments: return
    for p in particles:
        var life := float(p.life) / float(p.max)
        var sx := floori(float(p.px) + 0.5)
        var sy := floori(float(p.py) + 0.5)
        var gain := (2.2 + float(p.k) * 3.4) * life
        for yy in range(int(p.size)):
            for xx in range(int(p.size)):
                frame.add_live_world_light(float(p.x) + xx, float(p.y) + yy,
                    clampi(sx + xx, 0, CFrame.W - 1), clampi(sy + yy, 0, CFrame.H - 1), gain)
        if float(p.k) > 0.6:
            var c := ACommon.ramp_step("astral", 0.55 + life * 0.4, 9.0)
            frame.add_bilinear_light(float(p.x), float(p.y), Vector3(c.x * 0.5, c.y * 0.5, c.z * 0.6) * life * 0.8)

## Selected C16 original seed/spore/petal burst. This is not the complete C16
## spell: the A-led fusion already owns growth, while its C-authored living
## environment, post, and full OUT still need independent comparison.
## Source: C/src/spells/verdant.ts Worldseed, with the original update order.
extends RefCounted
class_name CWorldseedDebris

const DURATION := 10.2
const BURST := 7.6
const C := Vector2(244, 106)
const SYW := 0.78
const SEED := 119785 # original Stage: 1000 + index 15 * 7919
var rng: CMath.CRng
var particles: Array = []
var burst := false
var fx_shake := 0.0
var fx_flash := Vector3.ZERO
var fx_flash_k := 0.0
var fx_kick := 0.0

func setup() -> void:
    CPalette._ensure()
    rng = CMath.CRng.new(SEED)
    particles.clear()
    burst = false
    # The original allocates seven branching membrane trees and fourteen motes
    # before any particles. Consume the exact source RNG sequence even though
    # this selected role does not draw those other primitives.
    for k in range(7):
        CKit.grow_tree(rng, {"x": C.x, "y": C.y, "ang": (float(k) + 0.5) / 7.0 * CMath.TAU + 0.2,
            "step": 4, "steps": 11, "speed": 22, "branch": 0.45, "spread": 0.45,
            "jitter": 0.25, "maxDepth": 2, "t0": 3.4, "sy": SYW})
    for i in range(14):
        rng.r(0, CMath.TAU)
        rng.r(8, 22)
        rng.r(0.3, 0.9)
        rng.sign()
        rng.r(-6, 6)

func source_seeds() -> PackedInt32Array:
    return PackedInt32Array([SEED])

func authored_events() -> Array:
    return [] # This selected visual does not assert combat contact.

func update(dt: float, t: float) -> void:
    CKit.particles_update(particles, dt)
    if not burst and t >= BURST:
        burst = true
        fx_shake = 4.0
        fx_flash = Vector3(1.0, 0.9, 0.5)
        fx_flash_k = 0.3
        fx_kick = 1.5
        for i in range(420):
            var a := rng.r(0, CMath.TAU)
            var speed := rng.r(15, 130)
            particles.append(CKit.pt_defaults({"x": C.x, "y": C.y,
                "vx": cos(a) * speed - sin(a) * speed * 0.4,
                "vy": (sin(a) * speed + cos(a) * speed * 0.4) * 0.75,
                "drag": 1.1, "kind": "spore", "col": CPalette.P.gold,
                "c": CPalette.ramp(CPalette.P.gold, 0.9), "max": rng.r(1.6, 3.2), "k": 0.9}))
        for i in range(90):
            var a := rng.r(0, CMath.TAU)
            var speed := rng.r(20, 90)
            particles.append(CKit.pt_defaults({"x": C.x, "y": C.y + 10, "z": 10,
                "vx": cos(a) * speed, "vy": sin(a) * speed * 0.7,
                "vz": rng.r(10, 50), "grav": 14, "drag": 1, "spin": rng.r(-8, 8),
                "kind": "petal", "col": CPalette.P.bloom, "max": rng.r(2, 3.5), "k": 1}))
        for i in range(26):
            var a := rng.r(0, CMath.TAU)
            var speed := rng.r(14, 60)
            particles.append(CKit.pt_defaults({"x": C.x, "y": C.y,
                "vx": cos(a) * speed, "vy": sin(a) * speed * 0.7, "drag": 0.55,
                "kind": "seed", "c": Vector3(0.85, 1, 0.55), "max": rng.r(3.5, 5.5), "k": 1.3}))

func render(frame: CFrame, _t: float) -> void:
    CKit.particles_render(frame, particles)

class_name GoldMulberry32Rng
extends RefCounted

## Source-ported Mulberry32: Venomwright src/game/pixel.ts Rng.next()
## and ARCANA III src/engine/util.ts rand().
## Identical primitive, but per-family seed ownership/call-order is NOT interchangeable.
const MASK: int = 0xFFFFFFFF
const DENOM: float = 4294967296.0
var state: int = 1

func _init(source_seed: int = 1) -> void:
    reseed(source_seed)

func reseed(source_seed: int, arcana_zero_seed_policy: bool = false) -> void:
    state = source_seed & MASK
    if arcana_zero_seed_policy and state == 0:
        state = 1

static func _imul32(a: int, b: int) -> int:
    # Avoid int64 overflow; JS Math.imul multiplies only low 32 bits.
    var al: int = a & 0xFFFF
    var ah: int = (a >> 16) & 0xFFFF
    var bl: int = b & 0xFFFF
    var bh: int = (b >> 16) & 0xFFFF
    return (al * bl + (((ah * bl + al * bh) & 0xFFFF) << 16)) & MASK

func next() -> float:
    state = (state + 0x6D2B79F5) & MASK
    var t: int = state
    t = _imul32(t ^ (t >> 15), t | 1)
    t = (t ^ ((t + _imul32(t ^ (t >> 7), t | 61)) & MASK)) & MASK
    return float((t ^ (t >> 14)) & MASK) / DENOM

func range_between(a: float, b: float) -> float:
    return a + (b - a) * next()

func int_below(n: int) -> int:
    return int(floor(next() * float(n)))

func sign_value() -> int:
    return -1 if next() < 0.5 else 1

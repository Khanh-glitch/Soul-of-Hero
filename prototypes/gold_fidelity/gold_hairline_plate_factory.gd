class_name GoldHairlinePlateFactory
extends RefCounted

## Exact parameters captured from the unmodified Gold #01 factory, seed=0x20261027.
## Columns: x0, x1, direction, height, skew, delay, mask, plate seed.
## For production casts, extract a fresh seed stream from the original skill
## generator; do not repeat the same randomized appearance on every cast.
const PLATES = [[106,155.10230092983693,-1,57.484566318802536,-13.300905108451843,0.1357362124370411,0,0.7349516882095486],[108.33861966058612,155.10230092983693,1,48.0211564945057,6.9987661093473434,0.11917815485503525,0,0.3763015696313232],[143,191.0625855089271,-1,51.024596698,-9.7965022624,0.26836809854,0,0.53828315553],[137.06636956,191.0625855089271,1,40.803884202,-9.187760219,0.14039700839,0,0.41911714594],[180,224.03411752,-1,35.106827582,-1.3814639449,0.28388691146,0,0.45310655632],[179.12072949,224.03411752,1,51.222166163,-10.580308333,0.035869902349,0,0.53359623603],[217,264.10839008,-1,45.016198738,-15.068493098,0.2632518044,2,0.54466346581],[213.29803754,264.10839008,1,57.447378607,-4.0172037333,0.070405896823,0,0.79712068918],[254,301.51227994,-1,30.348425689,-9.279838562,0.26504758664,2,0.73882549466],[256.91072979,301.51227994,1,37.792850276,-6.0402631313,0.28655262308,2,0.075894528767],[291,338.7656402,-1,42.921376667,-1.0211232007,0.17304942089,2,0.76270708186],[287.89793609,338.7656402,1,34.443598756,-7.0529975742,0.044690277684,2,0.25706065143],[328,371.16897126,-1,41.901293318,-8.1489220262,0.029236739245,2,0.55500485026],[330.21341944,371.16897126,1,31.932160554,-15.82256557,0.22123108541,0,0.88023158885]]
const CREATED_AT := 0.9833333333333333
const LIFE := 1.55
const FADE_START := 0.9

static func vertices_at(index: int, world_time: float) -> PackedVector2Array:
    var p: Array = PLATES[index]
    var x0: float = p[0]
    var x1: float = p[1]
    var dir: float = p[2]
    var h: float = p[3]
    var skew: float = p[4]
    var delay: float = p[5]
    var age := world_time - CREATED_AT
    var k := 1.0 - pow(1.0 - clampf((age - delay), 0.0, 1.0), 3.0)
    var yb := 141.0 + k * 15.0 * dir
    var hg := k * h
    if dir < 0.0:
        return PackedVector2Array([
            Vector2(x0 + skew * k, yb - hg),
            Vector2(x1 + skew * k, yb - hg * 0.78),
            Vector2(x1, yb), Vector2(x0, yb)
        ])
    return PackedVector2Array([
        Vector2(x0, yb), Vector2(x1, yb),
        Vector2(x1 + skew * k, yb + hg * 0.55),
        Vector2(x0 + skew * k, yb + hg * 0.5)
    ])

static func crack_at(index: int, world_time: float) -> float:
    var age := world_time - CREATED_AT
    var delay: float = PLATES[index][5]
    var k := 1.0 - pow(1.0 - clampf(age - delay, 0.0, 1.0), 3.0)
    return 0.1 + k * 0.7

static func opacity_at(world_time: float) -> float:
    var p := clampf((world_time - CREATED_AT) / LIFE, 0.0, 1.0)
    return 0.9 * (1.0 - (p - FADE_START) / (1.0 - FADE_START)) if p > FADE_START else 0.9

static func is_alive(world_time: float) -> bool:
    var age := world_time - CREATED_AT
    return age >= 0.0 and age < LIFE

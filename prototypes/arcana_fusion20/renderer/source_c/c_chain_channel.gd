## C tempest.ts #09 mk()/vars channel geometry, directed to the A field.
## The caller supplies the live endpoints, seed, source clock and palette.
## This is a connector-level adaptation, not a full C spell or world parity.
extends RefCounted
class_name CChainChannel

var raster := CBoltARaster.new()

func draw(fb: AFramebuffer, a: Vector2, b: Vector2, t: float, seed: float,
        k: float, core: Vector3, halo: Vector3, width: float = 1.6,
        rough: float = 0.32, branch_count: int = 5) -> void:
    var pts := CKit.bolt_pts(seed, a.x, a.y, b.x, b.y, rough, 3.0)
    var variant := posmod(floori(t * 30.0), 3)
    var varied: Array = []
    for j in range(pts.size()):
        var point: Vector2 = pts[j]
        if j != 0 and j != pts.size() - 1:
            point.x += (CMath.hash1(int(seed + variant * 31 + j)) - 0.5) * 3.0
            point.y += (CMath.hash1(int(seed + variant * 17 + j * 3)) - 0.5) * 3.0
        varied.append(point)
    raster.draw(fb, varied, k, core, halo, width)
    for branch_index in range(branch_count):
        var index := floori(CMath.hash1(int(seed + variant * 7 + branch_index * 13)) * float(pts.size() - 2)) + 1
        # Original C attaches to unvaried pts, not to the time-varied spine.
        var point: Vector2 = pts[clampi(index, 0, pts.size() - 1)]
        var angle := CMath.hash1(int(seed + branch_index * 5 + variant)) * CMath.TAU
        var length := 6.0 + CMath.hash1(int(seed + branch_index)) * 18.0
        var tree := CKit.bolt_tree(seed + variant * 100 + branch_index, point.x, point.y,
            point.x + cos(angle) * length, point.y + sin(angle) * length, 1, 0.35, 1)
        for branch in tree:
            raster.draw(fb, branch.pts, k * float(branch.w), core, halo, 1.0)

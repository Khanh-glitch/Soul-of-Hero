## C kit.ts drawBolt/ribbon raster directed into A's additive source field.
## This preserves the original per-stroke pixel-visit rule and C core/halo
## coverage; it does not claim full spell, post, color or actor-depth parity.
extends RefCounted
class_name CBoltARaster

var _mark := PackedInt32Array()
var _gen := 1

func _init() -> void:
    _mark.resize(AFramebuffer.W * AFramebuffer.H)
    _mark.fill(0)

func draw(fb: AFramebuffer, pts: Array, k: float, core: Vector3, halo: Vector3, width: float = 1.4, reveal: float = 1.0) -> void:
    if _mark.size() != fb.width * fb.height:
        _mark.resize(fb.width * fb.height)
        _mark.fill(0)
        _gen = 1
    if k <= 0.01:
        return
    var count := maxi(2, ceili(float(pts.size()) * CMath.cl01(reveal)))
    var sub := pts.slice(0, count)
    if sub.size() < 2:
        return
    _gen += 1
    var g := _gen
    var n := sub.size() - 1
    for i in range(n):
        var a: Vector2 = sub[i]
        var b: Vector2 = sub[i + 1]
        if width <= 0.0:
            continue
        var mw := width + 1.0
        var x0 := maxi(0, floori(minf(a.x, b.x) - mw))
        var x1 := mini(fb.width - 1, ceili(maxf(a.x, b.x) + mw))
        var y0 := maxi(0, floori(minf(a.y, b.y) - mw))
        var y1 := mini(fb.height - 1, ceili(maxf(a.y, b.y) + mw))
        var dx := b.x - a.x
        var dy := b.y - a.y
        var ll := dx * dx + dy * dy
        if ll == 0.0:
            ll = 1e-6
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                var idx := y * fb.width + x
                if _mark[idx] == g:
                    continue
                var px := float(x) + 0.5 - a.x
                var py := float(y) + 0.5 - a.y
                var u := CMath.cl01((px * dx + py * dy) / ll)
                var qx := px - dx * u
                var qy := py - dy * u
                var d := Vector2(qx, qy).length()
                if d <= width + 0.001 and width > 0.25:
                    _mark[idx] = g
                    var edge := d / maxf(width, 0.5)
                    if edge < 0.45:
                        fb.add_px(x, y, core.x * k * 1.3, core.y * k * 1.3, core.z * k * 1.3)
                    else:
                        fb.add_px(x, y, halo.x * k * (1.2 - edge), halo.y * k * (1.2 - edge), halo.z * k * (1.2 - edge))

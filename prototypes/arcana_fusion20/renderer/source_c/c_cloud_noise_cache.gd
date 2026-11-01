## Exact separable cache for source C's fixed-grid noise3 cloud. Hash values and
## interpolation remain CMath's original double-precision operations. A cache
## is local to one render/tick and never contains a scene or actor image.
extends RefCounted
class_name CCloudNoiseCache

const W := CFrame.W
const H := CFrame.H
var _x0 := PackedInt32Array()
var _x1 := PackedInt32Array()
var _y0 := PackedInt32Array()
var _y1 := PackedInt32Array()
var _u0 := PackedFloat64Array()
var _u1 := PackedFloat64Array()
var _v0 := PackedFloat64Array()
var _v1 := PackedFloat64Array()
var _grid0 := PackedFloat64Array()
var _grid1 := PackedFloat64Array()
var _grid_w0 := 0
var _grid_w1 := 0
var _weight := 0.0

func _init(z: float) -> void:
    var zi := floori(z)
    var zf := z - float(zi)
    _weight = zf * zf * (3.0 - 2.0 * zf)
    _x0.resize(W); _x1.resize(W); _u0.resize(W); _u1.resize(W)
    _y0.resize(H); _y1.resize(H); _v0.resize(H); _v1.resize(H)
    var xmin0 := floori(float(zi) * 17.13)
    var xmin1 := floori(float(zi + 1) * 17.13)
    var ymin0 := floori(float(zi) * 31.7)
    var ymin1 := floori(float(zi + 1) * 31.7)
    for x in range(W):
        var px0 := float(x) * 0.08 + float(zi) * 17.13
        var px1 := float(x) * 0.08 + float(zi + 1) * 17.13
        var ix0 := floori(px0); var ix1 := floori(px1)
        var fx0 := px0 - float(ix0); var fx1 := px1 - float(ix1)
        _x0[x] = ix0 - xmin0; _x1[x] = ix1 - xmin1
        _u0[x] = fx0 * fx0 * (3.0 - 2.0 * fx0)
        _u1[x] = fx1 * fx1 * (3.0 - 2.0 * fx1)
    for y in range(H):
        var py0 := float(y) * 0.12 + float(zi) * 31.7
        var py1 := float(y) * 0.12 + float(zi + 1) * 31.7
        var iy0 := floori(py0); var iy1 := floori(py1)
        var fy0 := py0 - float(iy0); var fy1 := py1 - float(iy1)
        _y0[y] = iy0 - ymin0; _y1[y] = iy1 - ymin1
        _v0[y] = fy0 * fy0 * (3.0 - 2.0 * fy0)
        _v1[y] = fy1 * fy1 * (3.0 - 2.0 * fy1)
    _grid_w0 = _x0[W - 1] + 2; _grid_w1 = _x1[W - 1] + 2
    var h0 := _y0[H - 1] + 2; var h1 := _y1[H - 1] + 2
    _grid0.resize(_grid_w0 * h0); _grid1.resize(_grid_w1 * h1)
    for y in range(h0):
        for x in range(_grid_w0): _grid0[y * _grid_w0 + x] = CMath.hash2(xmin0 + x, ymin0 + y)
    for y in range(h1):
        for x in range(_grid_w1): _grid1[y * _grid_w1 + x] = CMath.hash2(xmin1 + x, ymin1 + y)

func value(x: int, y: int) -> float:
    var i0 := _y0[y] * _grid_w0 + _x0[x]
    var a0 := _grid0[i0]; var b0 := _grid0[i0 + 1]
    var c0 := _grid0[i0 + _grid_w0]; var d0 := _grid0[i0 + _grid_w0 + 1]
    var u0 := _u0[x]; var v0 := _v0[y]
    var n0 := a0 + (b0 - a0) * u0 + (c0 - a0) * v0 + (a0 - b0 - c0 + d0) * u0 * v0
    var i1 := _y1[y] * _grid_w1 + _x1[x]
    var a1 := _grid1[i1]; var b1 := _grid1[i1 + 1]
    var c1 := _grid1[i1 + _grid_w1]; var d1 := _grid1[i1 + _grid_w1 + 1]
    var u1 := _u1[x]; var v1 := _v1[y]
    var n1 := a1 + (b1 - a1) * u1 + (c1 - a1) * v1 + (a1 - b1 - c1 + d1) * u1 * v1
    return n0 + (n1 - n0) * _weight

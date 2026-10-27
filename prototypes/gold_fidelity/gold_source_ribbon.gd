class_name GoldSourceRibbon
extends MeshInstance2D

## Source translation of World.Ribbon.draw() in top-down-sword-vfx-laboratory
## src/engine/world.ts. Native 480x270 logical coordinates; no sprite baking.
## One strip -> two original triangles with matching world-length UVs.
const RIBBON_SHADER = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gdshader")
var source_points: PackedVector2Array = PackedVector2Array()
var source_width := 1.5
var source_width_multiplier := 1.0
var source_profile := 2
var source_style := 4
var source_seed := 0.7349516882
var source_extra := 1.0
var source_heat := 1.0
var source_crust := 0.0
var source_transparency := 0.7
var source_wobble := 0.0
var source_wobble_frequency := 50.0
var source_age := 0.0
var source_world_time := 0.0
var source_life := 3.6
var source_end_age := 0.0
var source_live := true
var source_cut := 0.0
var source_reveal := 1.0
var source_alpha := 1.0
var source_fade_mode := 0
var source_last_triangles := 0
var ribbon_material: ShaderMaterial

func _ready() -> void:
    ribbon_material = ShaderMaterial.new()
    ribbon_material.shader = RIBBON_SHADER
    material = ribbon_material
    texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
    z_index = 5
    rebuild()

func configure(opts: Dictionary) -> void:
    source_width = float(opts.get("w",source_width))
    source_width_multiplier = float(opts.get("wMul",source_width_multiplier))
    source_profile = int(opts.get("wprof",source_profile))
    source_style = int(opts.get("style",source_style))
    source_seed = float(opts.get("seed",source_seed))
    source_extra = float(opts.get("extra",source_extra))
    source_heat = float(opts.get("heat",source_heat))
    source_crust = float(opts.get("crust",source_crust))
    source_transparency = float(opts.get("tr",source_transparency))
    source_wobble = float(opts.get("wobble",source_wobble))
    source_wobble_frequency = float(opts.get("wobF",source_wobble_frequency))
    source_life = float(opts.get("life",source_life))
    source_cut = float(opts.get("cut",source_cut))
    source_reveal = float(opts.get("reveal",source_reveal))
    source_alpha = float(opts.get("alpha",source_alpha))
    source_fade_mode = int(opts.get("fadeMode",source_fade_mode))
    z_index = int(opts.get("layer",5))

func set_source_frame(time: float, points: PackedVector2Array, live: bool, end_age: float = 0.0, world_time: float = -1.0) -> void:
    source_age = time
    source_world_time = world_time if world_time >= 0.0 else time
    source_points = points
    source_live = live
    source_end_age = end_age
    rebuild()

static func _clamp(v: float) -> float:
    return clampf(v,0.0,1.0)

func _width_profile(f: float, cut: float, reveal: float) -> float:
    var q: float = _clamp((f-cut)/(reveal-cut))
    match source_profile:
        1:
            return pow(q,0.6)*(1.0-maxf(0.0,(q-0.93)/0.07)*0.9)+0.05
        2:
            return minf(1.0,q*8.0+0.15)*minf(1.0,(1.0-q)*8.0+0.15)
        3:
            return pow(1.0-q,0.7)+0.04
        _:
            return pow(maxf(0.0,sin(PI*q)),0.55)+0.05

func _sample(seg: int, f: float, tt: float, lengths: PackedFloat32Array, normals: PackedVector2Array, total: float, cut: float, reveal: float) -> Dictionary:
    var p: Vector2 = source_points[seg].lerp(source_points[seg+1],tt)
    var n: Vector2 = normals[seg].lerp(normals[seg+1],tt)
    n /= maxf(n.length(),0.000001)
    var u: float = lerpf(lengths[seg],lengths[seg+1],tt)
    var wob := 0.0
    if source_wobble != 0.0:
        wob = sin(u*0.09+source_age*source_wobble_frequency+source_seed*9.0)*source_wobble
    var wd: float = source_width*source_width_multiplier*_width_profile(f,cut,reveal)
    return {"p":p+n*wob,"n":n,"wd":wd,"u":u,"f":f}

func _push(vs: PackedVector2Array, uvs: PackedVector2Array, cols: PackedColorArray, pt: Vector2, uv: Vector2, fraction: float, alpha: float) -> void:
    vs.append(pt)
    uvs.append(uv)
    cols.append(Color(fraction,0.0,0.0,alpha))

func rebuild() -> void:
    source_last_triangles = 0
    visible = false
    mesh = null
    var n: int = source_points.size()
    if n < 2:
        return
    # Original Ribbon.update kills completed ribbons after endT+life.
    if not source_live and source_age-source_end_age >= source_life:
        return
    var length_by_point := PackedFloat32Array([0.0])
    for i in range(1,n):
        length_by_point.append(length_by_point[i-1]+source_points[i].distance_to(source_points[i-1]))
    var total: float = maxf(length_by_point[n-1],0.000001)
    var fk: float = 0.0 if source_live else _clamp((source_age-source_end_age)/source_life)
    var cut := source_cut
    var alpha := source_alpha
    if source_fade_mode == 0 or source_fade_mode == 2:
        if fk > 0.6:
            alpha *= 1.0-(fk-0.6)/0.4
    if source_fade_mode == 1 or source_fade_mode == 2:
        cut = maxf(cut,fk*0.98)
    var reveal := source_reveal
    if reveal-cut < 0.005 or alpha <= 0.01:
        return
    var normals := PackedVector2Array()
    for i in range(n):
        var a: int = maxi(0,i-1)
        var c: int = mini(n-1,i+1)
        var delta := source_points[c]-source_points[a]
        var l := maxf(delta.length(),0.000001)
        normals.append(Vector2(-delta.y/l,delta.x/l))
    var vertices := PackedVector2Array()
    var uvdata := PackedVector2Array()
    var colors := PackedColorArray()
    for seg in range(n-1):
        var f0: float = length_by_point[seg]/total
        var f1: float = length_by_point[seg+1]/total
        if f1 <= cut or f0 >= reveal:
            continue
        var subs: int = maxi(1,mini(4,int(ceil((length_by_point[seg+1]-length_by_point[seg])/6.0))))
        var prev: Dictionary = {}
        for k in range(subs+1):
            var frac := float(k)/float(subs)
            var f: float = lerpf(f0,f1,frac)
            f = clampf(f,cut,reveal)
            var ttc: float = (f-f0)/(f1-f0) if f1 > f0 else 0.0
            var curr: Dictionary = _sample(seg,f,_clamp(ttc),length_by_point,normals,total,cut,reveal)
            if not prev.is_empty():
                var a0: Vector2 = prev["p"]
                var n0: Vector2 = prev["n"]
                var b0: Vector2 = curr["p"]
                var n1: Vector2 = curr["n"]
                var d0: float = prev["wd"]
                var d1: float = curr["wd"]
                var u0: float = prev["u"]
                var u1: float = curr["u"]
                var vis0: float = (float(prev["f"])-cut)/(reveal-cut)
                var vis1: float = (float(curr["f"])-cut)/(reveal-cut)
                var p0 := a0+n0*d0
                var p1 := a0-n0*d0
                var p2 := b0+n1*d1
                var p3 := b0-n1*d1
                # Exact source Batch.strip topology: (a,b,c), (b,d,c).
                _push(vertices,uvdata,colors,p0,Vector2(u0,-1),vis0,alpha)
                _push(vertices,uvdata,colors,p1,Vector2(u0,1),vis0,alpha)
                _push(vertices,uvdata,colors,p2,Vector2(u1,-1),vis1,alpha)
                _push(vertices,uvdata,colors,p1,Vector2(u0,1),vis0,alpha)
                _push(vertices,uvdata,colors,p3,Vector2(u1,1),vis1,alpha)
                _push(vertices,uvdata,colors,p2,Vector2(u1,-1),vis1,alpha)
                source_last_triangles += 2
            prev = curr
    if vertices.is_empty():
        return
    var arrays: Array = []
    arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX] = vertices
    arrays[Mesh.ARRAY_TEX_UV] = uvdata
    arrays[Mesh.ARRAY_COLOR] = colors
    var generated := ArrayMesh.new()
    generated.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays,[],{},Mesh.ARRAY_FLAG_USE_2D_VERTICES)
    mesh = generated
    visible = true
    if ribbon_material != null:
        ribbon_material.set_shader_parameter(&"u_time",source_world_time)
        ribbon_material.set_shader_parameter(&"u_seed",source_seed)
        ribbon_material.set_shader_parameter(&"u_style",source_style)
        ribbon_material.set_shader_parameter(&"u_extra",source_extra)
        ribbon_material.set_shader_parameter(&"u_heat",source_heat)
        ribbon_material.set_shader_parameter(&"u_crust",source_crust)
        ribbon_material.set_shader_parameter(&"u_tr",source_transparency)

func source_summary() -> Dictionary:
    return {"point_count":source_points.size(),"triangle_count":source_last_triangles,
        "age":source_age,"world_time":source_world_time,"width":source_width,"is_live":source_live,"seed":source_seed}

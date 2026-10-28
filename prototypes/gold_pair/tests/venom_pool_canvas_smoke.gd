extends SceneTree

## Native OpenGL test: source Gold Pool.gnd()+Pool.lit() presented as
## two independent dynamic ImageTextures, not a canned sprite or pre-render.
## Stage in original 600x340 only. Real Level2 overlay is a DIFFERENT gate.
const CANVAS=preload("res://prototypes/gold_pair/venom_source_pool_canvas.gd")
const SHADE=preload("res://prototypes/gold_pair/venom_source_pool_shade.gd")
const CASES=[
    ["trail",335.23,182.42,4.0,0.9,2,0.1,0.45,
      "75a023b3eaffe24809652cde7cde7b6e04c63eb04c5bb99bb9d1491ea2d54d48",
      "fa8520188ae9c909c9af89833cb13f10f131d67c2cba473719fd716cee722714"],
    ["finisher",391.72,176.95,6.5,4.2,3,0.3,1.4,
      "d29e7842694514fa9c48a84dfd0316fad1287406dadd027c58a178d87a93d804",
      "bfa172cd5d161f0ca6b7cebd7db2ed72ae7fd301cf886b431e22ee1ba740fe13"]
]
func _initialize()->void:
    call_deferred("_run")

func _run()->void:
    var count:int=0
    for row in CASES:
        var vp:=SubViewport.new()
        vp.size=Vector2i(600,340)
        vp.transparent_bg=true
        vp.render_target_update_mode=SubViewport.UPDATE_ALWAYS
        root.add_child(vp)
        var pool=CANVAS.new()
        vp.add_child(pool)
        pool.begin_source_pool(float(row[1]),float(row[2]),float(row[3]),float(row[4]),int(row[5]),float(row[6]))
        if pool.is_processing():
            _fail("source rendering must never use variable-rate Node._process")
            return
        pool.set_source_to_map_transform(Transform2D.IDENTITY)
        var age:float=float(row[7])
        var buffers:Dictionary=pool.seek_source_time(age,age+0.53)
        if buffers.size()!=2:
            _fail("ground and glow source passes missing")
            return
        var original=SHADE.new()
        for key in ["ground","light"]:
            var expected:String=String(row[8]) if key=="ground" else String(row[9])
            var source_bytes:PackedByteArray=buffers[key]
            var sha:String=original.full_rgba_sha(source_bytes)
            if sha!=expected:
                _fail("native %s Gold source hash drift on %s expected=%s got=%s" % [row[0],key,expected,sha])
                return
            if pool.images[key].get_data()!=source_bytes:
                _fail("Godot Image.set_data lost original Gold bytes")
                return
            if pool.sprites[key].centered or pool.sprites[key].texture_filter!=CanvasItem.TEXTURE_FILTER_NEAREST:
                _fail("source quality lost nearest-native logical pixel definition")
                return
            count+=1
        var m:CanvasItemMaterial=pool.sprites["light"].material
        if m==null or m.blend_mode!=CanvasItemMaterial.BLEND_MODE_ADD:
            _fail("source Pool additive light blend lost")
            return
        await process_frame
        await process_frame
        await RenderingServer.frame_post_draw
        for key in ["ground","light"]:
            if pool.textures[key].get_image().get_data()!=buffers[key]:
                _fail("source Pool OpenGL GPU texture readback differs from Gold %s on %s" % [key,row[0]])
                return
        var source_image:Image=vp.get_texture().get_image()
        var point:Color=source_image.get_pixel(int(round(float(row[1]))),int(round(float(row[2]))))
        if point.a<0.01:
            _fail("native Pool not drawn at Gold world anchor %s" % row[0])
            return
        if source_image.get_pixel(24,24).a>0.01:
            _fail("native Pool unexpectedly painted empty source area")
            return
        if source_image.save_png("/tmp/venom-pool-"+String(row[0])+".png")!=OK:
            _fail("cannot store real GPU original source Pool screenshot")
            return
        pool.seek_source_time(float(row[4])+0.02,float(row[4])+0.55)
        if not pool.finished or pool.sprites["ground"].visible or pool.sprites["light"].visible:
            _fail("source Pool persists after duration, cleanup not working")
            return
        await process_frame
        await process_frame
        await RenderingServer.frame_post_draw
        var after:Image=vp.get_texture().get_image()
        if after.get_pixel(int(round(float(row[1]))),int(round(float(row[2]))).a>0.01:
            _fail("real Pool GPU framebuffer remains visible after expiry")
            return
        vp.queue_free()
    if count!=4:
        _fail("missing two-pass source cases")
        return
    print("VENOM_POOL_CANVAS: PASS / 4 original source full RGBA pass hashes / native OpenGL GPU readback / 2 moving acid pools / expiry cleanup")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_POOL_CANVAS: "+message)
    quit(1)

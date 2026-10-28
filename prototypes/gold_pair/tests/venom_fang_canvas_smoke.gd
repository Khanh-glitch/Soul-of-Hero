extends SceneTree
const CANVAS=preload("res://prototypes/gold_pair/venom_source_fang_canvas.gd")
func _initialize()->void:
    var canvas=CANVAS.new()
    root.add_child(canvas)
    canvas.begin_source_actor(270.25,150.75,0.41)
    canvas.set_source_to_map_transform(Transform2D(0.0,Vector2(18,31)))
    var outputs:Dictionary=canvas.render_source_frame(0.0,270.25,150.75,7.0,0.41,0.6,1.0)
    if outputs.size()!=3:
        push_error("VENOM_FANG_CANVAS: missing Gold pass")
        quit(1)
        return
    for key in ["shd","up","lit"]:
        var sprite:Sprite2D=canvas.sprites[key]
        var tex:ImageTexture=canvas.textures[key]
        if sprite.texture_filter!=CanvasItem.TEXTURE_FILTER_NEAREST or sprite.centered:
            push_error("VENOM_FANG_CANVAS: not source-nearest pixel sampling")
            quit(1)
            return
        if sprite.transform.origin!=Vector2(18,31):
            push_error("VENOM_FANG_CANVAS: wrong source-to-map projection")
            quit(1)
            return
        if tex.get_image().get_data()!=outputs[key]:
            push_error("VENOM_FANG_CANVAS: GPU-staged texture differs from original CPU pixels")
            quit(1)
            return
    var mat:CanvasItemMaterial=canvas.sprites["lit"].material
    if mat==null or mat.blend_mode!=CanvasItemMaterial.BLEND_MODE_ADD:
        push_error("VENOM_FANG_CANVAS: lost source additive light")
        quit(1)
        return
    canvas.release_source_actor()
    for key in ["shd","up","lit"]:
        if canvas.sprites[key].visible:
            push_error("VENOM_FANG_CANVAS: actor remains visible after cleanup")
            quit(1)
            return
    print("VENOM_FANG_CANVAS: PASS / 3-pass source pixels, nearest, transform, additive glow and cleanup")
    quit(0)

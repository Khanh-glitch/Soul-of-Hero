class_name ArcanaSourceScarPass
extends Node2D

## Draws original Gold Pixi Graphics command geometry (no fake sheets).
## This is a Godot staging layer; Pixi/Godot raster parity still needs image tests.
var source_commands:PackedStringArray=PackedStringArray()

func set_source_commands(lines:PackedStringArray)->void:
    source_commands=lines
    queue_redraw()

func _draw()->void:
    for source_cmd in source_commands:
        var parts:PackedStringArray=source_cmd.split("|")
        if parts.size()!=5:continue
        var coords:PackedStringArray=parts[2].split(",")
        var rgb:int=int(parts[3])
        var alpha:float=float(parts[4])
        var ink:=Color(float((rgb>>16)&255)/255.0,
                       float((rgb>>8)&255)/255.0,
                       float(rgb&255)/255.0,
                       clampf(alpha,0.0,1.0))
        if parts[1]=="P":
            if coords.size()<6 or coords.size()%2!=0:continue
            var verts:PackedVector2Array=PackedVector2Array()
            for i in range(0,coords.size(),2):
                verts.append(Vector2(float(coords[i]),float(coords[i+1])))
            draw_colored_polygon(verts,ink)
        elif parts[1]=="R":
            if coords.size()!=4:continue
            var rect:=Rect2(float(coords[0]),float(coords[1]),float(coords[2]),float(coords[3]))
            draw_rect(rect,ink,true)

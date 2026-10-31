## Pass painter node for Arcana20SkillInstance. Drawing commands must be
## issued by the CanvasItem whose _draw is running, so ground/light passes
## get their own painter nodes; each forwards to the host instance with
## itself as the canvas. Host is intentionally untyped (no cyclic class
## reference between painter and instance scripts).
extends Arcana20Primitives
class_name Arcana20PassPainter

var pass_kind: int = 0 # 0 ground, 1 light
var host: Node

func _draw() -> void:
    if host != null and host.has_method("draw_pass"):
        host.draw_pass(pass_kind, self)

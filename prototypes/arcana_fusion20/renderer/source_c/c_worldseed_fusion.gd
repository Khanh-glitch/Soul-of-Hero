## Selected original C16 living membranes plus original seed/spore/petal burst.
## One source clock and seeded setup; full C16 organism and OUT are still open.
extends CWorldseedDebris
class_name CWorldseedFusion
var growth := CWorldseedMembranes.new()
func setup() -> void:
    super.setup()
    growth.trees = membrane_trees
func render(frame: CFrame, t: float) -> void:
    growth.render(frame,t)
    super.render(frame,t)

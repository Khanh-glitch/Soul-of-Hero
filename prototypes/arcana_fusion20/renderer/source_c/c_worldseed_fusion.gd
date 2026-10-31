## Selected original C16 living membranes plus original seed/spore/petal burst.
## One source clock and seeded setup; full C16 organism and OUT are still open.
extends CWorldseedDebris
class_name CWorldseedFusion
var growth := CWorldseedMembranes.new()
# Optional, for native-world composition trials only. Shipping fusion remains
# unchanged until the original opaque C geometry's stacking is inspected.
var organism: CWorldseedOrganism
func setup() -> void:
    super.setup()
    growth.trees = membrane_trees
func render(frame: CFrame, t: float) -> void:
    growth.render(frame,t)
    if organism != null: organism.render(frame,t)
    super.render(frame,t)

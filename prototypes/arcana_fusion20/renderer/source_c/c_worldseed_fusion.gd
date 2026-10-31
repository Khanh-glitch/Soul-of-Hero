## Selected original C16 membranes, layered organism, leaflets, core and debris.
## One source clock and seeded setup; source/world post and full OUT remain open.
extends CWorldseedDebris
class_name CWorldseedFusion
var growth := CWorldseedMembranes.new()
# Keep the original C geometry on the same clock and paint it behind the
# A growth lead in the diagnostic world mount. Nullable for isolated tests.
var organism: CWorldseedOrganism = CWorldseedOrganism.new()
var leaflets: CWorldseedLeaflets = CWorldseedLeaflets.new()
var core: CWorldseedCore = CWorldseedCore.new()
func setup() -> void:
    super.setup()
    growth.trees = membrane_trees
func render(frame: CFrame, t: float) -> void:
    growth.render(frame,t)
    if organism != null: organism.render(frame,t)
    if leaflets != null: leaflets.render(frame,t)
    if core != null: core.render(frame,t)
    super.render(frame,t)

extends Node2D
## Diagnostic interaction target only: no POI state, reward or persistence.
var activations := 0
func _ready() -> void:
	add_to_group(&"player_interactable")
func interact(actor: Node2D) -> bool:
	if actor == null or global_position.distance_to(actor.global_position) > 24.0:
		return false
	activations += 1
	return true

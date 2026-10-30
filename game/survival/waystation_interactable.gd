extends Node2D
## Physical presentation only; A0's mounted host and A3 own the action.
var _host: Node

func configure(host: Node) -> void:
	_host = host

func _ready() -> void:
	add_to_group(&"player_interactable")

func interact(actor: Node) -> bool:
	if not is_instance_valid(_host) or not actor is Node2D:
		return false
	if global_position.distance_to((actor as Node2D).global_position) > 24.0:
		return false
	_host.call(&"interact_point", self, actor)
	# An in-range refusal consumes the press and explains why; it must not also
	# trigger a nearby resource, door or attack.
	return true

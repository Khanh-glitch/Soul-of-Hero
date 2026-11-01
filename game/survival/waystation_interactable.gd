extends Node2D
## Physical presentation only; A0's mounted host and A3 own the action.
##
## Reach is 40px, not 24. The authored stands sit one cell diagonally from the
## prop centre, so an exactly-centred Hero is 24.0px away: a 24px reach only
## worked when the player was pixel-perfect, and a real body pressed against the
## crate collider cannot beat that. The host still requires the Hero to stand on
## the authored stand cell, so this widens the click, never the identity.
const INTERACT_REACH := 40.0
var _host: Node

func configure(host: Node) -> void:
	_host = host

func _ready() -> void:
	add_to_group(&"player_interactable")

func interact(actor: Node) -> bool:
	if not is_instance_valid(_host) or not actor is Node2D:
		return false
	if global_position.distance_to((actor as Node2D).global_position) > INTERACT_REACH:
		return false
	_host.call(&"interact_point", self, actor)
	# An in-range refusal consumes the press and explains why; it must not also
	# trigger a nearby resource, door or attack.
	return true

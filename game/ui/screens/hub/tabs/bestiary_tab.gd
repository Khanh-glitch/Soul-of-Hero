extends VBoxContainer


func _ready() -> void:
	%SkeletonOne.texture = LivingArsenalIcons.sprite_frame(
		"res://assets/characters/enemies/enemies-skeleton1_idle.png"
	)
	%SkeletonTwo.texture = LivingArsenalIcons.sprite_frame(
		"res://assets/characters/enemies/enemies-skeleton2_idle.png"
	)
	%Vampire.texture = LivingArsenalIcons.sprite_frame(
		"res://assets/characters/enemies/enemies-vampire_idle.png"
	)


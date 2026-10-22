extends VBoxContainer


func _ready() -> void:
	%HuntIcon.texture = LivingArsenalIcons.texture(LivingArsenalIcons.BESTIARY)
	%ChallengeIcon.texture = LivingArsenalIcons.texture(LivingArsenalIcons.ARSENAL)
	%DepthIcon.texture = LivingArsenalIcons.texture(LivingArsenalIcons.MODES)


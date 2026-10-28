extends VBoxContainer

const CHAPTER_BUTTON_SCENE := preload("res://game/ui/screens/hub/tabs/components/campaign_chapter_button.tscn")
const CAMPAIGN_SLOT_SCENE := preload("res://game/ui/screens/hub/tabs/components/campaign_slot_card.tscn")

@onready var slots_grid: GridContainer = %SlotsGrid
@onready var chapter_buttons: HBoxContainer = %ChapterButtons

var _chapter := 1
var _chapter_button_nodes: Array[Button] = []


func _ready() -> void:
	_build_chapter_buttons()
	%TrainingDetailsButton.pressed.connect(func() -> void: AppFlow.open_level_details(&"training_crypt"))
	%StartTrainingButton.pressed.connect(func() -> void: AppFlow.start_training())
	if has_node("%EnterOverworldButton"):
		%EnterOverworldButton.pressed.connect(func() -> void: AppFlow.open_overworld({}))
	LivingArsenalIcons.apply_to_button(%TrainingDetailsButton, LivingArsenalIcons.BOOK)
	LivingArsenalIcons.apply_to_button(%StartTrainingButton, LivingArsenalIcons.PLAY)
	_show_chapter(1)


func _show_chapter(chapter: int) -> void:
	_chapter = clampi(chapter, 1, LevelDefinition.CAMPAIGN_CHAPTER_CAPACITY)
	for index: int in _chapter_button_nodes.size():
		_chapter_button_nodes[index].button_pressed = index + 1 == _chapter
	for child: Node in slots_grid.get_children():
		child.free()
	var first_slot := LevelDefinition.get_first_campaign_slot_for_chapter(_chapter)
	var completed_count := 0
	for slot: int in range(first_slot, first_slot + LevelDefinition.LEVELS_PER_CHAPTER):
		var summary: Dictionary = AppFlow.get_campaign_level_summary(slot)
		if not summary.is_empty() and bool(summary.get("completed", false)):
			completed_count += 1
		var card := CAMPAIGN_SLOT_SCENE.instantiate() as PanelContainer
		slots_grid.add_child(card)
		if summary.is_empty():
			card.call(&"configure_missing", slot)
		else:
			card.call(&"configure", slot, summary)
	%ChapterSummary.text = "CHƯƠNG %d  •  %d/%d" % [
		_chapter,
		completed_count,
		LevelDefinition.LEVELS_PER_CHAPTER,
	]


func get_current_chapter() -> int:
	return _chapter


func get_chapter_button_count() -> int:
	return _chapter_button_nodes.size()


func _build_chapter_buttons() -> void:
	for child: Node in chapter_buttons.get_children():
		child.free()
	_chapter_button_nodes.clear()
	for chapter: int in range(1, LevelDefinition.CAMPAIGN_CHAPTER_CAPACITY + 1):
		var button := CHAPTER_BUTTON_SCENE.instantiate() as Button
		button.name = "ChapterButton%02d" % chapter
		button.text = str(chapter)
		button.tooltip_text = "CHƯƠNG %d" % chapter
		button.pressed.connect(_show_chapter.bind(chapter))
		chapter_buttons.add_child(button)
		_chapter_button_nodes.append(button)

extends SceneTree

const WORKBENCH := "res://game/ui/designer/workbench/ui_workbench.tscn"
const COMPONENTS := [
	"res://game/ui/designer/components/brand_header.tscn",
	"res://game/ui/designer/components/stat_cluster.tscn",
	"res://game/ui/designer/components/action_deck.tscn",
	"res://game/ui/designer/components/content_card.tscn",
	"res://game/ui/designer/components/dialog_card.tscn",
	"res://game/ui/designer/components/navigation_bar.tscn",
	"res://game/ui/designer/components/prompt_toast.tscn",
	"res://game/ui/designer/components/inventory_slot.tscn",
	"res://game/ui/designer/templates/fullscreen_screen_template.tscn",
	"res://game/ui/designer/templates/hud_overlay_template.tscn",
]

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var theme := load("res://game/ui/theme/living_arsenal_theme.tres") as Theme
	_expect(theme != null, "shared UI theme loads")

	for component_path: String in COMPONENTS:
		var packed := load(component_path) as PackedScene
		_expect(packed != null, "%s loads" % component_path.get_file())
		if packed == null:
			continue
		var component := packed.instantiate()
		root.add_child(component)
		_expect(_branch_has_no_script(component), "%s stays designer-only" % component_path.get_file())
		component.free()

	var packed_workbench := load(WORKBENCH) as PackedScene
	_expect(packed_workbench != null, "workbench scene loads")
	if packed_workbench != null:
		var workbench := packed_workbench.instantiate() as Control
		root.add_child(workbench)
		await process_frame
		_expect(workbench.theme == theme, "workbench uses the production theme")
		_expect(workbench.get_node_or_null("Scroll/SafeMargin/Catalog/BrandHeader") != null, "branding sample is present")
		_expect(workbench.get_node_or_null("Scroll/SafeMargin/Catalog/ActionDeck") != null, "action deck sample is present")
		_expect(workbench.get_node_or_null("Scroll/SafeMargin/Catalog/AssetPanel") != null, "asset palette is present")
		_expect(workbench.get_node_or_null("Scroll/SafeMargin/Catalog/ScreenPanel") != null, "runtime screen catalog is present")
		var catalog := workbench.get_node("Scroll/SafeMargin/Catalog") as VBoxContainer
		_expect(catalog.get_combined_minimum_size().x <= 584.0, "catalog fits the 640px viewport and safe margins")
		var glyph := workbench.get_node("Scroll/SafeMargin/Catalog/AssetPanel/AssetRows/PromptRow/J") as TextureRect
		_expect(glyph.texture is AtlasTexture, "Kenney input prompt remains atlas-backed")
		if glyph.texture is AtlasTexture:
			_expect((glyph.texture as AtlasTexture).region == Rect2(384, 48, 16, 16), "J glyph uses the approved region")
		workbench.free()

	_expect(FileAccess.file_exists("res://docs/NO_CODE_UI_WORKFLOW.md"), "no-code designer guide ships with the workbench")

	if _failures.is_empty():
		print("UI DESIGNER WORKBENCH TEST PASSED — %d checks" % _checks)
		quit(0)
	else:
		for failure: String in _failures:
			push_error("UI DESIGNER FAIL: %s" % failure)
		print("UI DESIGNER WORKBENCH TEST FAILED — %d/%d" % [_failures.size(), _checks])
		quit(1)


func _branch_has_no_script(node: Node) -> bool:
	if node.get_script() != null:
		return false
	for child: Node in node.get_children():
		if not _branch_has_no_script(child):
			return false
	return true


func _expect(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)

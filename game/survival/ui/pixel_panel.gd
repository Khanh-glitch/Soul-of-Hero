extends PanelContainer
## Angular, low-noise frame trim drawn in logical pixels over a warm leather card.
const PIXEL_UI := preload("res://game/survival/ui/pixel_ui.gd")
var _edge := Color("b77b4e")
var _highlight := Color("f4c778")

func configure(fill: Color, edge: Color, highlight: Color = Color("f4c778")) -> void:
	_edge = edge
	_highlight = highlight
	add_theme_stylebox_override("panel", PIXEL_UI.panel_style(fill, edge))
	queue_redraw()

func _draw() -> void:
	var w := size.x
	var h := size.y
	if w < 12 or h < 12: return
	var dark := Color("17151a")
	# Four interrupted corners and two tiny brass studs make the card read as an
	# illustrated field folio rather than a default flat Godot rectangle.
	draw_rect(Rect2(1, 1, w - 2, h - 2), dark, false, 1.0)
	draw_rect(Rect2(3, 3, w - 6, h - 6), _edge, false, 1.0)
	draw_rect(Rect2(4, 4, 4, 2), _highlight, true)
	draw_rect(Rect2(w - 8, 4, 4, 2), _highlight, true)
	draw_rect(Rect2(4, h - 6, 4, 2), _edge, true)
	draw_rect(Rect2(w - 8, h - 6, 4, 2), _edge, true)
	draw_rect(Rect2(w * 0.5 - 3, 4, 6, 1), _edge, true)
	draw_rect(Rect2(w * 0.5 - 1, 4, 2, 1), _highlight, true)

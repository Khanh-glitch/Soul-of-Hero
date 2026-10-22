class_name PixelGlyphs
extends RefCounted

## Tiny, texture-free bitmap glyphs. They remain crisp at the project's low
## logical resolution and avoid depending on a platform font for combat text.

const GLYPHS := {
	"0": ["111", "101", "101", "101", "111"],
	"1": ["010", "110", "010", "010", "111"],
	"2": ["111", "001", "111", "100", "111"],
	"3": ["111", "001", "111", "001", "111"],
	"4": ["101", "101", "111", "001", "001"],
	"5": ["111", "100", "111", "001", "111"],
	"6": ["111", "100", "111", "101", "111"],
	"7": ["111", "001", "010", "010", "010"],
	"8": ["111", "101", "111", "101", "111"],
	"9": ["111", "101", "111", "001", "111"],
	"H": ["101", "101", "111", "101", "101"],
	"I": ["111", "010", "010", "010", "111"],
	"T": ["111", "010", "010", "010", "010"],
	"X": ["101", "101", "010", "101", "101"],
	"!": ["1", "1", "1", "0", "1"],
	"-": ["000", "000", "111", "000", "000"],
	"+": ["000", "010", "111", "010", "000"],
	" ": ["00", "00", "00", "00", "00"],
}


static func measure(text: String, pixel_size: float, spacing_pixels := 1.0) -> Vector2:
	var width := 0.0
	var normalized := text.to_upper()
	for index: int in normalized.length():
		var pattern: Array = GLYPHS.get(normalized[index], GLYPHS[" "])
		width += float(String(pattern[0]).length()) * pixel_size
		if index < normalized.length() - 1:
			width += spacing_pixels * pixel_size
	return Vector2(width, 5.0 * pixel_size)


static func rasterize(
		text: String,
		origin: Vector2,
		pixel_size: float,
		spacing_pixels := 1.0
) -> Array[Rect2]:
	var result: Array[Rect2] = []
	var cursor := origin
	var normalized := text.to_upper()
	for glyph_index: int in normalized.length():
		var pattern: Array = GLYPHS.get(normalized[glyph_index], GLYPHS[" "])
		for row: int in pattern.size():
			var row_data := String(pattern[row])
			for column: int in row_data.length():
				if row_data[column] == "1":
					result.append(Rect2(
						cursor + Vector2(column, row) * pixel_size,
						Vector2.ONE * pixel_size
					))
		cursor.x += (float(String(pattern[0]).length()) + spacing_pixels) * pixel_size
	return result

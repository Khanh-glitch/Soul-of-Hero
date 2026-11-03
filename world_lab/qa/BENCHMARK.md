# Render / streaming benchmark

{
  "frames": 60,
  "viewport": "640x360 1x",
  "average_ms": 26.16,
  "median_ms": 26.44,
  "p95_ms": 35.14,
  "min_ms": 17.24,
  "max_ms": 94.16,
  "average_visible_tiles": 1151,
  "average_drawables": 89,
  "full_grid_cells": 175000,
  "streaming": "visible-tile iteration only; full grid is never blitted",
  "note": "Node/PNG capture renderer benchmark, NOT Godot 4.7 or browser runtime performance."
}

This measures the deterministic Node capture renderer. It does not prove Godot 4.7 native performance, browser frame rate, or production streaming.

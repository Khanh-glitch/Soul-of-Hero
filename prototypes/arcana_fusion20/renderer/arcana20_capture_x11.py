"""CI-only physical X11 framebuffer screenshot (not Godot's 640x360 logical viewport)."""
import sys
import mss
import mss.tools

with mss.mss() as display:
    image = display.grab(display.monitors[1])
    mss.tools.to_png(image.rgb, image.size, output=sys.argv[1])

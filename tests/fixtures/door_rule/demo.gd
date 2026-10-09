extends "res://scripts/level.gd"
## A controlled test precondition: arrive at the exit before collecting the key.

func _ready() -> void:
	super._ready()
	player.position = Vector2(384, 160)
	$HUD/Top/Title.text = "DOOR RULE / QA DEMO"
	$HUD/Top/Title.add_theme_font_size_override("font_size", 15)
	# Keep the actual key HUD readable alongside the victory result.
	$HUD/Overlay/Shade.offset_top = 30.0
	toast("KEY MISSING. Test the locked exit with E before collecting the key.", 600.0)

func _on_victory() -> void:
	super._on_victory()
	if not player.has_key:
		overlay_text.text = "The exit opened before the key was collected.\nDeliberate gameplay fault in this QA build."

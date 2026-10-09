extends "res://scripts/exit_door.gd"
## INTENTIONAL QA DEMO BUG: the inventory guard is missing here.
## Only the external QA bridge installs this script. The normal exit is unchanged.

func interact(player: Adventurer) -> void:
	if is_open:
		return
	# BUG: missing `if not player.has_key: return`.
	is_open = true
	$Sprite2D.texture = preload("res://assets/door_open.png")
	player.play_sound("win")
	opened.emit()

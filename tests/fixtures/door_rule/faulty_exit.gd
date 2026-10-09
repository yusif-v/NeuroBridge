extends "res://scripts/exit_door.gd"
## Deliberately faulty demo only: the required key check has been removed.
## The production door script retains its key check.

func interact(player: Adventurer) -> void:
	if is_open:
		return
	is_open = true
	$Sprite2D.texture = preload("res://assets/door_open.png")
	player.play_sound("win")
	opened.emit()

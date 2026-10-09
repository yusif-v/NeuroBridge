extends SceneTree

var failures: int = 0

func _initialize() -> void:
	_run.call_deferred()

func check(condition: bool, message: String) -> void:
	print("PASS " if condition else "FAIL ", message)
	if not condition:
		failures += 1

func frames() -> void:
	for i in 5:
		await physics_frame

func _run() -> void:
	change_scene_to_file("res://control.tscn")
	await frames()
	var level = current_scene
	check(not level.player.has_key and level.door.nearby == level.player, "Control starts at the exit without a key")
	level.door.interact(level.player)
	check(not level.won and not level.door.is_open, "Normal door refuses victory without a key")
	level.player.has_key = true
	level.door.interact(level.player)
	check(level.won and level.door.is_open, "Normal door permits victory with a key")
	paused = false
	change_scene_to_file("res://demo.tscn")
	await frames()
	level = current_scene
	level.door.interact(level.player)
	check(level.won and level.door.is_open and not level.player.has_key, "Seeded demo opens the door without the key")
	check(level.key_status.text == "KEY  MISSING" and level.overlay_title.text == "DUNGEON CLEARED", "Visible evidence shows both missing key and victory")
	paused = false
	print("DOOR RULE: ", failures, " failures")
	quit(0 if failures == 0 else 1)

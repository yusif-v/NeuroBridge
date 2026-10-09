extends SceneTree
## Verify the new navigation flow without loading the optional CUDA model.

var failures: int = 0

func _initialize() -> void:
	_run.call_deferred()

func frames(count: int = 4) -> void:
	for i in count:
		await process_frame

func check(condition: bool, message: String) -> void:
	print("PASS " if condition else "FAIL ", message)
	if not condition:
		failures += 1

func _run() -> void:
	change_scene_to_file(ProjectSettings.get_setting("application/run/main_scene"))
	await frames()
	var menu: Control = current_scene
	check(menu.name == "MainMenu" and menu.normal_button.has_focus(), "Startup shows keyboard-accessible mode selection")
	menu.qa_project_directory = ""
	menu.project_directory = "user://missing-qa-folder"
	menu.laya_button.pressed.emit()
	check(menu.demo_pid == -1 and not menu.laya_button.disabled and "Normal oyun" in menu.status.text, "Missing optional QA dependency leaves normal play available")
	menu.normal_button.pressed.emit()
	await frames()
	var level: Node2D = current_scene
	check(level.name == "MossAndEmber" and not paused and not level.player.has_key, "Normal play starts a fresh level")
	level._toggle_pause()
	check(paused and level.overlay.visible, "Pause menu is usable")
	level.get_node("HUD/Overlay/Card/Quit").pressed.emit()
	await frames()
	check(current_scene.name == "MainMenu" and not paused, "Paused level returns to the menu and clears pause")
	current_scene.normal_button.pressed.emit()
	await frames()
	level = current_scene
	check(not level.player.has_key and not level.won, "Starting again resets the puzzle")
	level._on_victory()
	level.get_node("HUD/Overlay/Card/Quit").pressed.emit()
	await frames()
	check(current_scene.name == "MainMenu" and not paused, "Victory screen returns to the menu")
	print("MENU FLOW: ", failures, " failures")
	quit(0 if failures == 0 else 1)

extends SceneTree
## Runs real 60 Hz player physics and ordinary input actions through the entire level.
## Run: godot --headless --path . --fixed-fps 60 --script res://tests/playthrough.gd

var level: Node2D
var player: Adventurer
var failures: int = 0

func _initialize() -> void:
	_run.call_deferred()

func frames(count: int) -> void:
	for i in count:
		await physics_frame
		await process_frame

func check(condition: bool, message: String) -> void:
	if condition:
		print("PASS: ", message)
	else:
		push_error("FAIL: " + message)
		failures += 1

func release_controls() -> void:
	for action in ["move_left", "move_right", "climb_up", "climb_down", "jump", "interact", "pause", "restart"]:
		Input.action_release(action)

func travel_to(x: float, limit: int = 240) -> bool:
	var action: String = "move_right" if x > player.position.x else "move_left"
	Input.action_press(action)
	for i in limit:
		await frames(1)
		if not player.enabled:
			release_controls()
			return false
		if (action == "move_right" and player.position.x >= x) or (action == "move_left" and player.position.x <= x):
			Input.action_release(action)
			await frames(5)
			return true
	Input.action_release(action)
	print("Travel timeout ", x, " at ", player.position)
	return false

func jump_to(x: float, limit: int = 120) -> bool:
	Input.action_press("jump")
	var result: bool = await travel_to(x, limit)
	await frames(30)
	Input.action_release("jump")
	await frames(4)
	return result

func _run() -> void:
	change_scene_to_file("res://scenes/level.tscn")
	await frames(5)
	level = current_scene
	player = level.player
	level.door.interact(player)
	check(not level.won and not level.door.is_open, "Exit refuses a player without the key")
	var mover: Node2D = level.get_node("World/HorizontalPlatform")
	Input.action_press("pause")
	await frames(2)
	Input.action_release("pause")
	var frozen: Vector2 = mover.position
	await frames(20)
	check(paused and mover.position == frozen and level.overlay.visible, "Pause freezes the world and shows the menu")
	Input.action_press("pause")
	await frames(2)
	Input.action_release("pause")
	check(not paused, "Escape resumes play")

	check(await travel_to(127), "Walk from spawn to ladder")
	Input.action_press("climb_up")
	for i in 140:
		await frames(1)
		if player.position.y <= 235.0:
			break
	Input.action_release("climb_up")
	await frames(25)
	check(player.position.y < 258.0, "Ladder reaches the left shelf")
	check(await travel_to(64), "Walk across key shelf")
	check(player.has_key and not level.get_node("World/Key").visible, "Golden key collected")
	check(await travel_to(128), "Return to ladder")
	Input.action_press("climb_down")
	await frames(100)
	Input.action_release("climb_down")
	await frames(10)
	check(player.position.y > 382.0 and player.position.y < 385.0, "Climb down through landing to floor")
	check(await travel_to(174), "Approach floor spikes")
	check(await jump_to(238), "Jump over floor spikes")
	check(player.enabled and player.position.y > 380.0, "Land safely before crate")
	check(await travel_to(292), "Push crate across the lower floor")
	var crate: PushableCrate = level.get_node("World/Crate")
	check(crate.position.x > 310.0, "Crate responds to pushing")
	print("Crate position ", crate.position, " player ", player.position)
	check(await jump_to(crate.position.x), "Jump onto the crate")
	check(absf(player.position.y - 352.0) < 3.0, "Stand on the 32-pixel crate")
	check(await jump_to(378), "Jump from crate to central shelf")
	check(absf(player.position.y - 288.0) < 3.0, "64-pixel crate-to-shelf jump is achievable")
	check(await travel_to(432), "Walk to ferry boarding edge")
	for i in 400:
		await frames(1)
		if mover.position.x < 491.0:
			break
	check(await travel_to(480), "Board horizontal moving platform")
	var before_ride: float = player.position.x
	await frames(85)
	check(player.position.x > before_ride + 30.0 and absf(player.position.y - 288.0) < 3.0, "Horizontal platform carries the player without movement input")
	for i in 300:
		await frames(1)
		if mover.position.x > 592.0:
			break
	check(await travel_to(647), "Step from ferry onto right landing")
	var lift: Node2D = level.get_node("World/VerticalPlatform")
	for i in 400:
		await frames(1)
		if lift.position.y > 250.0:
			break
	check(await jump_to(657), "Board the vertical lift")
	for i in 400:
		await frames(1)
		if player.position.y < 151.0:
			break
	check(player.position.y < 151.0, "Vertical platform carries the player to the upper route")
	check(await travel_to(608), "Step onto upper right ledge")
	check(await jump_to(522), "Jump to the middle stepping stone")
	check(absf(player.position.y - 160.0) < 3.0, "Land on middle stepping stone")
	check(await jump_to(421), "Jump to elevated exit platform")
	check(await travel_to(384), "Reach exit door with key")
	Input.action_press("interact")
	await frames(3)
	Input.action_release("interact")
	check(level.won and level.door.is_open and level.overlay.visible and paused, "E opens exit and shows victory with restart button")
	level.restart_button.pressed.emit()
	await frames(6)
	level = current_scene
	player = level.player
	check(not player.has_key and not level.won and not paused, "Victory restart button resets the level")

	# Deliberately disturb all puzzle state, then touch a real hazard.
	player.has_key = true
	level.get_node("World/Key").taken = true
	level.get_node("World/Key").hide()
	level.get_node("World/Crate").position.x = 385.0
	player.position = Vector2(221, 383)
	await frames(55)
	level = current_scene
	player = level.player
	check(player.enabled and not player.has_key and player.position.distance_to(Vector2(90,384)) < 3.0, "Spikes respawn the player and clear the key")
	check(level.get_node("World/Crate").position.distance_to(Vector2(272,368)) < 3.0 and level.get_node("World/Key").visible, "Death restores crate and key")
	check(level.get_node("World/HorizontalPlatform")._elapsed < 0.5 and level.get_node("World/VerticalPlatform")._elapsed < 0.5, "Death resets both moving-platform cycles")
	Input.action_press("restart")
	await frames(5)
	Input.action_release("restart")
	check(current_scene != level, "R reloads the full puzzle")
	release_controls()
	print("PLAYTHROUGH RESULT: ", failures, " failure(s)")
	current_scene.queue_free()
	current_scene = null
	level = null
	player = null
	crate = null
	mover = null
	lift = null
	await frames(3)
	quit(0 if failures == 0 else 1)

extends SceneTree
## QA-only file IPC. The shipped game never loads this script.
## The world freezes between decisions; actions use real Godot input and physics.

var session_dir: String
var seq: int = 0
var last_command: int = 0
var actual_pause: bool = false
var fault: String = "none"
var status_label: Label
var action_caption: Label
var last_probe: Dictionary = {}
var decision_history: Array[String] = []
var speed: float = 1.5
var decision_hold: float = 0.0
var evidence_panel: ColorRect
var evidence_title: Label
var evidence_detail: Label
var repeat_button: Button
var ui: CanvasLayer

func _initialize() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-dir" and i + 1 < args.size():
			session_dir = args[i + 1]
		if args[i] == "--fault" and i + 1 < args.size():
			fault = args[i + 1]
		if args[i] == "--speed" and i + 1 < args.size():
			speed = clampf(float(args[i + 1]), 0.25, 2.0)
		if args[i] == "--decision-hold" and i + 1 < args.size():
			decision_hold = clampf(float(args[i + 1]), 0.0, 5.0)
	if session_dir.is_empty():
		push_error("Missing --qa-dir")
		quit(2)
		return
	DirAccess.make_dir_recursive_absolute(session_dir)
	if DisplayServer.get_name() != "headless":
		# Scale both tick frequency and game time. Each physics step remains 1/60
		# simulated second, preserving the validated jumps while slowing playback.
		Engine.time_scale = speed
		Engine.physics_ticks_per_second = roundi(60.0 * speed)
		Engine.max_fps = maxi(60, Engine.physics_ticks_per_second)
		if Engine.physics_ticks_per_second > 60:
			# Keep frame-based QA actions at one rendered frame per physics tick.
			DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	_run.call_deferred()
	root.title = "Moss & Ember | Laya CUDA Playtester"

func frames(count: int) -> void:
	for i in count:
		await physics_frame
		await process_frame

func release_inputs() -> void:
	for action in ["move_left", "move_right", "jump", "climb_up", "climb_down", "interact", "restart", "pause"]:
		Input.action_release(action)

func _fresh_level() -> void:
	paused = false
	actual_pause = false
	release_inputs()
	if evidence_panel != null:
		evidence_panel.hide()
	change_scene_to_file("res://scenes/level.tscn")
	await frames(6)
	# The QA window closes back to the still-open launcher menu.
	current_scene.get_node("HUD/Overlay/Card/Quit").text = "CLOSE DEMO"
	current_scene.get_node("HUD/Overlay/Card/Quit").pressed.disconnect(current_scene._return_to_menu)
	current_scene.get_node("HUD/Overlay/Card/Quit").pressed.connect(func(): quit())
	_apply_fault()

func _apply_fault() -> void:
	if fault == "door_without_key":
		# Replace only the QA door with a real faulty implementation before ready.
		var level: Node2D = current_scene
		var original: Area2D = level.door
		var faulty: Area2D = preload("res://scenes/exit_door.tscn").instantiate()
		faulty.set_script(preload("res://qa/faults/exit_without_key.gd"))
		faulty.position = original.position
		var world: Node = original.get_parent()
		world.remove_child(original)
		original.queue_free()
		faulty.name = "Exit"
		world.add_child(faulty)
		level.door = faulty
		faulty.opened.connect(level._on_victory)
		faulty.locked_attempt.connect(level._on_locked)
	elif fault == "ladder_down_blocked":
		current_scene.get_node("World/LeftLadder").monitoring = false

func _run() -> void:
	await _fresh_level()
	ui = CanvasLayer.new()
	ui.layer = 30
	ui.process_mode = Node.PROCESS_MODE_ALWAYS
	root.add_child(ui)
	var background := ColorRect.new()
	background.position = Vector2(452, 300)
	background.size = Vector2(292, 112)
	background.color = Color(0.025, 0.08, 0.10, 0.95)
	ui.add_child(background)
	status_label = Label.new()
	status_label.position = Vector2(460, 305)
	status_label.size = Vector2(276, 102)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.clip_text = true
	status_label.add_theme_font_size_override("font_size", 10)
	status_label.modulate = Color("e9d18a")
	status_label.text = "LAYA 0.3.21 • LOCAL CUDA\nWaiting for a real model decision…"
	ui.add_child(status_label)
	var action_background := ColorRect.new()
	action_background.position = Vector2(24, 34)
	action_background.size = Vector2(720, 37)
	action_background.color = Color("17362e")
	ui.add_child(action_background)
	action_caption = Label.new()
	action_caption.position = Vector2(36, 39)
	action_caption.size = Vector2(696, 28)
	action_caption.add_theme_font_size_override("font_size", 17)
	action_caption.modulate = Color("f5d779")
	action_caption.text = "LAYA CUDA • Modelin qərarını gözləyirik…"
	ui.add_child(action_caption)
	_build_evidence_ui()
	_publish()
	paused = true
	while true:
		await process_frame
		var path: String = session_dir.path_join("command-%d.json" % (last_command + 1))
		if not FileAccess.file_exists(path):
			continue
		# Retry briefly unavailable/incomplete IPC files silently on Windows.
		var contents: String = FileAccess.get_file_as_string(path)
		if contents.is_empty():
			continue
		var parser := JSON.new()
		if parser.parse(contents) != OK:
			continue
		var value: Variant = parser.data
		if not value is Dictionary or int(value.get("id", -1)) <= last_command:
			continue
		last_command = int(value.id)
		if value.get("kind", "") == "stop":
			paused = false
			quit()
			return
		paused = actual_pause
		last_probe = {}
		var display: String = str(value.get("display", "action"))
		decision_history.push_front(display.left(44))
		if decision_history.size() > 2:
			decision_history.pop_back()
		var source: String = "REAL INFERENCE" if value.has("inference_ms") else "QA CONTROLLER"
		status_label.text = "LAYA multilingual • %s\n%s\n" % [str(value.get("device", "cuda")).to_upper(), source]
		if value.has("inference_ms"):
			status_label.text += "%.1f ms | P(action) %.1f%%\n" % [float(value.inference_ms), float(value.get("confidence", 0.0)) * 100.0]
		if value.has("probabilities"):
			var probability_text: String = ""
			for action in value.probabilities:
				var short_name: String = str(action).replace("move_", "").replace("jump_", "J").replace("inventory_gate_bug", "BUG").replace("correct_behavior", "OK")
				probability_text += "%s:%.0f%%  " % [short_name, float(value.probabilities[action]) * 100.0]
			status_label.text += probability_text + "\n"
		for entry in decision_history:
			status_label.text += entry + "\n"
		_show_action(value)
		# Show the new model decision before moving, using a real-time pause.
		if decision_hold > 0.0 and value.has("inference_ms") and value.get("kind", "") in ["action", "probe"]:
			await _hold_visible(decision_hold)
		if value.get("kind", "") == "message":
			await _hold_visible(float(value.get("hold_seconds", 6.0)))
		elif value.get("kind", "") == "probe":
			await _probe(str(value.get("probe", "")))
		elif value.get("kind", "") == "reset":
			await _fresh_level()
		elif value.get("kind", "") == "set_fault":
			fault = str(value.get("fault", "none"))
			await _fresh_level()
		elif value.get("kind", "") == "screenshot":
			if bool(value.get("bug_found", false)):
				status_label.modulate = Color("ffac84")
				status_label.text += "Rule check: FAIL • see BUG #01 below\nModel probability is not proof by itself."
			if DisplayServer.get_name() != "headless":
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(session_dir.path_join("evidence.png"))
		else:
			release_inputs()
			# Inject one-shot jump input inside the physics frame, before Player ticks.
			# Process-frame injection can expire while the QA world is paused.
			await physics_frame
			for action in value.get("actions", []):
				if InputMap.has_action(action):
					Input.action_press(action)
			for frame in clampi(int(value.get("frames", 8)), 1, 180):
				await frames(1)
				if value.has("stop_x") and current_scene != null:
					var x: float = current_scene.player.position.x
					if Input.is_action_pressed("move_right") and x >= float(value.stop_x):
						Input.action_release("move_right")
					if Input.is_action_pressed("move_left") and x <= float(value.stop_x):
						Input.action_release("move_left")
			release_inputs()
			await frames(2)
		actual_pause = paused
		seq += 1
		_publish()
		paused = true

func vector(value: Vector2) -> Dictionary:
	return {"x": snappedf(value.x, 0.01), "y": snappedf(value.y, 0.01)}

func _show_action(value: Dictionary) -> void:
	var captions := {
		"move_left": "A / ←  •  Sola get", "move_right": "D / →  •  Sağa get",
		"jump_left": "SPACE + A  •  Sola tullan", "jump_right": "SPACE + D  •  Sağa tullan",
		"climb_up": "W / ↑  •  Yuxarı qalx", "climb_down": "S / ↓  •  Aşağı en",
		"interact": "E  •  Qapını aç", "wait": "GÖZLƏ  •  Platformanın yaxınlaşmasını izlə",
		"locked_exit": "TEST  •  Açar olmadan qapı bağlı qalmalıdır",
		"death_reset": "TEST  •  Ölümdən sonra bütün səviyyə sıfırlanır",
		"pause_freeze": "TEST  •  Pauzada platformalar dayanmalıdır",
		"ladder_descent": "TEST  •  S ilə nərdivəndən aşağı enmək",
	}
	var chosen: String = str(value.get("action_label", value.get("probe", "")))
	if captions.has(chosen):
		action_caption.text = str(captions[chosen])
		if value.has("decision"):
			action_caption.text = "#%02d  " % int(value.decision) + action_caption.text
	elif bool(value.get("bug_found", false)):
		action_caption.text = "BUG TAPILDI  •  Qapı açarsız açıldı — aşağıda sübut var"
	else:
		action_caption.text = str(value.get("display", "LAYA CUDA"))

func _publish() -> void:
	var level: Node2D = current_scene
	var p: Adventurer = level.player
	var data: Dictionary = {
		"sequence": seq, "command_id": last_command, "fault": fault,
		"paused": actual_pause, "won": level.won, "resetting": level.resetting,
		"player": {"position": vector(p.position), "velocity": vector(p.velocity),
			"grounded": p.is_on_floor(), "climbing": p.climbing, "has_key": p.has_key, "enabled": p.enabled},
		"crate": vector(level.get_node("World/Crate").position),
		"horizontal": vector(level.get_node("World/HorizontalPlatform").position),
		"vertical": vector(level.get_node("World/VerticalPlatform").position),
		"key_visible": level.get_node("World/Key").visible,
		"door_open": level.door.is_open, "door_nearby": level.door.nearby != null,
		"probe": last_probe,
	}
	var tmp: String = session_dir.path_join("state-%d.tmp" % seq)
	var file := FileAccess.open(tmp, FileAccess.WRITE)
	file.store_string(JSON.stringify(data))
	file.close()
	DirAccess.rename_absolute(tmp, session_dir.path_join("state-%d.json" % seq))

func _probe(name: String) -> void:
	await _fresh_level()
	var level: Node2D = current_scene
	match name:
		"locked_exit":
			level.player.position = Vector2(384, 160)
			await frames(5)
			_show_evidence(false, true)
			await _capture("bug-before.png")
			await _hold_visible(6.0)
			Input.action_press("interact")
			await frames(3)
			release_inputs()
			_show_evidence(level.door.is_open and not level.player.has_key, false)
			await _capture("bug-after.png")
			await _hold_visible(8.0)
			last_probe = {"name": name, "passed": not level.won and not level.door.is_open,
				"expected": "The door stays locked without a key", "actual": "Door open: %s; victory: %s; key: %s" % [level.door.is_open, level.won, level.player.has_key]}
		"death_reset":
			level.player.position = Vector2(64, 256)
			await frames(5)
			var key_collected: bool = level.player.has_key
			level.get_node("World/Crate").position.x = 385.0
			level.player.position = Vector2(205, 383)
			await frames(55)
			level = current_scene
			var restored: bool = key_collected and not level.player.has_key and level.get_node("World/Key").visible and level.get_node("World/Crate").position.distance_to(Vector2(272,368)) < 3.0 and level.player.position.distance_to(Vector2(90,384)) < 3.0
			last_probe = {"name": name, "passed": restored, "expected": "Death restores spawn, key, crate, and locked door", "actual": "Collected first: %s; key after death: %s; crate: %s; spawn: %s" % [key_collected, level.player.has_key, level.get_node("World/Crate").position, level.player.position]}
		"pause_freeze":
			Input.action_press("pause")
			await frames(2)
			release_inputs()
			var before: Vector2 = level.get_node("World/HorizontalPlatform").position
			await frames(25)
			var frozen: bool = paused and before == level.get_node("World/HorizontalPlatform").position
			Input.action_press("pause")
			await frames(2)
			release_inputs()
			last_probe = {"name": name, "passed": frozen and not paused, "expected": "Escape freezes the world and resumes it", "actual": "Frozen: %s; resumed: %s" % [frozen, not paused]}
		"ladder_descent":
			level.player.position = Vector2(128, 256)
			await frames(5)
			Input.action_press("climb_down")
			await frames(100)
			release_inputs()
			await frames(10)
			last_probe = {"name": name, "passed": absf(level.player.position.y - 384.0) < 3.0, "expected": "S climbs through the landing to the floor", "actual": "Player feet y = %.2f" % level.player.position.y}
		_:
			last_probe = {"name": name, "passed": false, "expected": "Known probe", "actual": "Unknown probe requested"}

func _build_evidence_ui() -> void:
	evidence_panel = ColorRect.new()
	evidence_panel.position = Vector2(32, 296)
	evidence_panel.size = Vector2(704, 118)
	evidence_panel.color = Color("172a2f")
	evidence_panel.hide()
	ui.add_child(evidence_panel)
	evidence_title = Label.new()
	evidence_title.position = Vector2(14, 5)
	evidence_title.add_theme_font_size_override("font_size", 17)
	evidence_panel.add_child(evidence_title)
	evidence_detail = Label.new()
	evidence_detail.position = Vector2(14, 32)
	evidence_detail.add_theme_font_size_override("font_size", 13)
	evidence_panel.add_child(evidence_detail)
	repeat_button = Button.new()
	repeat_button.position = Vector2(523, 83)
	repeat_button.size = Vector2(167, 27)
	repeat_button.text = "REPLAY BUG (slow)"
	repeat_button.add_theme_font_size_override("font_size", 12)
	repeat_button.pressed.connect(_repeat_bug)
	evidence_panel.add_child(repeat_button)

func _show_evidence(bug: bool, before: bool) -> void:
	if evidence_panel == null:
		return
	current_scene.overlay.hide()
	evidence_panel.show()
	repeat_button.visible = bug and not before
	if before:
		evidence_title.text = "DOOR TEST • BEFORE PRESSING E"
		evidence_title.modulate = Color("efd887")
		evidence_detail.text = "Location: elevated CENTRAL door (red outline). Player inventory: EMPTY.\nDoor is CLOSED. The golden key is still on the LEFT shelf.\nLaya selected the door test. Next: press E without collecting the key."
	else:
		evidence_title.text = "BUG #01 • DOOR OPENS WITHOUT A KEY" if bug else "PASS • DOOR STAYS LOCKED WITHOUT A KEY"
		evidence_title.modulate = Color("ffab7c") if bug else Color("a6d28a")
		evidence_detail.text = "KEY MISSING  →  PRESS E  →  DOOR OPEN + VICTORY\nEXPECTED: LOCKED.  OBSERVED: OPEN.  Game-rule assertion confirms the defect.\nSeeded QA demo only • normal game unchanged • click REPLAY BUG to see it again." if bug else "KEY MISSING  →  PRESS E  →  DOOR LOCKED\nThis is the correct behavior. The key remains on the left shelf."
	if current_scene.get_node_or_null("BugMarker") == null:
		var marker := Node2D.new()
		marker.name = "BugMarker"
		marker.z_index = 20
		marker.set_script(preload("res://qa/bug_marker.gd"))
		current_scene.add_child(marker)

func _hold_visible(seconds: float) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var was_paused: bool = paused
	paused = true
	var deadline: int = Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		await process_frame
	paused = was_paused

func _capture(filename: String) -> void:
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(session_dir.path_join(filename))

func _repeat_bug() -> void:
	repeat_button.disabled = true
	status_label.text = "RECORDED BUG REPRODUCTION\nRepeating the test chosen by Laya.\nThis replay is not a new model decision."
	await _probe("locked_exit")
	paused = true
	repeat_button.disabled = false
	await _capture("bug-replayed.png")

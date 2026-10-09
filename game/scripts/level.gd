extends Node2D

@onready var player: Adventurer = $World/Player
@onready var door: Area2D = $World/Exit
@onready var key_status: Label = $HUD/Top/KeyStatus
@onready var hint: Label = $HUD/Hint
@onready var overlay: Control = $HUD/Overlay
@onready var overlay_title: Label = $HUD/Overlay/Card/Title
@onready var overlay_text: Label = $HUD/Overlay/Card/Description
@onready var resume_button: Button = $HUD/Overlay/Card/Resume
@onready var restart_button: Button = $HUD/Overlay/Card/Restart
var won: bool = false
var resetting: bool = false
var _toast_time: float = 0.0
var _death_timer: float = 0.0
var _sounds: Dictionary = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	$World.process_mode = Node.PROCESS_MODE_PAUSABLE
	player.died.connect(_on_death)
	$World/Key.collected.connect(_on_key)
	door.opened.connect(_on_victory)
	door.locked_attempt.connect(_on_locked)
	resume_button.pressed.connect(_toggle_pause)
	restart_button.pressed.connect(restart)
	$HUD/Overlay/Card/Quit.pressed.connect(func(): get_tree().quit())
	for sound_name in ["jump", "key", "locked", "death", "win"]:
		var audio := AudioStreamPlayer.new()
		audio.stream = load("res://assets/audio/" + sound_name + ".wav")
		audio.volume_db = -13.0
		add_child(audio)
		_sounds[sound_name] = audio
	toast("Find the key. The crate is your first step.", 4.0)

func _process(delta: float) -> void:
	if Input.is_action_just_pressed("restart"):
		restart()
		return
	if Input.is_action_just_pressed("pause") and not won and not resetting:
		_toggle_pause()
	if get_tree().paused:
		return
	if resetting:
		_death_timer -= delta
		if _death_timer <= 0.0:
			restart()
		return
	_toast_time = maxf(0.0, _toast_time - delta)
	if _toast_time <= 0.0:
		if door.nearby != null:
			hint.text = "[E] Open the exit" if player.has_key else "[E] Locked — find the golden key"
		elif player.climbing:
			hint.text = "W / S to climb   •   Space to jump off"
		else:
			hint.text = "Carry the key to the door above" if player.has_key else "Climb the left ladder to collect the key"

func play_sound(sound_name: String) -> void:
	# Accelerated headless physics tests have no real-time audio output.
	if DisplayServer.get_name() == "headless":
		return
	if _sounds.has(sound_name):
		_sounds[sound_name].play()

func _exit_tree() -> void:
	for audio in _sounds.values():
		audio.stop()
		audio.stream = null
	_sounds.clear()

func toast(message: String, duration: float = 2.5) -> void:
	hint.text = message
	_toast_time = duration

func _on_key() -> void:
	key_status.text = "KEY  FOUND"
	key_status.modulate = Color("f5d779")
	toast("Key found! Push the crate, cross the pit, and ride the lift.", 4.0)

func _on_locked() -> void:
	toast("The door is locked. The key waits on the left.")

func _on_death() -> void:
	if resetting or won:
		return
	resetting = true
	_death_timer = 0.65
	player.modulate = Color("eea47c")
	play_sound("death")
	toast("The dungeon resets — try again.", 1.0)

func _on_victory() -> void:
	won = true
	player.enabled = false
	get_tree().paused = true
	_show_overlay("DUNGEON CLEARED", "The key turns. A breath of fresh air.\nYou escaped Moss & Ember.", false)

func _toggle_pause() -> void:
	if won or resetting:
		return
	get_tree().paused = not get_tree().paused
	if get_tree().paused:
		_show_overlay("TAKE A BREATHER", "Your adventure will wait right here.", true)
	else:
		overlay.hide()

func _show_overlay(title: String, description: String, show_resume: bool) -> void:
	overlay_title.text = title
	overlay_text.text = description
	resume_button.visible = show_resume
	overlay.show()
	if show_resume:
		resume_button.grab_focus()
	else:
		restart_button.grab_focus()

func restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()

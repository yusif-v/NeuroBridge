extends Area2D

signal opened
signal locked_attempt
var nearby: Adventurer
var is_open: bool = false

func _ready() -> void:
	body_entered.connect(_entered)
	body_exited.connect(_exited)

func _process(_delta: float) -> void:
	if nearby == null or is_open or not nearby.enabled:
		return
	if Input.is_action_just_pressed("interact"):
		interact(nearby)

func interact(player: Adventurer) -> void:
	if is_open:
		return
	if not player.has_key:
		locked_attempt.emit()
		player.play_sound("locked")
		return
	is_open = true
	$Sprite2D.texture = preload("res://assets/door_open.png")
	player.play_sound("win")
	opened.emit()

func _entered(body: Node2D) -> void:
	if body is Adventurer:
		nearby = body

func _exited(body: Node2D) -> void:
	if body == nearby:
		nearby = null

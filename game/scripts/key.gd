extends Area2D

signal collected
var taken: bool = false
var _time: float = 0.0

func _ready() -> void:
	body_entered.connect(_collect)

func _process(delta: float) -> void:
	_time += delta
	$Sprite2D.position.y = -12.0 + roundf(sin(_time * 3.0) * 2.0)

func _collect(body: Node2D) -> void:
	if taken or not body is Adventurer:
		return
	taken = true
	body.has_key = true
	visible = false
	set_deferred("monitoring", false)
	body.play_sound("key")
	collected.emit()

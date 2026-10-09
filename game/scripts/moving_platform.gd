class_name DungeonMover
extends AnimatableBody2D

@export var travel: Vector2 = Vector2(120, 0)
@export_range(1.0, 20.0) var cycle_seconds: float = 5.0
@export_range(0.0, 1.0) var starting_phase: float = 0.0
@export var vertical_style: bool = false
var _origin: Vector2
var _elapsed: float = 0.0

func _ready() -> void:
	_origin = position
	_elapsed = starting_phase * cycle_seconds
	$Sprite2D.texture = preload("res://assets/lift.png") if vertical_style else preload("res://assets/ferry.png")

func _physics_process(delta: float) -> void:
	_elapsed += delta
	# AnimatableBody2D exposes this displacement as floor velocity to the player.
	var progress: float = (1.0 - cos(_elapsed * TAU / cycle_seconds)) * 0.5
	position = _origin + travel * progress

func reset_motion() -> void:
	_elapsed = starting_phase * cycle_seconds
	position = _origin

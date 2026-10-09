extends Node2D

var _time: float = 0.0
@export var phase: float = 0.0

func _process(delta: float) -> void:
	_time += delta
	$Sprite2D.frame = int((_time + phase) * 7.0) % 4
	$Glow.modulate.a = 0.28 + sin((_time + phase) * 8.0) * 0.025

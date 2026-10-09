class_name PushableCrate
extends CharacterBody2D

@export var gravity: float = 1000.0
var _push_velocity: float = 0.0
var _push_time: float = 0.0

func push(direction: float, speed: float) -> void:
	_push_velocity = direction * speed
	_push_time = 0.05

func _physics_process(delta: float) -> void:
	_push_time = maxf(0.0, _push_time - delta)
	velocity.x = _push_velocity if _push_time > 0.0 else 0.0
	velocity.y = minf(velocity.y + gravity * delta, 500.0)
	move_and_slide()
	if global_position.y > 460.0:
		var player: Adventurer = get_tree().get_first_node_in_group("player") as Adventurer
		if player != null:
			player.die()

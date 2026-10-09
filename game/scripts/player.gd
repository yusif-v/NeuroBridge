class_name Adventurer
extends CharacterBody2D

signal died

@export_category("Movement")
@export var move_speed: float = 145.0
@export var acceleration: float = 1400.0
@export var braking: float = 1800.0
@export var jump_speed: float = 390.0
@export var gravity: float = 1000.0
@export var maximum_fall_speed: float = 500.0
@export var climb_speed: float = 100.0
@export var coyote_time: float = 0.10
@export var jump_buffer_time: float = 0.12

@onready var sprite: Sprite2D = $Sprite2D
var has_key: bool = false
var enabled: bool = true
var climbing: bool = false
var ladders: Array[Area2D] = []
var _coyote: float = 0.0
var _jump_buffer: float = 0.0
var _animation_time: float = 0.0
var _ladder_cooldown: float = 0.0

func _physics_process(delta: float) -> void:
	if not enabled:
		return
	_animation_time += delta
	_ladder_cooldown = maxf(0.0, _ladder_cooldown - delta)
	var direction: float = Input.get_axis("move_left", "move_right")
	var vertical: float = Input.get_axis("climb_up", "climb_down")
	_coyote = coyote_time if is_on_floor() else maxf(0.0, _coyote - delta)
	_jump_buffer = maxf(0.0, _jump_buffer - delta)
	if Input.is_action_just_pressed("jump"):
		_jump_buffer = jump_buffer_time
	if ladders.is_empty():
		climbing = false
	elif absf(vertical) > 0.1 and _ladder_cooldown <= 0.0:
		climbing = true
	if climbing:
		var ladder: Area2D = ladders[0]
		global_position.x = move_toward(global_position.x, ladder.global_position.x, 240.0 * delta)
		velocity = Vector2(0.0, vertical * climb_speed)
		# Pass through the ladder's one-way landing while climbing down.
		# Endpoint clamps keep the adventurer above the solid dungeon floor.
		var bottom: float = ladder.global_position.y + ladder.height
		if vertical < 0.0 and global_position.y <= ladder.global_position.y:
			climbing = false
			_ladder_cooldown = 0.25
			velocity.y = 0.0
		elif vertical > 0.0 and global_position.y >= bottom:
			global_position.y = bottom
			climbing = false
			_ladder_cooldown = 0.25
			velocity.y = 0.0
		if _jump_buffer > 0.0:
			climbing = false
			_ladder_cooldown = 0.22
			velocity = Vector2(direction * move_speed, -jump_speed)
			_jump_buffer = 0.0
			play_sound("jump")
		elif absf(direction) > 0.1:
			climbing = false
			_ladder_cooldown = 0.18
	else:
		velocity.x = move_toward(velocity.x, direction * move_speed, (acceleration if direction else braking) * delta)
		velocity.y = minf(velocity.y + gravity * delta, maximum_fall_speed)
		if _jump_buffer > 0.0 and _coyote > 0.0:
			velocity.y = -jump_speed
			_jump_buffer = 0.0
			_coyote = 0.0
			play_sound("jump")
		if Input.is_action_just_released("jump") and velocity.y < -140.0:
			velocity.y *= 0.55
	collision_mask = 4 if climbing else 5
	move_and_slide()
	for index in get_slide_collision_count():
		var collision: KinematicCollision2D = get_slide_collision(index)
		var crate: PushableCrate = collision.get_collider() as PushableCrate
		if crate != null and absf(collision.get_normal().x) > 0.5 and direction != 0.0:
			crate.push(direction, move_speed * 0.65)
	if global_position.y > 444.0:
		die()
	_update_sprite(direction, vertical)

func _update_sprite(direction: float, vertical: float) -> void:
	if direction != 0.0:
		sprite.flip_h = direction < 0.0
	if climbing:
		sprite.frame = 5 if int(_animation_time * 8.0) % 2 == 0 or vertical == 0.0 else 4
	elif not is_on_floor():
		sprite.frame = 4
	elif absf(velocity.x) > 8.0:
		sprite.frame = 2 + int(_animation_time * 10.0) % 2
	else:
		sprite.frame = int(_animation_time * 2.0) % 2

func enter_ladder(ladder: Area2D) -> void:
	if not ladders.has(ladder):
		ladders.append(ladder)

func leave_ladder(ladder: Area2D) -> void:
	ladders.erase(ladder)

func die() -> void:
	if not enabled:
		return
	enabled = false
	died.emit()

func play_sound(sound_name: String) -> void:
	var level: Node = get_tree().get_first_node_in_group("level")
	if level != null:
		level.play_sound(sound_name)

@tool
extends Area2D

@export var height: float = 172.0:
	set(value):
		height = maxf(16.0, value)
		if is_node_ready():
			_update_geometry()
const TEXTURE = preload("res://assets/ladder.png")

func _ready() -> void:
	_update_geometry()
	if not Engine.is_editor_hint():
		body_entered.connect(_entered)
		body_exited.connect(_exited)

func _update_geometry() -> void:
	var shape := RectangleShape2D.new()
	shape.size = Vector2(24, height + 20)
	$CollisionShape2D.shape = shape
	$CollisionShape2D.position.y = height * 0.5
	queue_redraw()

func _draw() -> void:
	for y in range(0, int(height), 16):
		draw_texture(TEXTURE, Vector2(-8, y))

func _entered(body: Node2D) -> void:
	if body is Adventurer:
		body.enter_ladder(self)

func _exited(body: Node2D) -> void:
	if body is Adventurer:
		body.leave_ladder(self)

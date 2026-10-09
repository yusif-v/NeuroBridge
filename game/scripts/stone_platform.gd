@tool
extends StaticBody2D

@export var size: Vector2 = Vector2(128, 16):
	set(value):
		size = Vector2(maxf(1.0, value.x), maxf(1.0, value.y))
		if is_node_ready():
			_update_geometry()
@export var one_way: bool = true:
	set(value):
		one_way = value
		if is_node_ready():
			_update_geometry()
const STONE = preload("res://assets/stone.png")
const FILL = preload("res://assets/stone_fill.png")

func _ready() -> void:
	_update_geometry()

func _update_geometry() -> void:
	var shape := RectangleShape2D.new()
	shape.size = size
	$CollisionShape2D.shape = shape
	$CollisionShape2D.position = size * 0.5
	$CollisionShape2D.one_way_collision = one_way
	queue_redraw()

func _draw() -> void:
	for y in range(0, int(size.y), 16):
		for x in range(0, int(size.x), 16):
			var tile: Texture2D = STONE if y == 0 else FILL
			draw_texture_rect_region(tile, Rect2(x, y, minf(16, size.x - x), minf(16, size.y - y)), Rect2(0, 0, minf(16, size.x - x), minf(16, size.y - y)))

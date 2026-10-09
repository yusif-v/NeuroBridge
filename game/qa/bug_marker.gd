extends Node2D

func _draw() -> void:
	# Highlight the actual central exit and the uncollected key in the world.
	draw_rect(Rect2(356, 96, 56, 68), Color("ef916d"), false, 2.0)
	draw_line(Vector2(413, 120), Vector2(466, 101), Color("ef916d"), 2.0)
	draw_line(Vector2(413, 120), Vector2(422, 108), Color("ef916d"), 2.0)
	draw_line(Vector2(413, 120), Vector2(429, 122), Color("ef916d"), 2.0)
	draw_circle(Vector2(64, 236), 21.0, Color("e7ca68"), false, 2.0)

extends Area2D

func _ready() -> void:
	body_entered.connect(_hit)

func _hit(body: Node2D) -> void:
	if body is Adventurer:
		body.die()

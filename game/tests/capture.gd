extends SceneTree

func _initialize() -> void:
	_capture.call_deferred()

func _capture() -> void:
	change_scene_to_file("res://scenes/level.tscn")
	for i in 25:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://preview.png")
	quit()

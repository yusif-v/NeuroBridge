extends Node2D
var status: Label
func _ready():
    var title := Label.new()
    title.text = "DELIBERATE BUG / QA TEST FIXTURE"
    title.position = Vector2(70,80)
    title.add_theme_font_size_override("font_size",32)
    add_child(title)
    status = Label.new()
    status.text = "Press ENTER to trigger the seeded runtime error.\nThis is a separate test fixture, not the normal game."
    status.position = Vector2(70,180)
    status.add_theme_font_size_override("font_size",24)
    add_child(status)
func _input(event):
    if event is InputEventKey and event.pressed:
        status.text = "Seeded error triggered. Inspect the runtime log."
        var intentionally_missing: Node = null
        intentionally_missing.get_node("seeded_failure")

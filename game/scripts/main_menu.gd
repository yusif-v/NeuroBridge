extends Control
## Normal play stays inside Godot. The optional QA mode launches local CUDA Laya.

@export_file var python_executable: String = ""
@export_file var godot_executable: String = ""
@export_dir var qa_project_directory: String = ""

var normal_button: Button
var laya_button: Button
var status: Label
var demo_pid: int = -1
var status_path: String = ""
var poll_timer: float = 0.0
var project_directory: String

func _ready() -> void:
	get_tree().paused = false
	project_directory = qa_project_directory
	if project_directory.is_empty():
		project_directory = ProjectSettings.globalize_path("res://")
	_build_menu()
	# Keep the running demo identity when returning from normal play.
	if get_tree().has_meta("laya_demo_pid"):
		demo_pid = int(get_tree().get_meta("laya_demo_pid"))
		status_path = str(get_tree().get_meta("laya_status_path", ""))
		laya_button.disabled = OS.is_process_running(demo_pid)
	normal_button.grab_focus()

func _panel_style(fill: String, border: String) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(fill)
	style.border_color = Color(border)
	style.set_border_width_all(2)
	style.content_margin_left = 16
	style.content_margin_right = 16
	return style

func _label(text: String, rect: Rect2, font_size: int, tint: String = "b5c8b5") -> Label:
	var item := Label.new()
	item.text = text
	item.position = rect.position
	item.size = rect.size
	item.add_theme_font_size_override("font_size", font_size)
	item.add_theme_color_override("font_color", Color(tint))
	item.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(item)
	return item

func _button(text: String, rect: Rect2, gold: bool = false) -> Button:
	var item := Button.new()
	item.text = text
	item.position = rect.position
	item.size = rect.size
	item.add_theme_font_size_override("font_size", 19)
	item.add_theme_color_override("font_color", Color("f3dda5"))
	item.add_theme_stylebox_override("normal", _panel_style("203d36", "718e59" if not gold else "ba9350"))
	item.add_theme_stylebox_override("hover", _panel_style("345747", "f1d38b"))
	item.add_theme_stylebox_override("focus", _panel_style("345747", "f1d38b"))
	item.add_theme_stylebox_override("pressed", _panel_style("142c29", "f1d38b"))
	item.add_theme_stylebox_override("disabled", _panel_style("152a29", "425c4d"))
	add_child(item)
	return item

func _build_menu() -> void:
	var background := TextureRect.new()
	background.texture = preload("res://assets/dungeon_background.png")
	background.size = Vector2(768, 432)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var shade := ColorRect.new()
	shade.size = Vector2(768, 432)
	shade.color = Color(0.02, 0.06, 0.075, 0.65)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	_label("MOSS & EMBER", Rect2(36, 26, 690, 52), 36, "f2d38b")
	_label("Bir zindan. Bir açar. İki oyun rejimi.", Rect2(38, 80, 690, 28), 16)
	for x in [36, 394]:
		var card := Panel.new()
		card.position = Vector2(x, 132)
		card.size = Vector2(338, 172)
		card.add_theme_stylebox_override("panel", _panel_style("102a2d", "354d42"))
		add_child(card)
	normal_button = _button("NORMAL OYUN", Rect2(52, 149, 306, 54))
	normal_button.name = "NormalPlay"
	normal_button.pressed.connect(start_normal)
	_label("Macəranı özün oyna.", Rect2(54, 216, 302, 26), 17, "eee0b3")
	_label("Açarı topla, platformaları keç,\nkilidli qapıdan çıx.", Rect2(54, 248, 302, 48), 14)
	laya_button = _button("LAYA İLƏ BUG TESTİ", Rect2(410, 149, 306, 54), true)
	laya_button.name = "LayaDemo"
	laya_button.pressed.connect(start_laya)
	_label("AI oynasın. Qərarlarını izlə.", Rect2(412, 216, 302, 26), 17, "eee0b3")
	_label("CUDA modeli • 1.5× sürət\nSonda qəsdən əlavə edilmiş qapı bugı.", Rect2(412, 248, 302, 48), 14)
	status = _label("Rejimi seç. Laya testi ayrıca oyun pəncərəsində açılır.", Rect2(38, 322, 694, 56), 14)
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var quit_button := _button("ÇIXIŞ", Rect2(596, 385, 136, 32))
	quit_button.add_theme_font_size_override("font_size", 14)
	quit_button.pressed.connect(func(): get_tree().quit())
	_label("TAB / OXLAR  seç     ENTER  başlat", Rect2(38, 388, 536, 25), 12, "809b87")

func start_normal() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/level.tscn")

func _find_python() -> String:
	if not python_executable.is_empty():
		return python_executable
	var configured := OS.get_environment("LAYA_PYTHON")
	if not configured.is_empty():
		return configured
	var output: Array = []
	var executable := "where.exe" if OS.get_name() == "Windows" else "which"
	var candidates := ["pythonw", "python"] if OS.get_name() == "Windows" else ["python3", "python"]
	for candidate in candidates:
		output.clear()
		if OS.execute(executable, PackedStringArray([candidate]), output, false) == 0:
			for line in str(output[0]).split("\n"):
				var path := line.strip_edges()
				if FileAccess.file_exists(path) and not "WindowsApps" in path:
					return path
	return ""

func start_laya() -> void:
	if demo_pid > 0 and OS.is_process_running(demo_pid):
		return
	var launcher := project_directory.path_join("qa/launch_demo.py")
	if not FileAccess.file_exists(launcher):
		status.text = "Laya testi üçün mənbə layihəsini aç və qa qovluğunu saxla. Normal oyun hazırdır."
		return
	var python := _find_python()
	if python.is_empty():
		status.text = "Python tapılmadı. Python-u PATH-a əlavə et və ya LAYA_PYTHON yolunu təyin et."
		return
	var engine := godot_executable
	if engine.is_empty():
		engine = OS.get_environment("GODOT_BIN")
	if engine.is_empty():
		if OS.has_feature("template"):
			status.text = "QA testi üçün GODOT_BIN ilə Godot EXE yolunu ver və ya mənbə layihəsini Godot-da aç."
			return
		engine = OS.get_executable_path()
	var launch_dir := project_directory.path_join("qa/runs/menu-%s" % Time.get_ticks_usec())
	if DirAccess.make_dir_recursive_absolute(launch_dir) != OK:
		status.text = "Test hesabat qovluğu yaradıla bilmədi: " + launch_dir
		return
	status_path = launch_dir.path_join("launcher.json")
	var arguments := PackedStringArray([launcher, "--godot", engine, "--status", status_path])
	demo_pid = OS.create_process(python, arguments, false)
	if demo_pid <= 0:
		status.text = "Laya prosesi başlaya bilmədi. Python yolunu yoxla."
		return
	get_tree().set_meta("laya_demo_pid", demo_pid)
	get_tree().set_meta("laya_status_path", status_path)
	laya_button.disabled = true
	status.text = "Laya CUDA modeli yüklənir… İlk açılış bir neçə saniyə çəkə bilər."

func _process(delta: float) -> void:
	if demo_pid <= 0:
		return
	poll_timer -= delta
	if poll_timer > 0.0:
		return
	poll_timer = 0.5
	if FileAccess.file_exists(status_path):
		var parser := JSON.new()
		var parsed: Error = parser.parse(FileAccess.get_file_as_string(status_path))
		var data: Variant = parser.data if parsed == OK else null
		if data is Dictionary:
			status.text = str(data.get("message", "Laya testi işləyir…"))
	if not OS.is_process_running(demo_pid):
		laya_button.disabled = false
		demo_pid = -1
		get_tree().remove_meta("laya_demo_pid")

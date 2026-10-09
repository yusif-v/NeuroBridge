"""Source generator for the shipped, editable reusable Godot scenes."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCENES=ROOT/'scenes'
SCENES.mkdir(exist_ok=True)
def write(name,text):
    (SCENES/f'{name}.tscn').write_text(text.strip()+'\n',encoding='utf-8')

write('player','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/player.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/adventurer.png" id="2"]
[sub_resource type="RectangleShape2D" id="Body"]
size = Vector2(12, 23)
[node name="Player" type="CharacterBody2D" groups=["player"]]
collision_layer = 2
collision_mask = 5
floor_snap_length = 6.0
floor_stop_on_slope = true
platform_floor_layers = 5
platform_on_leave = 2
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(0, -12)
texture = ExtResource("2")
hframes = 6
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(0, -11.5)
shape = SubResource("Body")
''')
write('crate','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/crate.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/crate.png" id="2"]
[sub_resource type="RectangleShape2D" id="Body"]
size = Vector2(32, 32)
[node name="Crate" type="CharacterBody2D" groups=["crate"]]
collision_layer = 4
collision_mask = 1
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
texture = ExtResource("2")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("Body")
''')
write('moving_platform','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/moving_platform.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/ferry.png" id="2"]
[sub_resource type="RectangleShape2D" id="Body"]
size = Vector2(64, 10)
[node name="MovingPlatform" type="AnimatableBody2D"]
collision_layer = 1
collision_mask = 0
sync_to_physics = true
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(0, 8)
texture = ExtResource("2")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(0, 5)
shape = SubResource("Body")
one_way_collision = true
one_way_collision_margin = 6.0
''')
write('stone_platform','''
[gd_scene load_steps=2 format=3]
[ext_resource type="Script" path="res://scripts/stone_platform.gd" id="1"]
[node name="StonePlatform" type="StaticBody2D"]
collision_layer = 1
collision_mask = 0
script = ExtResource("1")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
one_way_collision_margin = 4.0
''')
write('ladder','''
[gd_scene load_steps=2 format=3]
[ext_resource type="Script" path="res://scripts/ladder.gd" id="1"]
[node name="Ladder" type="Area2D"]
collision_layer = 0
collision_mask = 2
script = ExtResource("1")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
''')
write('key','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/key.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/key.png" id="2"]
[sub_resource type="CircleShape2D" id="Body"]
radius = 14.0
[node name="Key" type="Area2D"]
collision_layer = 0
collision_mask = 2
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(0, -12)
texture = ExtResource("2")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(0, -12)
shape = SubResource("Body")
''')
write('exit_door','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/exit_door.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/door.png" id="2"]
[sub_resource type="RectangleShape2D" id="Body"]
size = Vector2(56, 64)
[node name="Exit" type="Area2D"]
collision_layer = 0
collision_mask = 2
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(0, -28)
texture = ExtResource("2")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(0, -28)
shape = SubResource("Body")
''')
write('spikes','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/spikes.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/spikes.png" id="2"]
[sub_resource type="RectangleShape2D" id="Body"]
size = Vector2(28, 10)
[node name="Spikes" type="Area2D"]
collision_layer = 0
collision_mask = 2
script = ExtResource("1")
[node name="Sprite2D" type="Sprite2D" parent="."]
position = Vector2(16, -8)
texture = ExtResource("2")
[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(16, -6)
shape = SubResource("Body")
''')
write('torch','''
[gd_scene load_steps=4 format=3]
[ext_resource type="Script" path="res://scripts/torch.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/torch.png" id="2"]
[ext_resource type="Texture2D" path="res://assets/glow.png" id="3"]
[node name="Torch" type="Node2D"]
script = ExtResource("1")
[node name="Glow" type="Sprite2D" parent="."]
position = Vector2(0, -5)
texture = ExtResource("3")
scale = Vector2(2, 2)
modulate = Color(1, 1, 1, 0.28)
[node name="Sprite2D" type="Sprite2D" parent="."]
texture = ExtResource("2")
hframes = 4
''')

out=['[gd_scene load_steps=16 format=3]']
resources=[('Script','scripts/level.gd','level'),('Texture2D','assets/dungeon_background.png','background')]
for name in ('player','crate','moving_platform','stone_platform','ladder','key','exit_door','spikes','torch'):
    resources.append(('PackedScene',f'scenes/{name}.tscn',name))
for typ,path,name in resources:
    out.append(f'[ext_resource type="{typ}" path="res://{path}" id="{name}"]')
out.append('''
[sub_resource type="StyleBoxFlat" id="Panel"]
bg_color = Color(0.058, 0.135, 0.15, 1)
border_width_left = 2
border_width_top = 2
border_width_right = 2
border_width_bottom = 2
border_color = Color(0.47, 0.62, 0.42, 1)
shadow_color = Color(0, 0, 0, 0.45)
shadow_size = 8
[sub_resource type="StyleBoxFlat" id="Button"]
bg_color = Color(0.20, 0.34, 0.28, 1)
border_width_bottom = 3
border_color = Color(0.12, 0.23, 0.21, 1)
[sub_resource type="StyleBoxFlat" id="Hover"]
bg_color = Color(0.36, 0.49, 0.32, 1)
border_width_bottom = 3
border_color = Color(0.73, 0.76, 0.48, 1)
[sub_resource type="Theme" id="Theme"]
default_font_size = 14
Button/colors/font_color = Color(0.96, 0.89, 0.7, 1)
Button/colors/font_focus_color = Color(1, 0.95, 0.8, 1)
Button/styles/normal = SubResource("Button")
Button/styles/hover = SubResource("Hover")
Button/styles/focus = SubResource("Hover")
Button/styles/pressed = SubResource("Button")
Label/colors/font_color = Color(0.7, 0.79, 0.69, 1)
[node name="MossAndEmber" type="Node2D" groups=["level"]]
script = ExtResource("level")
[node name="Background" type="Sprite2D" parent="."]
position = Vector2(384, 216)
texture = ExtResource("background")
[node name="World" type="Node2D" parent="."]
''')
def instance(name,resource,x,y,extra=''):
    out.append(f'[node name="{name}" parent="World" instance=ExtResource("{resource}")]\nposition = Vector2({x}, {y})\n{extra}')
for name,x,y,w,h,one in [
    ('Floor',32,384,416,48,False),('RightFloor',704,384,32,48,False),
    ('LeftBoundary',16,32,16,416,False),('RightBoundary',736,32,16,416,False),
    ('Ceiling',32,16,704,16,False),('KeyShelf',32,256,128,16,True),
    ('CrateShelf',336,288,112,16,True),('ExitShelf',320,160,128,24,True),
    ('UpperStep',496,160,56,16,True),('UpperRight',592,144,144,24,True),
    ('RightLanding',624,288,112,16,True)]:
    instance(name,'stone_platform',x,y,f'size = Vector2({w}, {h})\none_way = {str(one).lower()}')
instance('LeftLadder','ladder',128,234,'height = 150.0')
instance('Key','key',64,248)
instance('Exit','exit_door',384,160)
instance('Crate','crate',272,368)
instance('HorizontalPlatform','moving_platform',480,288,'travel = Vector2(120, 0)\ncycle_seconds = 5.2')
instance('VerticalPlatform','moving_platform',656,272,'travel = Vector2(0, -128)\ncycle_seconds = 6.0\nvertical_style = true')
instance('FloorSpikes','spikes',192,384)
for i,x in enumerate(range(448,704,32)):
    instance(f'PitSpikes{i}','spikes',x,416)
for i,(x,y) in enumerate(((55,226),(302,350),(407,119),(706,252),(605,103))):
    instance(f'Torch{i}','torch',x,y,f'phase = {i*0.7}')
instance('Player','player',90,384)
out.append('''
[node name="HUD" type="CanvasLayer" parent="."]
[node name="Top" type="ColorRect" parent="HUD"]
offset_right = 768.0
offset_bottom = 30.0
mouse_filter = 2
color = Color(0.033, 0.082, 0.1, 0.98)
[node name="Title" type="Label" parent="HUD/Top"]
offset_left = 24.0
offset_top = 4.0
offset_right = 300.0
offset_bottom = 26.0
theme = SubResource("Theme")
theme_override_colors/font_color = Color(0.93, 0.83, 0.59, 1)
theme_override_font_sizes/font_size = 18
text = "MOSS & EMBER"
[node name="KeyStatus" type="Label" parent="HUD/Top"]
offset_left = 478.0
offset_top = 6.0
offset_right = 624.0
offset_bottom = 26.0
theme = SubResource("Theme")
text = "KEY  MISSING"
horizontal_alignment = 2
[node name="LevelNumber" type="Label" parent="HUD/Top"]
offset_left = 654.0
offset_top = 6.0
offset_right = 742.0
offset_bottom = 26.0
theme = SubResource("Theme")
text = "DUNGEON 01"
horizontal_alignment = 2
[node name="Hint" type="Label" parent="HUD"]
offset_left = 32.0
offset_top = 39.0
offset_right = 736.0
offset_bottom = 62.0
theme = SubResource("Theme")
theme_override_font_sizes/font_size = 13
horizontal_alignment = 1
[node name="Footer" type="ColorRect" parent="HUD"]
offset_top = 416.0
offset_right = 768.0
offset_bottom = 432.0
mouse_filter = 2
color = Color(0.033, 0.082, 0.1, 0.98)
[node name="Controls" type="Label" parent="HUD/Footer"]
offset_left = 24.0
offset_right = 744.0
offset_bottom = 16.0
theme = SubResource("Theme")
theme_override_font_sizes/font_size = 11
text = "A/D  MOVE     SPACE  JUMP     W/S  CLIMB     E  OPEN     R  RESET     ESC  PAUSE"
horizontal_alignment = 1
[node name="Overlay" type="Control" parent="HUD"]
visible = false
layout_mode = 0
offset_right = 768.0
offset_bottom = 432.0
theme = SubResource("Theme")
[node name="Shade" type="ColorRect" parent="HUD/Overlay"]
offset_right = 768.0
offset_bottom = 432.0
color = Color(0.015, 0.05, 0.06, 0.86)
[node name="Card" type="Panel" parent="HUD/Overlay"]
offset_left = 182.0
offset_top = 92.0
offset_right = 586.0
offset_bottom = 364.0
theme_override_styles/panel = SubResource("Panel")
[node name="Title" type="Label" parent="HUD/Overlay/Card"]
offset_left = 12.0
offset_top = 24.0
offset_right = 392.0
offset_bottom = 52.0
theme_override_colors/font_color = Color(0.96, 0.86, 0.59, 1)
theme_override_font_sizes/font_size = 24
text = "TAKE A BREATHER"
horizontal_alignment = 1
[node name="Description" type="Label" parent="HUD/Overlay/Card"]
offset_left = 16.0
offset_top = 62.0
offset_right = 388.0
offset_bottom = 103.0
text = "Your adventure will wait right here."
horizontal_alignment = 1
[node name="Resume" type="Button" parent="HUD/Overlay/Card"]
offset_left = 92.0
offset_top = 118.0
offset_right = 312.0
offset_bottom = 153.0
text = "RESUME"
[node name="Restart" type="Button" parent="HUD/Overlay/Card"]
offset_left = 92.0
offset_top = 164.0
offset_right = 312.0
offset_bottom = 199.0
text = "RESTART ADVENTURE"
[node name="Quit" type="Button" parent="HUD/Overlay/Card"]
offset_left = 92.0
offset_top = 210.0
offset_right = 312.0
offset_bottom = 245.0
text = "QUIT GAME"
''')
write('level','\n'.join(out))
print('Ten reusable scenes and one complete level generated.')

"""Assemble a separate seeded dungeon build; never modify the normal game.

Uses an installed Godot editor and matching Linux engine runtime (or export template
binary). The resulting ZIP contains a native x86_64 engine and its matching PCK.
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('data/door-demo'))
    parser.add_argument('--control', action='store_true', help='Export the correctly locked control build')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    staging = output / 'source'
    staging.mkdir(parents=True, exist_ok=True)
    for directory in ('assets', 'scenes', 'scripts'):
        shutil.copytree(root / 'game' / directory, staging / directory, dirs_exist_ok=True)
    for filename in ('project.godot', 'export_presets.cfg'):
        shutil.copyfile(root / 'game' / filename, staging / filename)
    for file in (root / 'tests/fixtures/door_rule').glob('*'):
        if file.is_file():
            shutil.copyfile(file, staging / file.name)
    # Use complete reusable level scenes; inherited Control layout can change
    # offsets during pack export across Godot versions.
    control = (root / 'game/scenes/level.tscn').read_text(encoding='utf-8').replace(
        'res://scripts/level.gd', 'res://demo.gd')
    (staging / 'control.tscn').write_text(control, encoding='utf-8')
    (staging / 'demo.tscn').write_text(control.replace(
        'res://scenes/exit_door.tscn', 'res://faulty_exit.tscn'), encoding='utf-8')
    door = (root / 'game/scenes/exit_door.tscn').read_text(encoding='utf-8').replace(
        'res://scripts/exit_door.gd', 'res://faulty_exit.gd')
    (staging / 'faulty_exit.tscn').write_text(door, encoding='utf-8')
    project = staging / 'project.godot'
    scene = 'control' if args.control else 'demo'
    project.write_text(project.read_text(encoding='utf-8').replace(
        'res://scenes/main_menu.tscn', f'res://{scene}.tscn'), encoding='utf-8')
    godot = str(args.godot.resolve())
    subprocess.run([godot, '--headless', '--path', str(staging), '--editor', '--quit'], check=True, timeout=120)
    subprocess.run([godot, '--headless', '--path', str(staging), '--script', 'res://verify.gd'], check=True, timeout=60)
    name = 'DoorRuleControl' if args.control else 'DoorRuleBugDemo'
    pack = output / (name + '.pck')
    subprocess.run([godot, '--headless', '--path', str(staging), '--export-pack', 'Linux Desktop', str(pack)], check=True, timeout=120)
    binary = output / (name + '.x86_64')
    shutil.copyfile(args.runtime, binary)
    archive = output / (name + '-Linux.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        bundle.write(binary, binary.name)
        bundle.write(pack, pack.name)
    print(archive)


if __name__ == '__main__':
    main()

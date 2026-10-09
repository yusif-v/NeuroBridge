"""Create a self-contained source ZIP, excluding caches and the local Godot runtime."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parents[1]
destination = root / 'deliverables'
destination.mkdir(exist_ok=True)
archive = destination / 'MossAndEmber-Godot4.zip'
paths = [root / name for name in ('project.godot', 'export_presets.cfg', 'README.md',
                                  'LICENSE.txt', 'RunGame.cmd', 'RunLayaQA.cmd', 'RunLayaBugDemo.cmd', '.gitignore', '.gitattributes', 'preview.png')]
for folder in ('assets', 'scenes', 'scripts', 'tests', 'tools', 'qa'):
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and 'runs' not in p.relative_to(root).parts)
with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
    for p in paths:
        z.write(p, 'MossAndEmber/' + p.relative_to(root).as_posix())
print(f'{archive}: {len(paths)} files, {archive.stat().st_size:,} bytes')

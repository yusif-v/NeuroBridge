"""Fixed action vocabulary and screenshot packet; no shell or uploaded scripts."""
import base64
import json
from pathlib import Path
import subprocess
import sys
import time

KEYS = {'move_left': ['a'], 'move_right': ['d'], 'climb_up': ['w'], 'climb_down': ['s'],
        'jump_left': ['space', 'a'], 'jump_right': ['space', 'd'], 'interact': ['e'],
        'confirm': ['Return'], 'restart': ['r'], 'wait': []}
action = sys.argv[1] if len(sys.argv) > 1 else 'capture'
if action != 'capture':
    if action not in KEYS:
        raise SystemExit('Unknown action')
    keys = KEYS[action]
    try:
        for key in keys:
            subprocess.run(['xdotool', 'keydown', key], check=True)
        time.sleep(.55)
    finally:
        for key in keys:
            subprocess.run(['xdotool', 'keyup', key], check=False)
image = Path('/tmp/frame.png')
subprocess.run(['import', '-window', 'root', str(image)], check=True, timeout=10)
ocr = subprocess.run(['tesseract', str(image), 'stdout', '--psm', '11'], capture_output=True, text=True, timeout=15)
try:
    state = json.loads(Path('/tmp/state.json').read_text())
except (OSError, ValueError):
    state = {}
with open('/tmp/game.log', 'rb') as log:
    log.seek(0, 2)
    log.seek(max(0, log.tell() - 12000))
    tail = log.read().decode(errors='replace')
print(json.dumps({'image': base64.b64encode(image.read_bytes()).decode(),
                  'ocr': ocr.stdout[:4000], 'exit_code': state.get('exit_code'),
                  'log': tail}))

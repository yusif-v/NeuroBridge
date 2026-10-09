"""Runs only inside the disposable, offline Wine container."""
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import time

subprocess.Popen(['Xvfb', ':99', '-screen', '0', '1600x900x24', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
subprocess.Popen(['openbox'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
executable = Path('/game') / sys.argv[1]
if not executable.resolve().is_relative_to(Path('/game')) or not executable.is_file():
    raise SystemExit('Invalid sandbox entrypoint')
with open('/tmp/game.log', 'w') as log:
    with executable.open('rb') as source:
        native = source.read(4) == b'\x7fELF'
    if native:
        shutil.copytree('/game', '/home/player/game')
        executable = Path('/home/player/game') / executable.relative_to('/game')
        executable.chmod(0o755)
    command = [str(executable)] if native else ['wine', str(executable)]
    game = subprocess.Popen(command, cwd=executable.parent, stdout=log, stderr=subprocess.STDOUT)
    while True:
        state = {'exit_code': game.poll(), 'seconds': time.monotonic()}
        Path('/tmp/state.json').write_text(json.dumps(state))
        time.sleep(.25)

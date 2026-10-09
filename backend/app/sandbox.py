"""Docker boundary: only a read-only build is mounted; no model, host keys or Docker socket."""
import base64
import io
import json
import subprocess
import uuid

from PIL import Image, ImageChops, ImageStat

from .config import SANDBOX_IMAGE


def docker(*args, timeout=40):
    result = subprocess.run(['docker', *map(str, args)], capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-2000:] or 'Docker command failed')
    return result.stdout


def ready():
    try:
        docker('image', 'inspect', SANDBOX_IMAGE, timeout=4)
        return True, 'Sandbox image ready'
    except (OSError, RuntimeError, subprocess.TimeoutExpired):
        return False, 'Start Docker Desktop and build the sandbox image: docker build -t buglens-sandbox:local sandbox'


class Sandbox:
    def __init__(self, build, entrypoint):
        self.name = 'buglens-' + uuid.uuid4().hex
        self.previous = None
        try:
            self.start(build, entrypoint)
        except Exception:
            self.close()
            raise

    def start(self, build, entrypoint):
        docker('run', '-d', '--name', self.name, '--network', 'none', '--read-only',
               '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '--user', '1000:1000', '--memory', '2g', '--memory-swap', '2g',
               '--cpus', '2', '--pids-limit', '160', '--ulimit', 'nofile=1024:1024',
               '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m,mode=1777',
               '--tmpfs', '/home/player:rw,exec,nosuid,nodev,size=1g,uid=1000,gid=1000',
               '--mount', f'type=bind,source={build.resolve()},target=/game,readonly',
               SANDBOX_IMAGE, entrypoint)

    def act(self, action='capture'):
        packet = json.loads(docker('exec', self.name, 'python3', '/opt/buglens/control.py', action))
        raw = base64.b64decode(packet.pop('image'), validate=True)
        if len(raw) > 8 * 1024 * 1024:
            raise RuntimeError('Sandbox screenshot is too large')
        with Image.open(io.BytesIO(raw)) as image:
            if image.format != 'PNG' or image.width * image.height > 2_000_000:
                raise RuntimeError('Invalid sandbox screenshot')
            sample = image.convert('L').resize((160, 90))
            change = 0 if self.previous is None else ImageStat.Stat(ImageChops.difference(sample, self.previous)).mean[0]
            self.previous = sample
        packet['visual_change'] = round(change, 2)
        packet['image_bytes'] = raw
        return packet

    def close(self):
        try:
            docker('rm', '-f', self.name, timeout=10)
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            pass

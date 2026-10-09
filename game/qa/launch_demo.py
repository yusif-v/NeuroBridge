"""Background launcher used by the Godot menu; logs stay local and readable."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


def write_status(path, phase, message):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps({'phase': phase, 'message': message}, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--godot', required=True)
    parser.add_argument('--status', type=Path, required=True)
    args = parser.parse_args()
    args.status.parent.mkdir(parents=True, exist_ok=True)
    write_status(args.status, 'loading', 'Laya CUDA modeli yüklənir… Test pəncərəsi bir azdan açılacaq.')
    runner = Path(__file__).resolve().with_name('run_laya.py')
    command = [sys.executable, '-u', str(runner), '--godot', args.godot,
               '--device', 'cuda', '--demo', '--keep-open', '--speed', '0.5',
               '--decision-delay', '0.7', '--launcher-status', str(args.status)]
    try:
        with args.status.with_suffix('.log').open('w', encoding='utf-8') as log:
            result = subprocess.run(command, cwd=runner.parent.parent, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode in (0, 1):
            write_status(args.status, 'closed', 'Laya demosu bağlandı. Yenidən başlada və ya normal oyunu seçə bilərsən.')
        else:
            write_status(args.status, 'error', 'Test dayandı. CUDA/Python quruluşunu yoxla. Ətraflı log: ' + str(args.status.with_suffix('.log')))
        return result.returncode
    except Exception as exc:
        write_status(args.status, 'error', 'Laya başlaya bilmədi: ' + str(exc))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

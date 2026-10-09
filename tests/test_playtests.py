import io
import json
import stat
import struct
import zipfile

import pytest


def pe(machine=0x8664):
    header = bytearray(64)
    header[:2] = b'MZ'
    struct.pack_into('<I', header, 60, 64)
    return bytes(header) + b'PE\0\0' + struct.pack('<H', machine)


def bundle(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def send(client, data, name='build.zip', **fields):
    return client.post('/api/v1/playtests', files={'file': (name, data)},
                       data={'project': 'Test game', 'version': '1', **fields})


def test_upload_creates_queued_run_and_cancel(client):
    response = send(client, bundle({'Game/game.exe': pe(), 'Game/game.pck': b'data'}))
    assert response.status_code == 202, response.text
    job = response.json()
    assert job['status'] == 'queued' and job['entrypoint'] == 'Game/game.exe'
    assert client.get(f'/api/v1/runs/{job["run_id"]}').status_code == 200
    assert len(client.get('/api/v1/playtests').json()) == 1
    assert client.post(f'/api/v1/playtests/{job["id"]}/cancel').json()['status'] == 'cancelled'
    assert client.get(f'/api/v1/runs/{job["run_id"]}').json()['status'] == 'failed'


@pytest.mark.parametrize('name', ['../escape.exe', '/escape.exe', 'C:/escape.exe', 'a\\..\\escape.exe', 'game.exe:stream', 'CON.exe', 'folder./game.exe'])
def test_unsafe_zip_paths_rejected(client, name):
    assert send(client, bundle({name: pe()})).status_code == 422
    assert client.get('/api/v1/playtests').json() == []


def test_zip_symlink_rejected(client):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        link = zipfile.ZipInfo('game.exe')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(link, '../host.exe')
    assert send(client, buffer.getvalue()).status_code == 422


def test_entrypoint_ambiguity_and_bad_exe(client):
    zipped = bundle({'game.exe': pe(), 'uninstall.exe': pe()})
    assert send(client, zipped).status_code == 422
    assert send(client, zipped, entrypoint='game.exe').status_code == 202
    assert send(client, b'not exe', name='game.exe').status_code == 422
    assert send(client, pe(0x14c), name='game.exe').status_code == 422
    assert send(client, b'wrong type', name='project.godot').status_code == 415


def test_offline_capabilities_and_missing_frame(client):
    assert client.get('/api/v1/playtests/capabilities').json()['worker_online'] is False
    job = send(client, pe(), name='game.exe').json()
    assert client.get(f'/api/v1/playtests/{job["id"]}/frame').status_code == 404


def test_native_linux_zip_and_invalid_architecture(client):
    header = bytearray(64)
    header[:7] = b'\x7fELF\x02\x01\x01'
    struct.pack_into('<HH', header, 16, 2, 62)
    result = send(client, bundle({'Game.x86_64': bytes(header), 'Game.pck': b'assets'})).json()
    assert result['entrypoint'] == 'Game.x86_64' and result['status'] == 'queued'
    header[4] = 1
    assert send(client, bytes(header), name='Game.x86_64').status_code == 422


def test_exploration_does_not_reset_without_visible_failure(client):
    from backend.app.worker import available_actions
    options = available_actions('A/D MOVE R RESET KEY MISSING', ['confirm'])
    assert 'restart' not in options and 'confirm' not in options and 'move_left' in options
    assert 'restart' in available_actions('GAME OVER / RETRY', [])
    assert 'confirm' in available_actions('PRESS ENTER TO START', ['wait'])


def test_game_rule_is_observed_not_guessed(client):
    from backend.app.worker import finding
    packet = {'ocr': 'KEY MISSING\nDUNGEON CLEARED', 'log': ''}
    assert finding(packet, 'none') is None
    assert finding(packet, 'key-gated-exit')['category'] == 'logic'
    assert finding({'ocr': 'KEY FOUND\nDUNGEON CLEARED', 'log': ''}, 'key-gated-exit') is None
    assert finding({'ocr': '', 'log': 'wine: could not load kernel32.dll'}, 'none') is None
    assert finding({'ocr': '', 'log': 'SCRIPT ERROR: Invalid access on null'}, 'none')['category'] == 'crash'


def test_selected_door_rule_focuses_only_a_visible_interaction(client):
    from backend.app.worker import available_actions
    prompt = 'KEY MISSING. Test the locked exit with E before collecting the key.'
    assert set(available_actions(prompt, [], 'key-gated-exit')) == {'interact', 'wait'}
    assert 'jump_left' in available_actions(prompt, [], 'none')
    assert 'jump_left' in available_actions('Climb the left ladder. E OPEN', [], 'key-gated-exit')


def test_completed_job_cannot_be_cancelled(client):
    from backend.app.db import connect
    job = send(client, pe(), name='game.exe').json()
    with connect() as conn:
        conn.execute("UPDATE playtest_jobs SET status='completed' WHERE id=?", (job['id'],))
        conn.execute("UPDATE runs SET status='completed' WHERE id=?", (job['run_id'],))
    assert client.post(f'/api/v1/playtests/{job["id"]}/cancel').json()['status'] == 'completed'
    assert client.get(f'/api/v1/runs/{job["run_id"]}').json()['status'] == 'completed'


@pytest.mark.parametrize('reproduces', [True, False])
def test_worker_replays_in_fresh_sandbox_before_confirmation(client, monkeypatch, reproduces):
    from PIL import Image
    from backend.app import worker
    from backend.app.db import connect
    frame = io.BytesIO()
    Image.new('RGB', (20,20)).save(frame, format='PNG')
    initial = {'ocr': 'PLAY GAME', 'log': '', 'visual_change': 5, 'exit_code': None, 'image_bytes': frame.getvalue()}
    failure = {**initial, 'log': 'SCRIPT ERROR: Invalid access on null'}
    instances = []

    class SandboxDouble:
        def __init__(self, *args):
            self.number = len(instances)
            self.closed = False
            instances.append(self)
        def act(self, action='capture'):
            return failure if self.number == 0 or reproduces else initial
        def close(self):
            self.closed = True

    class AgentDouble:
        def system_one(self, *args, **kwargs):
            return {'answers': {'decision': {'choice': 'confirm', 'probabilities': {'confirm': 1}}}}

    monkeypatch.setattr(worker, 'Sandbox', SandboxDouble)
    monkeypatch.setattr(worker, 'ready', lambda: (True, 'test'))
    monkeypatch.setattr(worker, 'boot', lambda *args: initial)
    job = send(client, pe(), name='game.exe', budget=5).json()
    worker.run_job(job, AgentDouble())
    assert len(instances) == 2 and all(s.closed for s in instances)
    result = client.get(f'/api/v1/playtests/{job["id"]}').json()
    bug = client.get('/api/v1/bugs').json()[0]
    assert bug['verification'] == ('confirmed' if reproduces else 'not_reproduced')
    assert result['result']['confirmed_bugs'] == int(reproduces)
    assert client.get(f'/api/v1/bugs/{bug["id"]}').status_code == 200


def test_environment_failure_is_not_a_confirmed_game_bug(client, monkeypatch):
    from backend.app import worker
    monkeypatch.setattr(worker, 'ready', lambda: (False, 'Docker unavailable'))
    job = send(client, pe(), name='game.exe').json()
    worker.run_job(job, None)
    result = client.get(f'/api/v1/playtests/{job["id"]}').json()
    assert result['status'] == 'environment_error'
    assert client.get('/api/v1/bugs').json() == []


def test_sandbox_mount_does_not_expose_host_secrets_or_model(client, monkeypatch, tmp_path):
    from backend.app import sandbox
    calls = []
    monkeypatch.setattr(sandbox, 'docker', lambda *args, **kwargs: calls.append(args) or b'container-id')
    runner = sandbox.Sandbox(tmp_path, 'game.exe')
    args = calls[0]
    assert args[args.index('--network')+1] == 'none'
    assert '--read-only' in args and args[args.index('--cap-drop')+1] == 'ALL'
    assert args[args.index('--mount')+1].endswith('target=/game,readonly')
    assert '--gpus' not in args and not any('docker.sock' in str(a) for a in args)
    runner.close()

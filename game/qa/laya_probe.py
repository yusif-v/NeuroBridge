"""Verify real local Laya inference without downloading model weights."""
import json
import os
from pathlib import Path
import sys
import time
import warnings

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools' / 'laya_sdk'))
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['USE_TF'] = '0'
os.environ['USE_TORCH'] = '1'
warnings.filterwarnings('ignore', category=FutureWarning)

def cached_model():
    cache = Path(os.environ.get('HF_HUB_CACHE', os.environ.get('HUGGINGFACE_HUB_CACHE',
                 str(Path(os.environ.get('HF_HOME', str(Path.home()/'.cache/huggingface'))) / 'hub'))))
    for config in sorted((cache / 'models--convaiinnovations--laya' / 'snapshots').glob('*/multilingual/rl_agent_config.json')):
        if (config.parent / 'model.safetensors').is_file():
            return config.parent
    raise FileNotFoundError('No cached Laya multilingual checkpoint. Pass --model PATH to the runner.')

if __name__ == '__main__':
    import laya
    print('Loading Laya', laya.__version__, 'from', cached_model(), flush=True)
    start = time.perf_counter()
    agent = laya.load(str(cached_model()), device='cuda')
    print('Loaded on', agent.device, 'in', round(time.perf_counter()-start, 2), 'seconds', flush=True)
    result = agent.system_one('The player is standing beside a locked exit door. The player does not have the key. The golden key is on the left side of the dungeon.', {
        'next_action': {'type': 'choice', 'instructions': 'What should the player do next to escape?',
                        'criteria': {'get_key': 'Go collect the missing golden key.',
                                     'open_exit': 'Open the door with the key already in inventory.',
                                     'restart': 'Discard all progress and restart the level.'}}})
    print(json.dumps(result, ensure_ascii=True, indent=2), flush=True)

"""Small real-model calibration check for the keyboard decision schema."""
from laya_probe import cached_model
import laya

agent = laya.load(str(cached_model()), device='cuda')
options = {'move_right':'D or Right arrow: move RIGHT.',
           'move_left':'A or Left arrow: move LEFT.',
           'wait':'Press no buttons and stay still.'}
for state in ['The waypoint is to the RIGHT. Move towards the waypoint.',
              'The waypoint is to the LEFT. Move towards the waypoint.',
              'The character must move RIGHT to reach the target. The next action is move right.',
              'The character must move LEFT to reach the target. The next action is move left.',
              'The player must wait without movement until the platform reaches its destination.']:
    result = agent.system_one(state, {'action': {'type':'choice',
        'instructions':'Which keyboard action follows the required movement direction?',
        'criteria':options}})['answers']['action']
    print(state, result, flush=True)
for state in [
    'An adventurer with no key pressed E and escaped. The locked exit opened for this adventurer. It should only open with a key.',
    'Observed gameplay: the player did not have the golden key, but the door opened and the game declared victory.',
    'Observed gameplay: the player did not have the golden key. The door stayed closed and there was no victory.'
]:
    result=agent.system_one(state, {'result': {'type':'choice',
        'instructions':'What actually happened during this test?',
        'criteria':{'inventory_gate_bug':'The player escaped through an open door without a key.',
                    'correct_behavior':'The door remained closed because the player had no key.'}}})['answers']['result']
    print(state,result,flush=True)

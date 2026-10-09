"""Local CUDA Laya playtester. No services, screenshots-to-cloud, or game AI.

Laya selects test cases and movement actions. A documented waypoint guide supplies
route goals; real input and 60 Hz physics execute them. Invariants confirm bugs.
An unsuccessful model policy is reported as inconclusive, never as a game bug.
"""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

from laya_probe import ROOT, cached_model

PROBES = {
    'locked_exit': 'Test pressing E beside the locked exit without possessing the key.',
    'death_reset': 'Collect the key, move the crate, die on spikes, and inspect puzzle reset.',
    'pause_freeze': 'Pause and resume; ensure the moving platform freezes while paused.',
    'ladder_descent': 'Climb down the ladder through its landing using S.',
}
ACTIONS = {
    'move_left': ['move_left'], 'move_right': ['move_right'],
    'jump_left': ['jump', 'move_left'], 'jump_right': ['jump', 'move_right'],
    'climb_up': ['climb_up'], 'climb_down': ['climb_down'],
    'interact': ['interact'], 'wait': [],
}

class Bridge:
    def __init__(self, engine, folder, headless, fault, speed=0.5, decision_delay=0.7):
        self.folder, self.counter = folder, 0
        self.decision_delay=0.0 if headless else decision_delay
        self.log = open(folder/'godot.log', 'w', encoding='utf-8')
        command = [str(engine), '--path', str(ROOT),
                   '--script', 'res://qa/bridge.gd']
        if headless: command += ['--headless','--fixed-fps','60']
        command += ['--', '--qa-dir', str(folder), '--fault', fault, '--speed',str(speed)]
        self.process = subprocess.Popen(command, cwd=ROOT, stdout=self.log, stderr=subprocess.STDOUT)
        self.state = self.receive(-1)

    def receive(self, old_sequence, timeout=25):
        deadline = time.monotonic()+timeout
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError(f'Godot exited ({self.process.returncode}). See {self.folder / "godot.log"}')
            try:
                state = json.loads((self.folder/f'state-{old_sequence+1}.json').read_text(encoding='utf-8'))
                if state['sequence'] > old_sequence: return state
            except (FileNotFoundError, PermissionError, json.JSONDecodeError): pass
            time.sleep(.015)
        raise TimeoutError(f'No Godot response. See {self.folder / "godot.log"}')

    def send(self, command):
        if command.get('kind')!='stop': time.sleep(self.decision_delay)
        self.counter += 1
        command = dict(command, id=self.counter)
        temporary = self.folder/f'command-{self.counter}.tmp'
        temporary.write_text(json.dumps(command), encoding='utf-8')
        os.replace(temporary, self.folder/f'command-{self.counter}.json')
        if command.get('kind') != 'stop':
            self.state = self.receive(self.state['sequence'])
        return self.state

    def close(self):
        if self.process.poll() is None:
            try:
                self.send({'kind':'stop'})
                self.process.wait(timeout=5)
            except (OSError, subprocess.TimeoutExpired):
                self.process.terminate(); self.process.wait(timeout=5)
        self.log.close()

def infer(agent, state, options, question):
    start = time.perf_counter()
    answer = agent.system_one(state, {'decision': {'type':'choice', 'instructions':question,
                                 'criteria':options}}, max_len=1024)['answers']['decision']
    return answer, round((time.perf_counter()-start)*1000, 2)

def route_steps():
    return [
        {'kind':'move','x':128,'name':'walk to left ladder'},
        {'kind':'up','y':236,'name':'climb onto key shelf'},
        {'kind':'move','x':64,'key':True,'name':'collect golden key'},
        {'kind':'move','x':128,'name':'return to ladder'},
        {'kind':'down','y':382,'name':'climb down to floor'},
        {'kind':'move','x':174,'name':'approach floor spikes'},
        {'kind':'jump','x':238,'y':384,'name':'jump over floor spikes'},
        {'kind':'move','x':293,'name':'push crate near central shelf'},
        {'kind':'jump','crate':True,'y':352,'name':'jump onto crate'},
        {'kind':'jump','x':378,'y':288,'name':'jump from crate onto shelf'},
        {'kind':'move','x':432,'name':'reach ferry boarding edge'},
        {'kind':'ferry_ready','name':'wait for ferry to approach'},
        {'kind':'move','x':480,'name':'board horizontal ferry'},
        {'kind':'ferry_ride','name':'ride horizontal ferry across pit'},
        {'kind':'move','x':647,'name':'step onto right landing'},
        {'kind':'lift_ready','name':'wait for lift to lower'},
        {'kind':'jump','x':657,'name':'jump onto vertical lift'},
        {'kind':'lift_ride','name':'ride lift to upper ledge'},
        {'kind':'move','x':608,'name':'step onto upper right ledge'},
        {'kind':'jump','x':522,'y':160,'name':'jump left to stepping stone'},
        {'kind':'jump','x':421,'y':160,'name':'jump left to exit shelf'},
        {'kind':'move','x':384,'name':'walk to exit door'},
        {'kind':'exit','name':'open exit with E'},
    ]

def goal_reached(step, state):
    p, kind = state['player'], step['kind']
    x, y = p['position']['x'], p['position']['y']
    target = state['crate']['x'] if step.get('crate') else step.get('x', x)
    if kind == 'move': return p['has_key'] if step.get('key') else abs(x-target) <= 7
    if kind == 'up': return y <= step['y']
    if kind == 'down': return y >= step['y'] and p['grounded']
    if kind == 'jump':
        return step.get('started', False) and p['grounded'] and abs(x-target) < 12 and ('y' not in step or abs(y-step['y']) < 4)
    if kind == 'ferry_ready': return state['horizontal']['x'] < 491
    if kind == 'ferry_ride': return state['horizontal']['x'] > 592 and y < 292
    if kind == 'lift_ready': return state['vertical']['y'] > 250
    if kind == 'lift_ride': return y < 151
    if kind == 'exit': return state['won']
    return False

def movement_question(step, state):
    p, kind = state['player'], step['kind']
    x = p['position']['x']
    target = state['crate']['x'] if step.get('crate') else step.get('x', x)
    side = 'right' if target > x else 'left'
    text = ''
    if kind in ('ferry_ready','ferry_ride','lift_ready','lift_ride') or (kind == 'jump' and step.get('started')):
        options = {'wait':'Press no buttons and stay still.',
                   'move_left':'A or Left arrow: move LEFT.',
                   'move_right':'D or Right arrow: move RIGHT.'}
        text += 'The player must wait without movement until the platform or jump reaches its destination.'
    elif kind == 'up':
        options = {'climb_up':'W or Up arrow: climb UP the ladder.',
                   'climb_down':'S or Down arrow: climb DOWN the ladder.', 'wait':'Press no buttons and stay still.'}
        text += 'The player is at a ladder. The next landing is ABOVE the player. Travel up to that landing.'
    elif kind == 'down':
        options = {'climb_down':'S or Down arrow: climb DOWN the ladder.',
                   'climb_up':'W or Up arrow: climb UP the ladder.', 'wait':'Press no buttons and stay still.'}
        text += 'The player is at a ladder. The floor is BELOW the player. Travel down to the floor.'
    elif kind == 'exit':
        options = {'interact':'E: interact with the nearby door using the key.',
                   'wait':'Press no buttons and stay still.'}
        text += f'The player has the golden key: {p["has_key"]}. The exit door is nearby: {state["door_nearby"]}. Open the exit to escape.'
    elif kind == 'jump':
        options = {'jump_right':'Space + D: jump RIGHT.',
                   'jump_left':'Space + A: jump LEFT.', 'wait':'Press no buttons and stay still.'}
        text += f'The landing is to the {side.upper()}. A jump is needed to reach the landing.'
    else:
        options = {'move_right':'D or Right arrow: move RIGHT.',
                   'move_left':'A or Left arrow: move LEFT.', 'wait':'Press no buttons and stay still.'}
        text += f'The waypoint is to the {side.upper()}. Move towards the waypoint.'
    return text, options, target

def action_command(choice, step, state, target):
    kind = step['kind']
    command = {'kind':'action','actions':ACTIONS[choice], 'frames':12}
    if choice in ('jump_left','jump_right'):
        command.update(frames=55, stop_x=target)
        step['started'] = True
    elif choice in ('move_left','move_right') and kind in ('move','jump'):
        distance = abs(state['player']['position']['x']-target)
        command.update(frames=max(2,min(12,math.ceil(distance/145*60))), stop_x=target)
    elif choice == 'wait': command['frames'] = 18
    elif choice == 'interact': command['frames'] = 3
    return command

def make_report(folder, report):
    (folder/'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    lines = ['# Laya GPU playtest', '', f'- Model: Laya {report.get("laya_version", "unknown")}',
             f'- Device: {report.get("device", "unknown")}',
             f'- Injected demo fault: `{report.get("demo_fault", report["fault"])}`',
             f'- Confirmed invariant failures: **{len(report["bugs"])}**',
             f'- Guided route: **{report["route_status"]}**', '',
             'Laya selected probes and movement actions. A fixed waypoint guide supplied route goals.',
             'Bug confirmation uses executable invariants; a policy timeout is inconclusive.',
             'Probe setup may teleport actors; the guided escape route uses input only.', '',
             '| Probe | Result | Evidence |', '| --- | --- | --- |']
    for probe in report['probes']:
        result='PASS' if probe['passed'] else ('DEMO BUG' if probe.get('seeded_fault') else 'BUG')
        lines.append(f'| {probe["name"]} | {result} | {probe["actual"]} |')
    lines += ['', '## Evidence', '', '`trace.jsonl`: model probabilities, actions, and before/after game state.',
              '`godot.log`: engine output. `report.json`: structured results.', '',
              'Injected faults are QA-only demonstration defects, not findings in the normal game.']
    if report.get('error'): lines += ['', 'Runner error: '+report['error']]
    (folder/'report.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path)
    parser.add_argument('--device', default='cuda', choices=['cuda','cpu'])
    parser.add_argument('--godot', type=Path, help='Godot 4 executable; also found via GODOT_BIN or PATH.')
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--speed',type=float,default=0.5,help='Visible game playback speed, default 0.5.')
    parser.add_argument('--decision-delay',type=float,default=0.7,help='Real seconds between visible decisions.')
    parser.add_argument('--fault', default='none', choices=['none','door_without_key','ladder_down_blocked'])
    parser.add_argument('--max-decisions', type=int, default=180)
    parser.add_argument('--probes-only', action='store_true')
    parser.add_argument('--demo', action='store_true', help='Play normally, then inject and detect an isolated demo bug.')
    parser.add_argument('--keep-open', action='store_true', help='Leave the visible demo and loaded CUDA model open until its game window closes.')
    parser.add_argument('--replay', type=Path)
    args=parser.parse_args()
    if args.godot is None:
        bundled=ROOT/'.tools/godot/Godot_v4.6.2-stable_win64_console.exe'
        found=os.environ.get('GODOT_BIN') or (str(bundled) if bundled.is_file() else None) or shutil.which('godot') or shutil.which('godot4')
        if not found:
            parser.error('Godot 4 was not found. Use --godot PATH, set GODOT_BIN, or add godot.exe to PATH.')
        args.godot=Path(found)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder=ROOT/'qa/runs'/f'{stamp}-{args.fault}'
    folder.mkdir(parents=True)
    report={'fault':args.fault, 'device':args.device, 'probes':[], 'bugs':[],
            'route_status':'not run', 'guide':'waypoint-guided', 'decisions':0, 'session':str(folder)}
    bridge=None
    trace=open(folder/'trace.jsonl','w',encoding='utf-8')
    def execute(command, answer=None, state_text=None, inference_ms=None):
        before=bridge.state
        after=bridge.send(command)
        record={'command':command,'model_answer':answer,'model_state_text':state_text,
                'inference_ms':inference_ms,'before':before,'after':after}
        trace.write(json.dumps(record)+'\n'); trace.flush()
        return after
    try:
        if args.replay:
            bridge=Bridge(args.godot, folder, args.headless, args.fault,args.speed,args.decision_delay)
            for line in args.replay.read_text(encoding='utf-8').splitlines():
                record=json.loads(line)
                state=execute(record['command'])
                if state.get('probe'): report['probes'].append(state['probe'])
            report['route_status']='replayed; inspect trace for state comparison'
        else:
            import torch, laya
            if args.device=='cuda' and not torch.cuda.is_available():
                raise RuntimeError('CUDA is unavailable. CPU fallback is disabled for this GPU run.')
            model=args.model or cached_model()
            print('Loading actual Laya model on',args.device,'from',model,flush=True)
            started=time.perf_counter()
            agent=laya.load(str(model),device=args.device)
            if agent.device.type != args.device or next(agent.model.parameters()).device.type != args.device:
                raise RuntimeError('Model weights are not on the requested device.')
            report.update(laya_version=laya.__version__, model_path=str(model),
                          device=str(agent.device), gpu_name=torch.cuda.get_device_name(0) if args.device=='cuda' else None,
                          gpu_allocated_mb=round(torch.cuda.memory_allocated()/1024**2,1) if args.device=='cuda' else 0,
                          model_load_seconds=round(time.perf_counter()-started,2))
            print('Laya loaded on', report['gpu_name'] or report['device'], flush=True)
            bridge=Bridge(args.godot,folder,args.headless,args.fault,args.speed,args.decision_delay)
            remaining=dict(PROBES)
            while remaining:
                state_text='QA of a dungeon game. Pick the next untested requirement to investigate. Run each listed test once.'
                answer,ms=infer(agent,state_text,remaining,'Which test case should run next?')
                selected=answer['choice']
                result=execute({'kind':'probe','probe':selected,'display':selected,
                                'confidence':answer['answer_confidence'],'probabilities':answer['probabilities'],
                                'inference_ms':ms,'device':report['device']},answer,state_text,ms)['probe']
                report['probes'].append(result)
                if not result['passed']: report['bugs'].append(result)
                remaining.pop(selected)
                print(('PASS' if result['passed'] else 'BUG'),selected,'|',result['actual'],flush=True)
            execute({'kind':'reset','display':'start guided escape route'})
            if not args.probes_only and args.fault=='none':
                steps=route_steps(); index=0; route_started=time.perf_counter()
                while index<len(steps) and report['decisions']<args.max_decisions:
                    step=steps[index]; state=bridge.state
                    if state['won']:
                        report['route_status']='completed'; break
                    if state['resetting'] or not state['player']['enabled']:
                        report['route_status']='inconclusive: model-controlled player died'; break
                    if goal_reached(step,state):
                        print('Reached:',step['name'],flush=True)
                        index+=1; continue

                    if step['kind']=='jump' and step.get('started') and state['player']['grounded']:
                        step['started']=False
                        step['retries']=step.get('retries',0)+1
                        if step['retries']>3:
                            report['route_status']='inconclusive: jump goal not reached after retries'
                            break
                    state_text,options,target=movement_question(step,state)
                    answer,ms=infer(agent,state_text,options,'Which keyboard action follows the required movement direction?')
                    choice=answer['choice']
                    command=action_command(choice,step,state,target)
                    command.update(display=f'{index+1:02d}: {step["name"]} / {choice}',
                                   confidence=answer['answer_confidence'], action_label=choice,
                                   probabilities=answer['probabilities'], inference_ms=ms,
                                   device=report['device'], decision=report['decisions']+1)
                    execute(command,answer,state_text,ms)
                    report['decisions']+=1
                    if report['decisions']%10==0:
                        print('Decision',report['decisions'],choice,bridge.state['player']['position'],flush=True)
                if bridge.state['won']: report['route_status']='completed'
                elif report['route_status']=='not run': report['route_status']='inconclusive: decision limit reached'
                report['route_seconds']=round(time.perf_counter()-route_started,2)
                report['last_route_goal']=steps[min(index,len(steps)-1)]['name']
            elif args.fault!='none': report['route_status']='not run: isolated seeded-fault probes'
            if args.demo:
                report['demo_fault']='door_without_key'
                execute({'kind':'set_fault','fault':'door_without_key','display':'inject isolated demo fault'})
                remaining={'locked_exit':PROBES['locked_exit'], 'pause_freeze':PROBES['pause_freeze']}
                while remaining:
                    text='A separate QA demo build is ready. Pick an untested gameplay requirement to investigate.'
                    answer,ms=infer(agent,text,remaining,'Which test case should run next?')
                    selected=answer['choice']
                    result=execute({'kind':'probe','probe':selected,'display':'DEMO: '+selected,
                                    'confidence':answer['answer_confidence'],'probabilities':answer['probabilities'],
                                    'inference_ms':ms,'device':report['device']},answer,text,ms)['probe']
                    result=dict(result,seeded_fault='door_without_key')
                    report['probes'].append(result)
                    if not result['passed']:
                        report['bugs'].append(result)
                        print('SEEDED BUG CONFIRMED:',result['actual'],flush=True)
                        break
                    remaining.pop(selected)
                if report['bugs']:
                    bug=report['bugs'][-1]
                    observed=bridge.state
                    inventory='with a golden key' if observed['player']['has_key'] else 'with no key'
                    outcome='escaped' if observed['won'] else 'was unable to escape'
                    door_behavior='opened' if observed['door_open'] else 'remained closed'
                    text=f'An adventurer {inventory} pressed E and {outcome}. The locked exit {door_behavior} for this adventurer. It should only open with a key.'
                    judgement,ms=infer(agent,text,{
                        'inventory_gate_bug':'The player escaped through an open door without a key.',
                        'correct_behavior':'The door remained closed because the player had no key.'},
                        'What actually happened during this test?')
                    report['demo_model_judgement']=judgement
                    execute({'kind':'screenshot','display':'MODEL: '+judgement['choice'],
                             'confidence':judgement['answer_confidence'],'probabilities':judgement['probabilities'],
                             'inference_ms':ms,'device':report['device'],'bug_found':True},judgement,text,ms)
                    print('Laya bug judgement:',judgement,flush=True)
        if bridge:
            report['final_state']=bridge.state
            if not args.headless and not args.demo:
                execute({'kind':'screenshot','display':f'QA complete | bugs: {len(report["bugs"])}',
                         'confidence':1.0, 'device':report['device']})
    except Exception as exc:
        report['error']=str(exc)
        print('QA runner error:',exc,flush=True)
    finally:
        trace.close()
        make_report(folder,report)
        print('REPORT:',folder/'report.md',flush=True)
        if bridge and args.keep_open and not args.headless and not report.get('error'):
            print('DEMO COMPLETE: window and CUDA model remain open; close the game window to stop.',flush=True)
            while bridge.process.poll() is None: time.sleep(.25)
        if bridge: bridge.close()
    if report.get('error'): return 2
    if report['bugs']: return 1
    return 0 if report['route_status'] in ('completed','not run') else 3

if __name__=='__main__':
    raise SystemExit(main())

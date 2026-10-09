from test_platform import BUG, start


def seed_call(client, run, *, cost=None, tokens=(100, 20), status='done', model='test-model'):
    from backend.app.db import connect, now
    bug = client.post(f'/api/v1/ingest/runs/{run}/bugs', json=BUG).json()['bug_id']
    with connect() as conn:
        conn.execute('INSERT INTO ai_usage (bug_id,run_id,model,input_tokens,output_tokens,cost_usd,latency_ms,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                     (bug, run, model, *tokens, cost, 1000, status, now()))
    return bug


def test_unknown_and_partial_cost_never_become_zero(client):
    run = start(client)
    seed_call(client, run, cost=0.002)
    seed_call(client, run, tokens=(None, None), status='error', model=None)
    u = client.get('/api/v1/usage').json()
    assert u['ai']['cost_usd'] is None and u['ai']['known_cost_usd'] == 0.002
    assert u['ai']['calls_without_cost'] == 1 and u['ai']['calls_without_tokens'] == 1
    assert u['ai']['input_tokens'] == 100 and u['ai']['failed'] == 1
    assert u['unit']['total_cost_usd'] is None and u['unit']['cost_per_run_usd'] is None
    assert u['unit']['known_cost_usd'] == 0.002
    assert u['engine']['runs_without_cost'] == 1
    assert u['per_run'][0]['ai_cost_usd'] is None
    missing = next(m for m in u['by_model'] if m['model'] == 'Not recorded')
    assert missing['cost_usd'] is None and missing['calls_without_tokens'] == 1


def test_zero_is_known_and_average_includes_charged_failures(client):
    run = start(client)
    client.post(f'/api/v1/ingest/runs/{run}/finish', json={'stats': {'llm_cost_usd': 0, 'duration_s': 60, 'actions': 3}})
    seed_call(client, run, cost=0)
    seed_call(client, run, cost=0.004, status='error')
    u = client.get('/api/v1/usage').json()
    assert u['ai']['cost_per_analysis_usd'] == 0.002  # two charged requests, not one successful report
    assert u['unit']['total_cost_usd'] == 0.004 and u['unit']['cost_per_run_usd'] == 0.004
    assert u['engine']['play_minutes'] == 1 and u['engine']['actions'] == 3
    assert u['engine']['runs_without_cost'] == 0


def test_local_job_telemetry_includes_failed_actions_and_excludes_queue(client):
    from backend.app.db import connect, dumps, now
    run = start(client)
    queued = start(client, 'queued')
    with connect() as conn:
        for rid, state, actions, started, finished in [(run, 'environment_error', 7, '2026-10-09T10:00:00+00:00', '2026-10-09T10:02:00+00:00'), (queued, 'queued', 0, None, None)]:
            conn.execute('INSERT INTO playtest_jobs (id,run_id,filename,entrypoint,objective,budget,status,decision_count,created_at,started_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                         (str(rid), rid, 'game.zip', 'game', 'test', 10, state, actions, now(), started, finished))
        conn.execute('UPDATE runs SET stats=? WHERE id=?', (dumps({'actions': 2}), run))
    u = client.get('/api/v1/usage').json()
    assert u['engine']['actions'] == 7  # worker decision count overrides incomplete result stats
    assert u['engine']['play_minutes'] == 2 and u['engine']['runs_with_duration'] == 1
    assert u['engine']['local_runs'] == 2 and u['engine']['llm_cost_usd'] == 0
    assert u['per_run'][0]['status'] == 'environment_error'
    assert u['per_run'][0]['duration_source'] == 'timestamps'
    assert u['per_run'][1]['duration_s'] is None


def test_project_filter_empty_and_missing_duration(client):
    run = start(client)
    seed_call(client, run, cost=0.01)
    other = client.post('/api/v1/ingest/runs', json={'project': 'Other', 'build': '1'}).json()['run_id']
    seed_call(client, other, cost=0.02)
    u = client.get('/api/v1/usage', params={'project': 'Dungeon'}).json()
    assert u['ai']['calls'] == 1 and u['ai']['cost_usd'] == 0.01
    assert u['engine']['runs'] == 1 and u['engine']['runs_with_duration'] == 0
    assert u['engine']['runs_without_actions'] == 1
    empty = client.get('/api/v1/usage', params={'project': 'Absent'}).json()
    assert empty['ai']['calls'] == 0 and empty['per_run'] == []
    assert empty['unit']['cost_per_run_usd'] is None


def test_explicit_free_input_price_is_respected(client, monkeypatch):
    from backend.app import ai_bridge
    monkeypatch.setattr(ai_bridge, 'AI_PRICE_INPUT_PER_MTOK', 0)
    monkeypatch.setattr(ai_bridge, 'AI_PRICE_OUTPUT_PER_MTOK', 2)
    assert ai_bridge._cost({'input_tokens': 1000, 'output_tokens': 500}) == 0.001
    assert ai_bridge._cost({'input_tokens': 1000}) is None

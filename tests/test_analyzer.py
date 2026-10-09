import io
import json

import httpx
from PIL import Image
import pytest

from ai import analyzer


REPORT = {
    'summary': 'The exit granted victory while the golden key was missing.',
    'severity': 'high',
    'likely_root_cause': 'Hypothesis: the exit interaction omits the inventory check.',
    'recommended_fix': 'Check possession of the key before opening the exit.',
    'reproduction_steps': ['Start the QA build at the locked door without a key.', 'Press E.'],
    'confidence': 'high', 'evidence_refs': ['First observed failure', 'Independent replay evidence'],
    'insufficient_evidence': False,
}


def configure(monkeypatch):
    monkeypatch.setenv('AI_API_BASE_URL', 'https://qa-provider.invalid/v1')
    monkeypatch.setenv('AI_API_KEY', 'test-private-key')
    monkeypatch.setenv('AI_MODEL', 'cx/gpt-6.1-sol(high)')


def mock_provider(monkeypatch, handler):
    client_class = httpx.Client
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(analyzer.httpx, 'Client', lambda **kwargs: client_class(transport=transport, **kwargs))


def completion(report=REPORT, finish='stop'):
    return {'choices': [{'finish_reason': finish, 'message': {'content': json.dumps(report)}}],
            'usage': {'prompt_tokens': 1200, 'completion_tokens': 350}}


def test_multimodal_report_uses_requested_model_without_paths_or_secrets(client, monkeypatch):
    from backend.app.config import MEDIA_DIR
    configure(monkeypatch)
    screenshot = MEDIA_DIR / 'evidence.png'
    Image.new('RGB', (32, 32), 'green').save(screenshot)
    seen = []

    def handler(request):
        seen.append(request)
        payload = json.loads(request.content)
        assert payload['model'] == 'cx/gpt-6.1-sol(high)'
        assert payload['response_format']['json_schema']['strict'] is True
        assert request.headers['Authorization'] == 'Bearer test-private-key'
        assert str(screenshot).encode() not in request.content
        assert b'test-private-key' not in request.content
        assert payload['messages'][1]['content'][-1]['image_url']['url'].startswith('data:image/jpeg;base64,')
        return httpx.Response(200, json=completion())

    mock_provider(monkeypatch, handler)
    result = analyzer.analyze_bug({'actual': 'KEY MISSING + DUNGEON CLEARED', 'screenshots': [str(screenshot)],
                                  'screenshot_refs': [{'ref': 'screenshot:1', 'caption': 'First observed failure'}]})
    assert len(seen) == 1 and str(seen[0].url) == 'https://qa-provider.invalid/v1/chat/completions'
    assert result['summary'] == REPORT['summary'] and result['model'] == 'cx/gpt-6.1-sol(high)'
    assert result['usage']['input_tokens'] == 1200


@pytest.mark.parametrize('status', [401, 429, 503, 307])
def test_provider_errors_do_not_store_credentials_or_fake_a_report(monkeypatch, status):
    configure(monkeypatch)
    mock_provider(monkeypatch, lambda request: httpx.Response(status, json={'error': 'test-private-key'}))
    with pytest.raises(RuntimeError, match=f'HTTP {status}') as error:
        analyzer.analyze_bug({})
    assert 'test-private-key' not in str(error.value)


@pytest.mark.parametrize('body', [completion({'summary': 'Incomplete'}), completion(REPORT, 'length'),
                                 completion({**REPORT, 'insufficient_evidence': 'false'})])
def test_incomplete_or_unvalidated_model_output_is_rejected(monkeypatch, body):
    configure(monkeypatch)
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=body))
    with pytest.raises(analyzer.AnalysisError) as error:
        analyzer.analyze_bug({})
    assert error.value.usage['input_tokens'] == 1200
    assert error.value.usage['output_tokens'] == 350
    assert error.value.usage['model'] == 'cx/gpt-6.1-sol(high)'


def test_failed_report_retains_real_provider_usage(client, monkeypatch):
    from backend.app.ai_bridge import run_analysis
    from test_platform import start, BUG
    configure(monkeypatch)
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=completion({'summary': 'Incomplete'})))
    run = start(client)
    bug = client.post(f'/api/v1/ingest/runs/{run}/bugs', json=BUG).json()['bug_id']
    run_analysis(bug)
    u = client.get('/api/v1/usage').json()
    assert u['ai']['failed'] == 1 and u['ai']['input_tokens'] == 1200
    assert u['recent_calls'][0]['model'] == 'cx/gpt-6.1-sol(high)'
    assert u['recent_calls'][0]['cost_usd'] is None


def test_images_outside_evidence_store_are_not_read(client, monkeypatch, tmp_path):
    configure(monkeypatch)
    outside = tmp_path.parent / 'private.png'
    with pytest.raises(ValueError, match='evidence store'):
        analyzer.analyze_bug({'screenshots': [str(outside)]})


def test_confirmation_analyzes_once_and_exports_real_ai_report(client, monkeypatch):
    from backend.app.ai_bridge import analyze_confirmed
    from backend.app.db import connect
    run = client.post('/api/v1/ingest/runs', json={'project': 'Door QA', 'build': 'demo'}).json()['run_id']
    bug = client.post(f'/api/v1/ingest/runs/{run}/bugs', json={
        'title': 'Door opens without key', 'category': 'logic', 'expected': 'Key required',
        'actual': 'Victory without key', 'logs': [{'message': 'KEY MISSING + DUNGEON CLEARED'}]}).json()['bug_id']
    configure(monkeypatch)
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=completion())

    mock_provider(monkeypatch, handler)
    analyze_confirmed(bug)
    assert not requests  # Unverified findings never trigger automatic analysis.
    with connect() as conn:
        conn.execute("UPDATE bugs SET verification='confirmed' WHERE id=?", (bug,))
    analyze_confirmed(bug)
    analyze_confirmed(bug)
    detail = client.get(f'/api/v1/bugs/{bug}').json()
    assert len(requests) == 1 and detail['ai_status'] == 'done'
    assert detail['verification'] == 'confirmed' and detail['ai_report']['summary'] == REPORT['summary']
    assert 'usage' not in detail['ai_report'] and detail['ai_usage'][0]['input_tokens'] == 1200
    assert REPORT['summary'] in client.get(f'/api/v1/reports/runs/{run}?format=html').text
    assert REPORT['summary'] in client.get(f'/api/v1/reports/runs/{run}?format=md').text
    html = client.get(f'/api/v1/reports/runs/{run}?format=html').text
    assert REPORT['reproduction_steps'][0] in html and REPORT['evidence_refs'][0] in html


def test_pending_api_analysis_is_not_submitted_twice(client, monkeypatch):
    from backend.app.db import connect
    run = client.post('/api/v1/ingest/runs', json={'project': 'Door QA', 'build': 'demo'}).json()['run_id']
    bug = client.post(f'/api/v1/ingest/runs/{run}/bugs', json={'title': 'Door defect'}).json()['bug_id']
    configure(monkeypatch)
    with connect() as conn:
        conn.execute("UPDATE bugs SET ai_status='pending' WHERE id=?", (bug,))
    response = client.post(f'/api/v1/bugs/{bug}/analyze')
    assert response.status_code == 202 and response.json()['ai_status'] == 'pending'


def test_gateway_json_fences_are_validated(monkeypatch):
    configure(monkeypatch)
    body = completion()
    body['choices'][0]['message']['content'] = '```json\n'+json.dumps(REPORT)+'\n```'
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=body))
    assert analyzer.analyze_bug({})['summary'] == REPORT['summary']

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app, init_db


def setup_module(module):
    init_db(force_reset=True)


def login(client, email, password):
    return client.post('/api/login', json={'email': email, 'password': password})


def test_login_and_dashboard():
    client = app.test_client()
    resp = login(client, 'owner@vantis.local', 'demo1234')
    assert resp.status_code == 200
    dash = client.get('/api/dashboard')
    assert dash.status_code == 200
    payload = dash.get_json()
    assert payload['dashboard']['kpis']['open_chats'] >= 1
    assert payload['dashboard']['profile']['response_style']


def test_real_webchat_channel():
    client = app.test_client()
    login(client, 'owner@northbridge.local', 'demo1234')
    resp = client.post('/api/webchat/inbound', json={'customer_name': 'Test Lead', 'text': 'Can you send a quote today?'})
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload['ok'] is True
    assert payload['reply']


def test_quote_creates_finance_effect():
    client = app.test_client()
    login(client, 'owner@vantis.local', 'demo1234')
    quote = client.post('/api/quotes', json={
        'customer': 'Local Shop',
        'items': [{'sku': 'LAV-5', 'name': 'Lavandina 5L', 'unit_price': 4200, 'qty': 2}]
    })
    assert quote.status_code == 200
    ledger = client.get('/api/ledger').get_json()['entries']
    assert any('Quote for Local Shop' in e['concept'] for e in ledger)


def test_profile_and_backup_endpoints():
    client = app.test_client()
    login(client, 'owner@vantis.local', 'demo1234')
    update = client.post('/api/profile', json={
        'response_style': 'Premium Concierge',
        'personality_notes': 'Human and polished',
        'forbidden_tone': 'Robotic'
    })
    assert update.status_code == 200
    profile = client.get('/api/profile').get_json()['profile']
    assert profile['response_style'] == 'Premium Concierge'
    backup = client.get('/api/backup')
    assert backup.status_code == 200
    assert backup.mimetype == 'application/zip'


def test_three_business_simulations():
    client = app.test_client()
    resp = client.post('/api/simulations/run')
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload['ok'] is True
    assert len(payload['results']) == 3
    assert all(result['ok'] for result in payload['results'])

const crypto = require('crypto');

const BASE = 'http://localhost:3010';
const WEBHOOK_ID = 'wd_test_endpoint';
const SECRET = 'super-secret-key-123456';

function sign(secret, body) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

function check(name, condition, detail) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
}

(async () => {
  // 1. Register the webhook (simulates the dashboard bridge).
  const reg = await post(
    '/api/webhooks/register',
    JSON.stringify({
      webhooks: [{ webhookId: WEBHOOK_ID, secret: SECRET, strategyName: 'Test Strategy' }],
    })
  );
  check('register webhook', reg.status === 200, `${reg.status} ${reg.body}`);

  const payload = JSON.stringify({
    signalId: 'test-001',
    ticker: 'AAPL',
    action: 'buy',
    quantity: 5,
    price: 210.5,
    source: 'Suite de test',
  });

  // 2. Valid signature must be accepted.
  const ok = await post(`/api/webhook/${WEBHOOK_ID}`, payload, {
    'x-signaldesk-signature': sign(SECRET, payload),
  });
  check('valid signature accepted (202)', ok.status === 202, `${ok.status} ${ok.body}`);

  // 3. Wrong signature must be rejected.
  const bad = await post(`/api/webhook/${WEBHOOK_ID}`, payload, {
    'x-signaldesk-signature': sign('wrong-secret-value', payload),
  });
  check('wrong signature rejected (401)', bad.status === 401, `${bad.status} ${bad.body}`);

  // 4. Missing signature must be rejected.
  const none = await post(`/api/webhook/${WEBHOOK_ID}`, payload);
  check('missing signature rejected (401)', none.status === 401, `${none.status} ${none.body}`);

  // 5. Unknown webhook must not be distinguishable.
  const unknown = await post('/api/webhook/wd_does_not_exist', payload, {
    'x-signaldesk-signature': sign(SECRET, payload),
  });
  check('unknown webhook rejected (401)', unknown.status === 401, `${unknown.status} ${unknown.body}`);

  // 6. Tampered body must fail signature verification.
  const tampered = JSON.stringify({ ...JSON.parse(payload), quantity: 99999 });
  const tamper = await post(`/api/webhook/${WEBHOOK_ID}`, tampered, {
    'x-signaldesk-signature': sign(SECRET, payload),
  });
  check('tampered body rejected (401)', tamper.status === 401, `${tamper.status} ${tamper.body}`);

  // 7. Invalid payload shape must be rejected after signature passes.
  const invalid = JSON.stringify({ ticker: 'AAPL', action: 'not_a_real_action' });
  const badShape = await post(`/api/webhook/${WEBHOOK_ID}`, invalid, {
    'x-signaldesk-signature': sign(SECRET, invalid),
  });
  check('invalid payload rejected (422)', badShape.status === 422, `${badShape.status} ${badShape.body}`);

  // 8. Accepted signal must be readable from the polling endpoint.
  const stream = await fetch(`${BASE}/api/signals?cursor=0`);
  const data = await stream.json();
  const found = data.events.some((e) => e.signalId === 'test-001' && e.ticker === 'AAPL');
  check('signal available via /api/signals', found, JSON.stringify(data.events.slice(-2)));

  // 9. Cursor must prevent re-delivery.
  const after = await fetch(`${BASE}/api/signals?cursor=${data.cursor}`);
  const afterData = await after.json();
  check('cursor drains queue', afterData.events.length === 0, JSON.stringify(afterData));
})();

#!/usr/bin/env node
/**
 * Builds the public Postman collection + environment for the CAT PCI DSS API.
 *
 *   node postman/build-postman.mjs
 *
 * Writes postman/CAT-PCI-DSS-Compliance-API.postman_collection.json and
 * postman/CAT-Sandbox.postman_environment.json. Kept as code (not hand-edited
 * JSON) so the scripts inside each request stay readable and reviewable.
 */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIGNUP = 'https://banks.complianceassessmenttool.com/signup?utm_source=postman&utm_medium=collection';
const SITE = 'https://banks.complianceassessmenttool.com/pci-compliance-api?utm_source=postman&utm_medium=collection';
const DOCS = 'https://banks.complianceassessmenttool.com/docs?utm_source=postman&utm_medium=collection';

const lines = (s) => s.trim().split('\n');
const script = (listen, src) => ({ listen, script: { type: 'text/javascript', exec: lines(src) } });

const NEXT = `
function next(name) {
  if (pm.execution && pm.execution.setNextRequest) pm.execution.setNextRequest(name);
  else postman.setNextRequest(name);
}`;

function request({ name, method, path, body, description, tests, prerequest }) {
  const item = {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ['{{baseUrl}}'],
        path: path.replace(/^\//, '').split('?')[0].split('/'),
      },
      description,
    },
    event: [],
  };
  if (body) item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  if (prerequest) item.event.push(script('prerequest', prerequest));
  if (tests) item.event.push(script('test', tests));
  return item;
}

// ── 1 · Quickstart ───────────────────────────────────────────────────────

const quickstart = {
  name: '1 · Quickstart — a merchant\'s SAQ in 6 calls',
  description: lines(`
Run this folder top to bottom (or right-click it → **Run folder**). Each request saves the IDs the next one needs, so you never copy-paste.

1. **Create a merchant** — one of your customers.
2. **Add a payment method** — how they take cards, in their own words. Edit \`paymentDescription\` in the collection variables to try your own scenario.
3. **Determine the SAQ** — starts an asynchronous job.
4. **Check the determination** — poll until it finishes (10–40 s). In the Collection Runner this repeats automatically; by hand, just press **Send** again.
5. **Answer CAT's question** — when CAT needs more detail it asks a plain-English question; put the answer in \`followUpAnswer\`. Repeat 4–5 until the SAQ is determined.
6. **Create the assessment link** — the URL you'd send the merchant (or embed in your portal).
`).join('\n'),
  item: [
    request({
      name: '1.1 Create a merchant',
      method: 'POST', path: '/v1/merchants',
      body: { name: 'Corner Bakery', email: 'owner@cornerbakery.example', externalMerchantId: 'postman-{{$timestamp}}' },
      description: 'Creates a merchant under your partner account. `externalMerchantId` is your own ID for them, so you can match records later.',
      tests: `
const res = pm.response.json();
if (pm.response.code === 403 && res.code === 'SANDBOX_LIMIT') {
  pm.test('Sandbox is capped at 5 merchants — run "4 · Sandbox housekeeping › Delete this merchant" or delete one with DELETE /v1/merchants/{id}', () => { throw new Error(res.message); });
} else {
  pm.test('Merchant created (201)', () => pm.response.to.have.status(201));
  if (res.id) pm.collectionVariables.set('merchantId', res.id);
}`,
    }),
    request({
      name: '1.2 Add a payment method',
      method: 'POST', path: '/v1/merchants/{{merchantId}}/payment-methods',
      body: { name: 'Online store', description: '{{paymentDescription}}' },
      description: 'A payment method is one way the merchant takes cards (an online store, a counter terminal, phone orders…). Each one gets its own SAQ. The description is plain English — exactly what the merchant would say.',
      tests: `
pm.test('Payment method added', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
const res = pm.response.json();
if (res.id) pm.collectionVariables.set('pmId', res.id);`,
    }),
    request({
      name: '1.3 Determine the SAQ',
      method: 'POST', path: '/v1/merchants/{{merchantId}}/payment-methods/{{pmId}}/determine',
      body: { description: '{{paymentDescription}}' },
      description: 'Starts SAQ determination and returns `202` with a job to poll. (Add `?wait=1` to wait synchronously — bounded at 27 s.)',
      tests: `
pm.test('Determination started (202)', () => pm.response.to.have.status(202));
const res = pm.response.json();
if (res.jobId) pm.collectionVariables.set('jobId', res.jobId);
pm.collectionVariables.set('pollCount', '0');
pm.collectionVariables.set('followUpRounds', '0');`,
    }),
    request({
      name: '1.4 Check the determination',
      method: 'GET', path: '/v1/jobs/determine/{{jobId}}',
      description: 'Poll until `status` is `COMPLETED`. The result is either a **determined** SAQ type with the reasoning, or **needs-followup** with a plain-English question for the merchant (answer it with 1.5, then check again).',
      prerequest: `
// Give the job a moment between polls.
setTimeout(() => {}, 3000);`,
      tests: `${NEXT}
const body = pm.response.json();
const n = Number(pm.collectionVariables.get('pollCount') || 0) + 1;
pm.collectionVariables.set('pollCount', String(n));

if (pm.response.code !== 200) {
  // A failed poll must stop here, not fall through as a "result".
  pm.test('Could not check the job (HTTP ' + pm.response.code + ') — run 1.3 first', () => {
    throw new Error(body.message || body.code || 'request failed');
  });
  next(null);
} else if (body.status === 'PROCESSING') {
  pm.test('Still working — press Send again in a few seconds (the Runner retries automatically)', () => true);
  if (n < 40) next(pm.info.requestName);
} else if (body.status === 'FAILED') {
  pm.test('Determination failed', () => { throw new Error(body.errorMessage || 'unknown error'); });
} else {
  pm.collectionVariables.set('pollCount', '0');
  const r = body.result || {};
  if (r.threadId) pm.collectionVariables.set('threadId', r.threadId);
  if (r.status === 'needs-followup') {
    pm.collectionVariables.set('followUpQuestion', r.followUpQuestion || '');
    const rounds = Number(pm.collectionVariables.get('followUpRounds') || 0) + 1;
    pm.collectionVariables.set('followUpRounds', String(rounds));
    pm.test('CAT asks: ' + r.followUpQuestion, () => true);
    // The Runner re-sends the same stored answer, so stop after a few rounds
    // rather than loop: the question needs a new answer from a person.
    if (rounds <= 3) next('1.5 Answer the question from CAT');
    else {
      pm.test('Still asking after 3 answers — write a new answer in followUpAnswer, then send 1.5 by hand', () => { throw new Error(r.followUpQuestion); });
      next(null);
    }
  } else {
    pm.collectionVariables.set('followUpRounds', '0');
    pm.collectionVariables.set('saqType', r.saqType || '');
    pm.test('SAQ determined: ' + r.saqType, () => pm.expect(r.saqType).to.match(/^SAQ /));
    next('1.6 Create the assessment link');
  }
  pm.visualizer.set(\`
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;color:#0f172a}
 .tag{display:inline-block;background:#4338ca;color:#fff;border-radius:999px;padding:4px 14px;font-weight:700;font-size:18px}
 .q{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin-top:12px}
 p{line-height:1.6}
 a{color:#4338ca}
</style>
{{#if saqType}}<div class="tag">{{saqType}}</div><p>{{reason}}</p>{{/if}}
{{#if followUpQuestion}}<div class="q"><strong>CAT asks:</strong><br>{{followUpQuestion}}<br><br>Put your answer in the <code>followUpAnswer</code> collection variable and send <strong>1.5</strong>.</div>{{/if}}
<p style="font-size:12px;color:#64748b">Compliance Assessment Tool — <a href="${SITE}">PCI DSS compliance API</a></p>\`,
    { saqType: r.saqType, reason: r.reason, followUpQuestion: r.status === 'needs-followup' ? r.followUpQuestion : null });
}`,
    }),
    request({
      name: '1.5 Answer the question from CAT',
      method: 'POST', path: '/v1/merchants/{{merchantId}}/payment-methods/{{pmId}}/followup',
      body: { answer: '{{followUpAnswer}}', threadId: '{{threadId}}' },
      description: 'When 1.4 returns `needs-followup`, answer CAT\'s question in plain English. The default `followUpAnswer` fits the sample online-store scenario. Then send **1.4** again.',
      tests: `${NEXT}
pm.test('Answer accepted (202)', () => pm.response.to.have.status(202));
const res = pm.response.json();
if (res.jobId) pm.collectionVariables.set('jobId', res.jobId);
pm.collectionVariables.set('pollCount', '0');
next('1.4 Check the determination');`,
    }),
    request({
      name: '1.6 Create the assessment link',
      method: 'POST', path: '/v1/merchants/{{merchantId}}/portal-link',
      body: {},
      description: 'Returns the links that put the merchant into their assessment:\n\n- `standalonePortalUrl` — send it by email or SMS\n- `embedUrl` — drop it in an iframe in your own portal (white-label)\n- `handoffUrl` — redirect the merchant and get them back with a status when they finish\n\nThe merchant then answers one plain-English question per requirement, reviews, signs, and receives the official SAQ + AoC PDFs.',
      tests: `
pm.test('Links created', () => pm.response.to.have.status(200));
const res = pm.response.json();
if (res.standalonePortalUrl) pm.collectionVariables.set('assessmentUrl', res.standalonePortalUrl);
pm.visualizer.set(\`
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;color:#0f172a} a{color:#4338ca;word-break:break-all} li{margin:8px 0}</style>
<h3 style="margin-top:0">Send this to the merchant</h3>
<ul>
 <li><strong>Standalone:</strong> <a href="{{standalonePortalUrl}}" target="_blank">open the assessment</a></li>
 <li><strong>Embed (iframe):</strong> <code>{{embedUrl}}</code></li>
</ul>
<p style="font-size:12px;color:#64748b">Sandbox documents are watermarked TEST. Production: $25 per completed assessment.</p>\`, res);`,
    }),
  ],
};

// ── 2 · Portfolio ────────────────────────────────────────────────────────

const portfolio = {
  name: '2 · Your account & portfolio',
  description: 'Read-only views of your partner account and merchant book.',
  item: [
    request({
      name: 'Your partner account',
      method: 'GET', path: '/v1/partner',
      description: 'Confirms which account your key belongs to, whether it is a sandbox (`testMode`), and your webhook configuration.',
      tests: `pm.test('Key works', () => pm.response.to.have.status(200));`,
    }),
    request({
      name: 'Portfolio compliance rollup',
      method: 'GET', path: '/v1/portfolio',
      description: 'Partner-wide compliance status — compliant, in progress, expiring — for your dashboard.',
      tests: `pm.test('Portfolio returned', () => pm.response.to.have.status(200));`,
    }),
    request({
      name: 'List merchants',
      method: 'GET', path: '/v1/merchants',
      description: 'Every merchant under your partner account.',
      tests: `pm.test('Merchants listed', () => pm.response.to.have.status(200));`,
    }),
    request({
      name: 'This merchant\'s assessments',
      method: 'GET', path: '/v1/merchants/{{merchantId}}/attempts',
      description: 'SAQ assessments for the merchant from the quickstart, with progress and whether each is due for annual renewal.',
      tests: `pm.test('Assessments listed', () => pm.response.to.have.status(200));`,
    }),
  ],
};

// ── 3 · Webhooks ─────────────────────────────────────────────────────────

const SKIP_IF_NO_URL = `
if (!pm.variables.get('webhookUrl')) {
  console.log('Set the webhookUrl collection variable (e.g. a https://webhook.site URL) to try webhooks.');
  if (pm.execution && pm.execution.skipRequest) pm.execution.skipRequest();
}`;

const webhooks = {
  name: '3 · Webhooks',
  description: lines(`
CAT signs every webhook: \`X-CAT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">\` using your webhook secret. Events: \`saq.submitted\`, \`merchant.compliant\`, \`merchant.expiring_soon\`, \`merchant.expired\`, \`payment_method.added\`, \`ping\`.

To try it, set the \`webhookUrl\` collection variable to a test receiver (for example a free https://webhook.site URL), then run these two requests. Verify signatures with an HMAC-SHA256 over \`<t>.<raw body>\` and a constant-time compare — ready-made verifiers in Node and Python: https://github.com/Compliance-Assessment-Tool/cat-pci-api-examples
`).join('\n'),
  item: [
    request({
      name: 'Point webhooks at your receiver',
      method: 'PUT', path: '/v1/partner/webhook',
      body: { webhookUrl: '{{webhookUrl}}' },
      prerequest: SKIP_IF_NO_URL,
      description: 'Sets the URL CAT delivers signed events to.',
      tests: `pm.test('Webhook URL saved', () => pm.response.to.have.status(200));`,
    }),
    request({
      name: 'Send a test webhook',
      method: 'POST', path: '/v1/partner/webhook-test',
      prerequest: SKIP_IF_NO_URL,
      description: 'Sends a signed `ping` to your receiver and reports the delivery result.',
      tests: `pm.test('Test webhook delivered', () => pm.response.to.have.status(200));`,
    }),
  ],
};

// ── 4 · Housekeeping ─────────────────────────────────────────────────────

const housekeeping = {
  name: '4 · Sandbox housekeeping',
  description: 'Sandbox accounts hold up to 5 merchants. Delete the quickstart merchant when you are done.',
  item: [
    request({
      name: 'Delete this merchant (sandbox only)',
      method: 'DELETE', path: '/v1/merchants/{{merchantId}}',
      description: 'Removes the merchant created by the quickstart. Available on sandbox accounts only.',
      tests: `pm.test('Merchant deleted', () => pm.response.to.have.status(200));
pm.collectionVariables.set('merchantId', '');`,
    }),
  ],
};

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: 'CAT — PCI DSS Compliance API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: lines(`
# PCI DSS compliance for your whole merchant portfolio

**Compliance Assessment Tool (CAT)** is a white-label PCI DSS self-assessment API for **ISOs, acquiring banks, PayFacs and MSPs**.

Your merchants describe how they take card payments in plain English, and CAT asks plain-English questions until it has what it needs. CAT works out the correct **PCI DSS v4.0.1 Self-Assessment Questionnaire** for each payment method — SAQ A, A-EP, B, B-IP, C, C-VT, P2PE, SPoC or D — walks the merchant through it one plain-English question at a time, and produces the official, signed **SAQ and Attestation of Compliance (AoC)** PDFs. Signed webhooks and a portfolio API tell your systems who is compliant, in progress or expiring.

## Start in 2 minutes

1. **Get a free sandbox key:** ${SIGNUP} — issued as soon as you verify your email.
2. **Fork this collection** (or the **CAT Sandbox** environment), select the environment, and paste your key into \`apiKey\`.
3. **Run the "1 · Quickstart" folder.** In under a minute you'll have the SAQ for a sample merchant and the link to send them.

## Authentication

Every request sends your key in the \`X-API-Key\` header (set once on this collection). Sandbox keys start \`cat_test_\`; documents are watermarked TEST and nothing is billed.

## Ways to integrate

| Path | Lift |
|---|---|
| Bulk invite — branded email links to every merchant | Zero code |
| Platform redirect — merchants return to you with a status | One endpoint |
| Embedded white-label iframe | Small |
| REST API — this collection | Custom |
| MCP server for AI agents and chatbots | Custom |

## Links

- Product: ${SITE}
- Docs: ${DOCS}
- OpenAPI 3.1 spec: https://api.complianceassessmenttool.com/openapi.json
- Code examples (curl, Node, Python, webhook verification): https://github.com/Compliance-Assessment-Tool/cat-pci-api-examples
- Contact: chris.larson@complianceassessmenttool.com

*CAT facilitates merchant PCI DSS self-assessment. It is not a Qualified Security Assessor and does not certify compliance; acquirers set each merchant's validation requirements. The API never accepts cardholder data.*
`).join('\n'),
  },
  auth: {
    type: 'apikey',
    apikey: [
      { key: 'key', value: 'X-API-Key', type: 'string' },
      { key: 'value', value: '{{apiKey}}', type: 'string' },
      { key: 'in', value: 'header', type: 'string' },
    ],
  },
  event: [
    script('prerequest', `
if (!pm.variables.get('apiKey')) {
  throw new Error('No API key yet. Select the "CAT Sandbox" environment (top right) and paste your sandbox key into apiKey. Get one free: ${SIGNUP}');
}`),
  ],
  variable: [
    { key: 'baseUrl', value: 'https://api.complianceassessmenttool.com' },
    { key: 'paymentDescription', value: "We sell cakes online through our Shopify store. Customers pay on Shopify's own hosted checkout page, so card numbers are typed into Shopify, never into our website. We do not take payments any other way." },
    { key: 'followUpAnswer', value: "Yes. We reviewed Shopify's PCI DSS Attestation of Compliance and it covers the hosted checkout we use." },
    { key: 'webhookUrl', value: '' },
    { key: 'merchantId', value: '' },
    { key: 'pmId', value: '' },
    { key: 'jobId', value: '' },
    { key: 'threadId', value: '' },
    { key: 'followUpQuestion', value: '' },
    { key: 'saqType', value: '' },
    { key: 'assessmentUrl', value: '' },
    { key: 'pollCount', value: '0' },
    { key: 'followUpRounds', value: '0' },
  ],
  item: [quickstart, portfolio, webhooks, housekeeping],
};

const environment = {
  id: randomUUID(),
  name: 'CAT Sandbox',
  values: [
    // Deliberately empty: this environment is published publicly. Each person
    // pastes their own key; it stays in their own fork / local current value.
    { key: 'apiKey', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync(join(HERE, 'CAT-PCI-DSS-Compliance-API.postman_collection.json'), JSON.stringify(collection, null, 2));
writeFileSync(join(HERE, 'CAT-Sandbox.postman_environment.json'), JSON.stringify(environment, null, 2));
console.log('wrote collection (' + collection.item.reduce((n, f) => n + f.item.length, 0) + ' requests) and environment');

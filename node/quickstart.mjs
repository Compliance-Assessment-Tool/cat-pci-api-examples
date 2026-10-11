#!/usr/bin/env node
/**
 * CAT PCI DSS API — quickstart (Node.js 18+, no dependencies).
 *
 *   export CAT_API_KEY="cat_test_..."
 *   node node/quickstart.mjs
 *
 * Creates a merchant, adds a payment method described in plain English,
 * determines which PCI DSS SAQ it needs (answering a follow-up question if
 * the API asks one), and mints the link you would send the merchant.
 */
import readline from 'node:readline/promises';

const API = process.env.CAT_API_BASE || 'https://api.complianceassessmenttool.com';
const KEY = process.env.CAT_API_KEY;
if (!KEY) {
  console.error('Set CAT_API_KEY first. Get a free sandbox key: https://banks.complianceassessmenttool.com/signup');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.code || ''} ${data.message || ''}`.trim());
  return data;
}

/** Determination runs asynchronously: the POST returns a job; poll it. */
async function waitForJob(ack, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const job = await api('GET', ack.pollUrl);
    if (job.status === 'COMPLETED') return job.result;
    if (job.status === 'FAILED') throw new Error(`Determination failed: ${job.errorMessage || 'unknown error'}`);
  }
  throw new Error('Timed out waiting for the determination job.');
}

/** Ask one question on the terminal; null if there is no more input. */
async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  try {
    return await Promise.race([
      rl.question(question),
      new Promise((resolve) => rl.once('close', () => resolve(null))),
    ]);
  } finally {
    rl.close();
  }
}

const merchant = await api('POST', '/v1/merchants', {
  name: 'Corner Bakery',
  email: 'owner@cornerbakery.example',
  externalMerchantId: `example-${Date.now()}`, // your own ID for this merchant
});
console.log(`✓ merchant   ${merchant.id}  ${merchant.name}`);

const description =
  "We sell cakes online through our Shopify store. Customers pay on Shopify's own hosted checkout page, " +
  'so card numbers are typed into Shopify, never into our website. We do not take payments any other way.';
const pm = await api('POST', `/v1/merchants/${merchant.id}/payment-methods`, {
  name: 'Online store',
  description,
});
console.log(`✓ payment    ${pm.id}  ${pm.name}`);

console.log('… determining SAQ (usually 10–40 s)');
let result = await waitForJob(
  await api('POST', `/v1/merchants/${merchant.id}/payment-methods/${pm.id}/determine`, { description }),
);

// If the description is ambiguous, the API asks one plain-English question
// instead of guessing. Answer it and poll again.
while (result.status === 'needs-followup' && result.followUpQuestion) {
  const answer = await ask(`? ${result.followUpQuestion}\n> `);
  if (!answer) {
    console.log(`\nAnswer it with POST /v1/merchants/${merchant.id}/payment-methods/${pm.id}/followup ` +
      `{"answer": "...", "threadId": "${result.threadId}"}`);
    process.exit(0);
  }
  result = await waitForJob(
    await api('POST', `/v1/merchants/${merchant.id}/payment-methods/${pm.id}/followup`, {
      answer,
      threadId: result.threadId,
    }),
  );
}

console.log(`✓ ${result.saqType} — ${result.reason}`);

const link = await api('POST', `/v1/merchants/${merchant.id}/portal-link`, {});
console.log(`✓ assessment link (send this to the merchant): ${link.standalonePortalUrl}`);
console.log(`  embed it instead:                            ${link.embedUrl}`);

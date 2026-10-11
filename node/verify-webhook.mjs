#!/usr/bin/env node
/**
 * A minimal CAT webhook receiver (Node.js 18+, standard library only).
 *
 *   export CAT_WEBHOOK_SECRET="..."      # shown once when your key is issued
 *   node node/verify-webhook.mjs          # listens on :8080
 *
 * Then send yourself a signed test: POST /v1/partner/webhook-test
 */
import http from 'node:http';
import { verifyCatSignature } from './cat-signature.mjs';

const SECRET = process.env.CAT_WEBHOOK_SECRET;
if (!SECRET) { console.error('Set CAT_WEBHOOK_SECRET'); process.exit(1); }

const seen = new Set(); // use a durable store in production

http.createServer((req, res) => {
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    if (!verifyCatSignature(raw, req.headers['x-cat-signature'], SECRET)) {
      res.writeHead(401).end('bad signature');
      return;
    }
    const delivery = req.headers['x-cat-delivery'];
    if (seen.has(delivery)) { res.writeHead(200).end('duplicate'); return; } // retries reuse the id
    seen.add(delivery);

    const event = JSON.parse(raw);
    console.log(`✓ ${req.headers['x-cat-event']}`, JSON.stringify(event.data));
    // e.g. on saq.submitted / merchant.compliant: update the merchant's status in your system.
    res.writeHead(200).end('ok');
  });
}).listen(8080, () => console.log('listening on http://localhost:8080 — send a test with POST /v1/partner/webhook-test'));

/**
 * Proves both webhook verifiers accept a signature produced by CAT's own
 * signing code (tests/webhook-vector.json) and reject everything else.
 * Run: node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyCatSignature } from '../node/cat-signature.mjs';

const v = JSON.parse(readFileSync(new URL('./webhook-vector.json', import.meta.url), 'utf8'));

test('node: accepts a genuine CAT signature', () => {
  assert.equal(verifyCatSignature(v.body, v.header, v.secret, v.t), true);
});

test('node: rejects a tampered body, a wrong secret, a stale timestamp, and junk headers', () => {
  assert.equal(verifyCatSignature(v.body + ' ', v.header, v.secret, v.t), false);
  assert.equal(verifyCatSignature(v.body, v.header, v.secret + 'x', v.t), false);
  assert.equal(verifyCatSignature(v.body, v.header, v.secret, v.t + 301), false);
  assert.equal(verifyCatSignature(v.body, '', v.secret, v.t), false);
  assert.equal(verifyCatSignature(v.body, 't=abc,v1=zz', v.secret, v.t), false);
});

test('python: same vector, same verdicts', () => {
  const script = fileURLToPath(new URL('./verify_signatures_test.py', import.meta.url));
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const out = execFileSync(python, [script], { encoding: 'utf8' });
  assert.match(out, /python verifier: ok/);
});

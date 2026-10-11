/**
 * Verify a CAT webhook signature (Node.js 18+, standard library only).
 *
 * Header: X-CAT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
 * Signed payload: `${t}.${raw request body}`, keyed with your webhook secret.
 *
 * Pass the RAW body string — re-serializing parsed JSON changes whitespace
 * and breaks the signature.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOLERANCE_SECONDS = 300; // reject deliveries older than 5 minutes (replay protection)

export function verifyCatSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(
    String(header || '').split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!t || !parts.v1 || !/^[0-9a-f]+$/i.test(parts.v1)) return false;
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

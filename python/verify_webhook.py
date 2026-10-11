"""Verify CAT webhook signatures (Python 3.9+, standard library only).

    export CAT_WEBHOOK_SECRET="..."      # shown once when your key is issued
    python python/verify_webhook.py      # listens on :8080

Header: X-CAT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
Signed payload: f"{t}.{raw request body}"

Verify against the RAW body bytes - re-serializing parsed JSON changes
whitespace and breaks the signature.
"""
import hashlib
import hmac
import json
import os
import time
from typing import Optional
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.environ.get("CAT_WEBHOOK_SECRET", "")
TOLERANCE_SECONDS = 300  # reject replays older than 5 minutes


def verify_cat_signature(raw_body: bytes, header: str, secret: str, now: Optional[int] = None) -> bool:
    parts = dict(kv.strip().split("=", 1) for kv in (header or "").split(",") if "=" in kv)
    try:
        t = int(parts["t"])
        v1 = parts["v1"]
    except (KeyError, ValueError):
        return False
    if abs((now or int(time.time())) - t) > TOLERANCE_SECONDS:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)


seen = set()  # use a durable store in production


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not verify_cat_signature(raw, self.headers.get("X-CAT-Signature", ""), SECRET):
            self.send_response(401); self.end_headers(); return
        delivery = self.headers.get("X-CAT-Delivery")
        if delivery in seen:  # retries reuse the delivery id
            self.send_response(200); self.end_headers(); return
        seen.add(delivery)
        event = json.loads(raw)
        print(f"✓ {self.headers.get('X-CAT-Event')}", json.dumps(event.get("data")))
        # e.g. on saq.submitted / merchant.compliant: update the merchant's status in your system.
        self.send_response(200); self.end_headers()


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("Set CAT_WEBHOOK_SECRET")
    print("listening on http://localhost:8080 - send a test with POST /v1/partner/webhook-test")
    HTTPServer(("", 8080), Handler).serve_forever()

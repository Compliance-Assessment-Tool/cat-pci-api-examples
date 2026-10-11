"""Checks python/verify_webhook.py against tests/webhook-vector.json (run by verify-signatures.test.mjs)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "python"))
from verify_webhook import verify_cat_signature  # noqa: E402

with open(os.path.join(HERE, "webhook-vector.json"), encoding="utf-8") as f:
    v = json.load(f)
body, header, secret, t = v["body"].encode(), v["header"], v["secret"], v["t"]

assert verify_cat_signature(body, header, secret, now=t), "genuine signature rejected"
assert not verify_cat_signature(body + b" ", header, secret, now=t), "tampered body accepted"
assert not verify_cat_signature(body, header, secret + "x", now=t), "wrong secret accepted"
assert not verify_cat_signature(body, header, secret, now=t + 301), "stale timestamp accepted"
assert not verify_cat_signature(body, "", secret, now=t), "empty header accepted"
print("python verifier: ok")

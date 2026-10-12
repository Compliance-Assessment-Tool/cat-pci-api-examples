"""CAT PCI DSS API — quickstart (Python 3.9+).

    pip install -r python/requirements.txt
    export CAT_API_KEY="cat_test_..."
    python python/quickstart.py

Creates a merchant, adds a payment method described in plain English,
determines which PCI DSS SAQ it needs (answering CAT's plain-English
questions along the way), and mints the link you would send the merchant.
"""
import os
import sys
import time

import requests

API = os.environ.get("CAT_API_BASE", "https://api.complianceassessmenttool.com")
KEY = os.environ.get("CAT_API_KEY")
if not KEY:
    sys.exit("Set CAT_API_KEY first. Get a free sandbox key: https://banks.complianceassessmenttool.com/signup")

session = requests.Session()
session.headers.update({"X-API-Key": KEY, "Content-Type": "application/json"})


def api(method, path, body=None):
    res = session.request(method, API + path, json=body, timeout=60)
    data = res.json() if res.content else {}
    if not res.ok:
        raise RuntimeError(f"{method} {path} -> {res.status_code} {data.get('code', '')} {data.get('message', '')}".strip())
    return data


def wait_for_job(ack, timeout_s=120):
    """Determination runs asynchronously: the POST returns a job; poll it."""
    started = time.time()
    while time.time() - started < timeout_s:
        time.sleep(3)
        job = api("GET", ack["pollUrl"])
        if job["status"] == "COMPLETED":
            return job["result"]
        if job["status"] == "FAILED":
            raise RuntimeError(f"Determination failed: {job.get('errorMessage') or 'unknown error'}")
    raise TimeoutError("Timed out waiting for the determination job.")


merchant = api("POST", "/v1/merchants", {
    "name": "Corner Bakery",
    "email": "owner@cornerbakery.example",
    "externalMerchantId": f"example-{int(time.time())}",  # your own ID for this merchant
})
print(f"✓ merchant   {merchant['id']}  {merchant['name']}")

description = (
    "We sell cakes online through our Shopify store. Customers pay on Shopify's own hosted checkout page, "
    "so card numbers are typed into Shopify, never into our website. We do not take payments any other way."
)
pm = api("POST", f"/v1/merchants/{merchant['id']}/payment-methods", {
    "name": "Online store",
    "description": description,
})
print(f"✓ payment    {pm['id']}  {pm['name']}")

print("… determining SAQ (usually 10–40 s)")
result = wait_for_job(api(
    "POST", f"/v1/merchants/{merchant['id']}/payment-methods/{pm['id']}/determine", {"description": description}
))

# CAT asks plain-English questions until it has what it needs to determine
# the SAQ. Answer each one and poll again.
while result.get("status") == "needs-followup" and result.get("followUpQuestion"):
    try:
        answer = input(f"? {result['followUpQuestion']}\n> ")
    except EOFError:  # not running interactively
        sys.exit(f"\nAnswer it with POST /v1/merchants/{merchant['id']}/payment-methods/{pm['id']}/followup "
                 f"with {{\"answer\": \"...\", \"threadId\": \"{result['threadId']}\"}}")
    result = wait_for_job(api(
        "POST", f"/v1/merchants/{merchant['id']}/payment-methods/{pm['id']}/followup",
        {"answer": answer, "threadId": result["threadId"]},
    ))

print(f"✓ {result['saqType']} — {result['reason']}")

link = api("POST", f"/v1/merchants/{merchant['id']}/portal-link", {})
print(f"✓ assessment link (send this to the merchant): {link['standalonePortalUrl']}")
print(f"  embed it instead:                            {link['embedUrl']}")

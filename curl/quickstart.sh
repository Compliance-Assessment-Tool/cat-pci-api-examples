#!/usr/bin/env bash
# CAT PCI DSS API — quickstart with curl (needs curl + jq).
#
#   export CAT_API_KEY="cat_test_..."
#   bash curl/quickstart.sh
set -euo pipefail

API="${CAT_API_BASE:-https://api.complianceassessmenttool.com}"
: "${CAT_API_KEY:?Set CAT_API_KEY first. Free sandbox key: https://banks.complianceassessmenttool.com/signup}"
command -v jq >/dev/null || { echo "This script needs jq (https://jqlang.github.io/jq/)"; exit 1; }

call() { # call METHOD PATH [JSON]
  curl -sS --fail-with-body -X "$1" "$API$2" \
    -H "X-API-Key: $CAT_API_KEY" -H "Content-Type: application/json" ${3:+-d "$3"}
}

# 1. Create a merchant
MERCHANT_ID=$(call POST /v1/merchants \
  '{"name":"Corner Bakery","email":"owner@cornerbakery.example"}' | jq -r .id)
echo "✓ merchant   $MERCHANT_ID"

# 2. Add a payment method, described in the merchant's own words
DESC="We sell cakes online through our Shopify store. Customers pay on Shopify's own hosted checkout page, so card numbers are typed into Shopify, never into our website. We do not take payments any other way."
PM_ID=$(call POST "/v1/merchants/$MERCHANT_ID/payment-methods" \
  "$(jq -n --arg d "$DESC" '{name:"Online store", description:$d}')" | jq -r .id)
echo "✓ payment    $PM_ID"

# 3. Determine the SAQ — async: the POST returns a job to poll
POLL_URL=$(call POST "/v1/merchants/$MERCHANT_ID/payment-methods/$PM_ID/determine" \
  "$(jq -n --arg d "$DESC" '{description:$d}')" | jq -r .pollUrl)
echo "… determining SAQ (usually 10–40 s)"
for _ in $(seq 1 40); do
  sleep 3
  JOB=$(call GET "$POLL_URL")
  STATUS=$(echo "$JOB" | jq -r .status)
  [ "$STATUS" = "COMPLETED" ] && break
  [ "$STATUS" = "FAILED" ] && { echo "Determination failed: $(echo "$JOB" | jq -r .errorMessage)"; exit 1; }
done

if [ "$(echo "$JOB" | jq -r .result.status)" = "needs-followup" ]; then
  # CAT needs more detail: it asks a plain-English question. Answer it, then poll again.
  echo "? $(echo "$JOB" | jq -r .result.followUpQuestion)"
  echo "  Answer it with:"
  echo "  curl -X POST $API/v1/merchants/$MERCHANT_ID/payment-methods/$PM_ID/followup \\"
  echo "    -H \"X-API-Key: \$CAT_API_KEY\" -H 'Content-Type: application/json' \\"
  echo "    -d '{\"answer\":\"<your answer>\",\"threadId\":\"$(echo "$JOB" | jq -r .result.threadId)\"}'"
  exit 0
fi
echo "✓ $(echo "$JOB" | jq -r .result.saqType) — $(echo "$JOB" | jq -r .result.reason)"

# 4. The link you send the merchant (or embed in your portal)
LINK=$(call POST "/v1/merchants/$MERCHANT_ID/portal-link" '{}')
echo "✓ assessment link: $(echo "$LINK" | jq -r .standalonePortalUrl)"
echo "  embed URL:       $(echo "$LINK" | jq -r .embedUrl)"

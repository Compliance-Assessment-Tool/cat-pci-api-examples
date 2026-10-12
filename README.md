# PCI DSS Compliance API — Examples

[![Run in Postman](https://run.pstmn.io/button.svg)](https://www.postman.com/complianceassessmenttool/cat-pci-dss-compliance-api)
[![API reference](https://img.shields.io/badge/API_reference-Fern-4338ca)](https://complianceassessmenttool.docs.buildwithfern.com/)
[![check](https://github.com/Compliance-Assessment-Tool/cat-pci-api-examples/actions/workflows/check.yml/badge.svg)](https://github.com/Compliance-Assessment-Tool/cat-pci-api-examples/actions/workflows/check.yml)

Working examples for the [Compliance Assessment Tool (CAT) API](https://banks.complianceassessmenttool.com/pci-compliance-api?utm_source=github&utm_medium=readme): a white-label PCI DSS self-assessment API for **ISOs, acquiring banks, PayFacs and MSPs**.

Your merchants describe how they take card payments in plain English. CAT works out the correct **PCI DSS v4.0.1 Self-Assessment Questionnaire (SAQ)** for each payment method — A, A-EP, B, B-IP, C, C-VT, P2PE, SPoC or D — walks the merchant through it one plain-English question at a time, and produces the official, signed **SAQ and Attestation of Compliance (AoC)** PDFs.

## What CAT does, at a glance

A café owner describes how they take cards, in their own words. CAT asks plain-English questions until it has what it needs, then names the SAQ:

> **Owner:** "Customers tap or insert their card on our machine at the register."
> **CAT:** Does the card machine work on its own, or is it plugged into a register or computer?
> **Owner:** It works on its own. It plugs into our internet router with its own cable.
> **CAT:** Do you save any card numbers on your computers, register, phone system, or in email?
> **Owner:** No, just paper receipts.
> **CAT:** ✓ **SAQ B-IP** — a standalone card machine that connects to the processor over the internet, with nothing stored electronically.

Then the owner completes that SAQ the same way — one plain-English question per PCI DSS requirement, such as *"Does each person who takes payments have their own login, rather than everyone sharing one?"* — reviews the answers, and signs. Out come the **official PCI SSC SAQ and Attestation of Compliance PDFs**, and your systems get a signed `merchant.compliant` webhook.

```
merchant describes how they take cards
  → CAT asks plain-English questions        → the right SAQ for each payment method
  → plain-English assessment, then signature → official SAQ + AoC PDFs
  → webhooks + portfolio API                → you always know who is compliant
```

More examples, from our test runs:

| The owner says… | What CAT confirms | SAQ |
|---|---|---|
| "We sell cakes on our website." | Customers pay on Squarespace's checkout page; no card numbers touch the business | **SAQ A** |
| "Customers call us to order and we take their card over the phone." | Staff type it into the payment company's web page on one dedicated computer | **SAQ C-VT** |
| "We have a card machine on the counter." | It dials out over a phone line and isn't connected to the internet | **SAQ B** |
| "We use a register system on a computer with a card reader plugged into it." | One location, the register computer kept on its own network, no card numbers saved | **SAQ C** |
| "We take cards on the terminals our processor gave us." | The processor's paperwork says they're part of a PCI-validated P2PE program | **SAQ P2PE** |

## Links

| | |
|---|---|
| 🔑 **Free sandbox key** | https://banks.complianceassessmenttool.com/signup?utm_source=github&utm_medium=readme |
| 📘 **Integration guide** | https://banks.complianceassessmenttool.com/docs?utm_source=github |
| 📚 **API reference** | https://complianceassessmenttool.docs.buildwithfern.com/ |
| 🧪 **Postman workspace** | https://www.postman.com/complianceassessmenttool/cat-pci-dss-compliance-api |
| 🧾 **OpenAPI 3.1 spec** | https://api.complianceassessmenttool.com/openapi.json |

---

## The 5-minute quickstart

Get a sandbox key (free, issued as soon as you verify your email), then:

```bash
export CAT_API_KEY="cat_test_..."     # your sandbox key
```

| Language | Run it |
|---|---|
| curl (+ jq) | `bash curl/quickstart.sh` |
| Node.js 18+ (no dependencies) | `node node/quickstart.mjs` |
| Python 3.9+ | `pip install -r python/requirements.txt && python python/quickstart.py` |
| Postman | Fork the [workspace](https://www.postman.com/complianceassessmenttool/cat-pci-dss-compliance-api) and run the **1 · Quickstart** folder |

Each one does the same four things:

1. **Create a merchant** — `POST /v1/merchants`
2. **Add a payment method**, described in the merchant's own words — `POST /v1/merchants/{id}/payment-methods`
3. **Determine the SAQ** — `POST …/payment-methods/{pmId}/determine` starts a job; poll `GET /v1/jobs/determine/{jobId}` until it's `COMPLETED` (usually 10–40 s). If CAT needs more detail, the result is a plain-English question for the merchant — send their answer with `POST …/followup` and poll again, until the SAQ is determined.
4. **Hand the merchant their assessment** — `POST /v1/merchants/{id}/portal-link` returns a standalone URL, an embeddable white-label iframe URL, and a hand-off URL that returns the merchant to your platform when they finish.

Example output:

```
✓ merchant   mrc_…  Corner Bakery
✓ payment    pm_…   Online store
… determining SAQ (usually 10–40 s)
✓ SAQ A — card entry is fully outsourced to Shopify's hosted checkout…
✓ assessment link (send this to the merchant): https://api.complianceassessmenttool.com/portal?…
```

Try your own scenario by editing the payment description in any of the scripts — a countertop terminal, phone orders keyed into a virtual terminal, a phone-and-card-reader setup at a market stall.

## Webhooks

CAT signs every webhook:

```
X-CAT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your webhook secret>
X-CAT-Event:     saq.submitted | merchant.compliant | merchant.expiring_soon | merchant.expired | payment_method.added | ping
X-CAT-Delivery:  <uuid — use it to de-duplicate retries>
```

Verifiers, standard library only:

- Node: [`node/cat-signature.mjs`](node/cat-signature.mjs) (the function) and [`node/verify-webhook.mjs`](node/verify-webhook.mjs) (a minimal receiver)
- Python: [`python/verify_webhook.py`](python/verify_webhook.py)

Both are tested in CI against a signature produced by CAT's own signing code ([`tests/`](tests/)). Once your receiver is reachable, send yourself a signed test with `POST /v1/partner/webhook-test`.

## Ways to integrate

| Path | What it is | Lift |
|---|---|---|
| Bulk invite | Upload merchants; each gets a branded email link | Zero code |
| Platform redirect | Send merchants to a branded URL; they return with a status | One endpoint |
| Embedded iframe | White-label assessment inside your merchant portal | Small |
| REST API | Fully custom experience — this repo | Custom |
| MCP server | Let an AI agent or chatbot run the assessment | Custom |

## Repository layout

```
curl/quickstart.sh            the quickstart in bash + curl + jq
node/quickstart.mjs           the quickstart in Node.js (no dependencies)
node/cat-signature.mjs        webhook signature verification (Node)
node/verify-webhook.mjs       minimal webhook receiver (Node)
python/quickstart.py          the quickstart in Python
python/verify_webhook.py      webhook verification + minimal receiver (Python)
postman/                      the public Postman collection + environment, and the script that builds them
tests/                        signature tests run in CI
```

## Notes

- **No cardholder data.** The API takes *descriptions* of how a merchant accepts payments — never card numbers, CVVs or track data.
- **Sandbox vs production.** Sandbox keys start `cat_test_`; documents are watermarked TEST, nothing is billed, and a sandbox holds up to 5 merchants (`DELETE /v1/merchants/{id}` to clean up). Production is $25 per completed assessment.
- **Self-assessment.** CAT facilitates merchant PCI DSS *self*-assessment. It is not a Qualified Security Assessor (QSA) and does not certify compliance; acquirers set each merchant's validation requirements.
- **Questions:** chris.larson@complianceassessmenttool.com · [Trust Center](https://banks.complianceassessmenttool.com/trust?utm_source=github)

Small business looking for which SAQ you need? See the [plain-English PCI SAQ guide](https://complianceassessmenttool.com/pci-saq-guide?utm_source=github).

## License

MIT — see [LICENSE](LICENSE).

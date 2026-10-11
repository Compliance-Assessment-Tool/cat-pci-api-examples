# CAT — PCI DSS Compliance API

**White-label PCI DSS self-assessment for ISOs, acquiring banks, PayFacs and MSPs.** Get every merchant in your portfolio onto the right SAQ — and through it — under your own brand.

## About this workspace

This is the official Postman workspace for the [Compliance Assessment Tool (CAT) API](https://banks.complianceassessmenttool.com/pci-compliance-api?utm_source=postman&utm_medium=workspace).

Your merchants describe how they take card payments in plain English. CAT determines the correct **PCI DSS v4.0.1 Self-Assessment Questionnaire** for each payment method — **SAQ A, A-EP, B, B-IP, C, C-VT, P2PE, SPoC or D** — walks the merchant through it one plain-English question at a time, and produces the official, signed **SAQ and Attestation of Compliance (AoC)** PDFs. Signed webhooks and a portfolio API keep your systems up to date on who is compliant, in progress, or expiring.

It's for engineering and product teams at payment companies evaluating or building a merchant PCI compliance program.

## Getting started

1. **Get a free sandbox key** → [banks.complianceassessmenttool.com/signup](https://banks.complianceassessmenttool.com/signup?utm_source=postman&utm_medium=workspace). It's issued as soon as you verify your email.
2. **Fork** the *CAT — PCI DSS Compliance API* collection and the *CAT Sandbox* environment into your own workspace. Select **CAT Sandbox** (top right) and paste your key into `apiKey`.
3. **Run the "1 · Quickstart" folder.** Right-click → *Run folder*. In about a minute you'll have the SAQ for a sample merchant, with the reasoning, and the assessment link you'd send them.

Want to try your own scenario? Change the `paymentDescription` collection variable to describe how any business takes payments, and run the quickstart again.

## What's included

| | |
|---|---|
| **CAT — PCI DSS Compliance API** (collection) | **1 · Quickstart:** create a merchant → add a payment method → determine the SAQ → answer the follow-up question if one is asked → create the assessment link. Every step saves the IDs the next one needs. **2 · Your account & portfolio:** your account, the portfolio compliance rollup, merchants, assessments. **3 · Webhooks:** point events at your receiver and send a signed test. **4 · Sandbox housekeeping:** clean up. |
| **CAT Sandbox** (environment) | One variable, `apiKey`, deliberately empty — you add your own key. |
| **Full API reference** | Every endpoint is in the [OpenAPI 3.1 spec](https://api.complianceassessmenttool.com/openapi.json) and the [integration guide](https://banks.complianceassessmenttool.com/docs?utm_source=postman&utm_medium=workspace). |

**Ways to launch with your merchants:** bulk invite with branded email links (zero code) · platform redirect that returns merchants to you with a status · embedded white-label iframe · this REST API · an MCP server for AI agents and chatbots.

## Notes

- **Sandbox vs production.** Sandbox keys start `cat_test_`. Documents are watermarked TEST and nothing is billed. Sandboxes hold up to 5 merchants (use *4 · Sandbox housekeeping* to clean up). Production is **$25 per completed assessment**.
- **Async determination.** SAQ determination takes 10–40 seconds. *1.3* starts it and *1.4* checks it: the Collection Runner repeats *1.4* automatically; by hand, just press **Send** again.
- **No cardholder data — ever.** The API takes *descriptions* of how a merchant accepts payments, never card numbers, CVVs or track data.
- **Self-assessment.** CAT facilitates merchant PCI DSS *self*-assessment. It is not a Qualified Security Assessor and does not certify compliance; acquirers set each merchant's validation requirements.
- **Security & trust:** [Trust Center](https://banks.complianceassessmenttool.com/trust?utm_source=postman&utm_medium=workspace).
- **Questions or a production key:** chris.larson@complianceassessmenttool.com

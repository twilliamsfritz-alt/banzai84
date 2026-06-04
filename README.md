# Banzai — Integration-Ready Official Candidate

# Banzai Expert Go-Live Edition

Local full-stack business OS with:
- real login
- real SQLite database
- Flask backend
- working webchat channel
- quotes, tasks, ledger and pricing
- expert source library
- go-live commercialization pack

## Run locally

### Windows
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
py migrate.py
py app.py

### Open
http://127.0.0.1:5000

## Starter users
- owner@banzai.local / demo1234
- owner@northbridge.local / demo1234
- owner@auroraops.local / demo1234

## Source upload support
The built-in uploader supports text-like files such as txt, md, csv and json.
For binary formats such as pdf or docx, export the text first and then upload it.

## What is done vs external
Done locally:
- product logic
- app structure
- knowledge routing
- go-live docs
- installable local app

Still external by nature:
- public hosting
- domain
- SSL
- production secrets
- real WhatsApp/OpenAI/Stripe credentials


## Sell-ready extras
- CURATED_PUBLIC_SOURCES.md
- WEEK_ONE_SELLING_PLAN.md
- go_live_pack/OBJECTION_HANDLING.md
- go_live_pack/WEEK_ONE_CHECKLIST.md


## New in this build
- OpenAI-ready backend route: `/api/ai/reply`
- WhatsApp webhook scaffolding: `/api/webhooks/whatsapp`
- WhatsApp outbound test route: `/api/whatsapp/send-test`
- Stripe checkout scaffolding: `/api/billing/create-checkout-session`
- Stripe webhook route: `/api/webhooks/stripe`
- Integration status route: `/api/integrations/status`
- `.env.example` with all external variables
- `EXTERNAL_SETUP_NOTES.md` with the remaining credential steps

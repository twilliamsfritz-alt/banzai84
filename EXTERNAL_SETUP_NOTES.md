# External setup notes

These are the only parts still requiring your own accounts/credentials.

## 1. OpenAI
- Create an API key in your OpenAI account.
- Copy it into `.env` as `OPENAI_API_KEY`.
- Optional: change `OPENAI_MODEL`.
- Once added, `/api/ai/reply` will try OpenAI first and fall back to the local reply engine if something fails.

## 2. WhatsApp Business Platform
- Configure your Meta/WhatsApp Business Platform account.
- Put these values into `.env`:
  - `WHATSAPP_VERIFY_TOKEN`
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_WABA_ID`
- Point your Meta webhook to:
  - `GET /api/webhooks/whatsapp` for verification
  - `POST /api/webhooks/whatsapp` for inbound events
- Use `/api/whatsapp/send-test` to test a real outbound message after configuration.

## 3. Stripe
- Create your Stripe test keys.
- Put these values into `.env`:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Create product prices in Stripe and pass the real `price_id` to `/api/billing/create-checkout-session`.
- Point Stripe webhooks to `/api/webhooks/stripe`.

## 4. Hosting / domain / HTTPS
- For local use, `http://127.0.0.1:5000` is enough.
- For real clients, deploy the app to a server with HTTPS.
- Set `APP_URL` in `.env` to your public domain.

## 5. Production checklist
- Change `SALESPILOT_SECRET_KEY`
- Add real credentials in `.env`
- Run `py migrate.py`
- Start the server
- Check `/api/health`
- Check `/api/integrations/status`

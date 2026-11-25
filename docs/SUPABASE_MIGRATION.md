# Supabase storefront API

The public catalog bootstrap is served by the deployed Supabase Edge Function
`showroom-storefront-api`. It reads only published catalog data, active pricing,
active garment mockups, and the public brand/contact settings. It does not return
customer, order, payment, staff, or other private records.

## Request

```http
POST /functions/v1/showroom-storefront-api
Content-Type: application/json
apikey: <Supabase publishable key>
Authorization: Bearer <Supabase publishable key>

{"action":"bootstrap"}
```

The function uses the server-side Supabase service key internally and applies
the existing `showroom_take_rate_limit` database function. Never put a
service-role or secret key in the browser.

## GitHub Pages frontend configuration

The frontend will use these public build-time variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (legacy anon key) or a Supabase publishable key

Only a publishable/anon key may be exposed to the browser. Never add
`SUPABASE_SERVICE_ROLE_KEY` to a Vite variable or GitHub Pages secret.

The deployed endpoint is a first migration step. Checkout, admin authentication,
order management, file uploads, and live updates still need their own verified
Supabase integration before the old Express server can be removed.

# WhatConverts Proxy

Lightweight Express proxy that forwards requests to the WhatConverts API
with CORS headers, so the Lead Analyser HTML tool can call it from a browser.

## Environment variables (set in Railway)

| Variable       | Description                    |
|----------------|--------------------------------|
| WC_TOKEN       | WhatConverts API token         |
| WC_SECRET      | WhatConverts API secret        |
| PABAU_API_KEY  | Pabau API key                  |
| PORT           | Set automatically by Railway   |

## Endpoints

GET /                          Health check
GET /wc/v1/profiles            List profiles
GET /wc/v1/leads?profile_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD

Any other WhatConverts v1 path works the same way -- just prefix it with /wc.

GET /pabau/appointments?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
GET /pabau/appointments/all?per_page=100&page=1
GET /pabau/invoices?...

Any other Pabau path works the same way -- prefix it with /pabau. Pabau's
API takes its API key as part of the URL path rather than a header
(https://api.oauth.pabau.com/{api_key}/...), so this proxy splices
PABAU_API_KEY into the upstream path server-side -- the key is never sent
to or visible from the static dashboard.

## Deploy to Railway

1. Push this folder to a GitHub repo (e.g. lester-dotcom/wc-proxy)
2. Create a new Railway service pointing at that repo
3. Add WC_TOKEN, WC_SECRET, and PABAU_API_KEY as environment variables in Railway
4. Railway auto-detects Node and runs `npm start`
5. Copy the generated Railway URL into the Lead Analyser HTML (PROXY_BASE constant)

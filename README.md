# WhatConverts Proxy

Lightweight Express proxy that forwards requests to the WhatConverts API
with CORS headers, so the Lead Analyser HTML tool can call it from a browser.

## Environment variables (set in Railway)

| Variable   | Description                    |
|------------|--------------------------------|
| WC_TOKEN   | WhatConverts API token         |
| WC_SECRET  | WhatConverts API secret        |
| PORT       | Set automatically by Railway   |

## Endpoints

GET /                          Health check
GET /wc/v1/profiles            List profiles
GET /wc/v1/leads?profile_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD

Any other WhatConverts v1 path works the same way -- just prefix it with /wc.

## Deploy to Railway

1. Push this folder to a GitHub repo (e.g. lester-dotcom/wc-proxy)
2. Create a new Railway service pointing at that repo
3. Add WC_TOKEN and WC_SECRET as environment variables in Railway
4. Railway auto-detects Node and runs `npm start`
5. Copy the generated Railway URL into the Lead Analyser HTML (PROXY_BASE constant)

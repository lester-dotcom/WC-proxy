const express = require('express');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// WhatConverts credentials from environment variables
const WC_TOKEN  = process.env.WC_TOKEN;
const WC_SECRET = process.env.WC_SECRET;

// CORS -- allow all origins so the HTML file can call this from anywhere
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WhatConverts Proxy', timestamp: new Date().toISOString() });
});

// Generic proxy for any WhatConverts v1 endpoint
// e.g. GET /wc/v1/profiles
//      GET /wc/v1/leads?profile_id=123&date_from=2026-06-01&date_to=2026-07-07
app.get('/wc/*', async (req, res) => {
  if (!WC_TOKEN || !WC_SECRET) {
    return res.status(500).json({ error: 'WC_TOKEN and WC_SECRET environment variables not set' });
  }

  // Strip /wc prefix and rebuild the WhatConverts URL
  const wcPath = req.path.replace(/^\/wc/, '');
  const qs     = new URLSearchParams(req.query).toString();
  const url    = `https://api.whatconverts.com${wcPath}${qs ? '?' + qs : ''}`;

  try {
    const auth = 'Basic ' + Buffer.from(`${WC_TOKEN}:${WC_SECRET}`).toString('base64');
    const upstream = await fetch(url, {
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' }
    });

    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatConverts proxy listening on port ${PORT}`);
});

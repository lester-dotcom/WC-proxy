const express = require('express');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 8080;

const WC_TOKEN  = process.env.WC_TOKEN;
const WC_SECRET = process.env.WC_SECRET;
const PABAU_API_KEY = process.env.PABAU_API_KEY;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WhatConverts Proxy', timestamp: new Date().toISOString() });
});

// Forwards a GET to an upstream host and relays its JSON response, so
// per-service route handlers only need to build the target path/headers.
function proxyGet(hostname, path, headers, res) {
  const options = { hostname, port: 443, path, method: 'GET', headers };

  const request = https.request(options, (upstream) => {
    let data = '';
    upstream.on('data', chunk => data += chunk);
    upstream.on('end', () => {
      try {
        res.status(upstream.statusCode).json(JSON.parse(data));
      } catch(e) {
        res.status(502).json({ error: 'Invalid JSON from upstream', detail: data.slice(0, 200) });
      }
    });
  });

  request.on('error', (err) => {
    console.error('Request error:', err.message);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  });

  request.end();
}

app.get('/wc/*', (req, res) => {
  if (!WC_TOKEN || !WC_SECRET) {
    return res.status(500).json({ error: 'WC_TOKEN and WC_SECRET not set' });
  }

  const wcPath = req.path.replace(/^\/wc/, '');
  const qs     = new URLSearchParams(req.query).toString();
  const path   = '/api' + wcPath + (qs ? '?' + qs : '');
  const auth   = 'Basic ' + Buffer.from(`${WC_TOKEN}:${WC_SECRET}`).toString('base64');

  proxyGet('app.whatconverts.com', path, { 'Authorization': auth, 'Content-Type': 'application/json' }, res);
});

// Pabau's legacy API embeds the API key in the URL path itself
// (https://api.oauth.pabau.com/{api_key}/...) rather than an auth header,
// so the key has to be spliced server-side here to keep it out of the
// static dashboard entirely.
app.get('/pabau/*', (req, res) => {
  if (!PABAU_API_KEY) {
    return res.status(500).json({ error: 'PABAU_API_KEY not set' });
  }

  const pabauPath = req.path.replace(/^\/pabau/, '');
  const qs        = new URLSearchParams(req.query).toString();
  const path      = '/' + PABAU_API_KEY + pabauPath + (qs ? '?' + qs : '');

  proxyGet('api.oauth.pabau.com', path, { 'Content-Type': 'application/json' }, res);
});

app.listen(PORT, () => {
  console.log(`WhatConverts proxy listening on port ${PORT}`);
});

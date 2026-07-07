const express = require('express');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 8080;

const WC_TOKEN  = process.env.WC_TOKEN;
const WC_SECRET = process.env.WC_SECRET;

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

app.get('/wc/*', (req, res) => {
  if (!WC_TOKEN || !WC_SECRET) {
    return res.status(500).json({ error: 'WC_TOKEN and WC_SECRET not set' });
  }

  const wcPath = req.path.replace(/^\/wc/, '');
  const qs     = new URLSearchParams(req.query).toString();
  const path   = wcPath + (qs ? '?' + qs : '');
  const auth   = 'Basic ' + Buffer.from(`${WC_TOKEN}:${WC_SECRET}`).toString('base64');

  const options = {
    hostname: 'api.whatconverts.com',
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    }
  };

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
});

app.listen(PORT, () => {
  console.log(`WhatConverts proxy listening on port ${PORT}`);
});

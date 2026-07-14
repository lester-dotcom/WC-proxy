const express = require('express');
const https   = require('https');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 8080;

const WC_TOKEN  = process.env.WC_TOKEN;
const WC_SECRET = process.env.WC_SECRET;
const PABAU_API_KEY = process.env.PABAU_API_KEY;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dashboard-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WhatConverts Proxy', timestamp: new Date().toISOString() });
});

// Both upstream routes below serve real patient/lead PII, so every request
// must carry the shared dashboard access code -- this is what actually
// protects that data, since the frontend's own PIN prompt is just a UX
// layer in front of it and enforces nothing on its own. Constant-time
// comparison to avoid leaking the token length/contents via response timing.
//
// Deliberately answers a bad/missing token with 403, not 401: proxyGet()
// below relays whatever status code the upstream WC/Pabau API itself
// returns, and WhatConverts returns a real 401 for its own bad-credentials
// case -- if this used 401 too, the frontend couldn't tell "wrong dashboard
// code" apart from "WC_TOKEN has gone stale" and would incorrectly boot the
// user back to the lock screen for an unrelated upstream problem.
//
// Server misconfiguration (DASHBOARD_TOKEN not set/picked up yet -- e.g. the
// running process hasn't restarted since the variable was added in Railway)
// is answered separately with 500, matching how WC_TOKEN/PABAU_API_KEY are
// already handled below -- otherwise every code, even a correct one, would
// fail identically to a wrong one with no way to tell the two apart.
// .trim() guards against a trailing newline/space from copying the value out
// of Railway's UI.
function checkAuth(req, res) {
  const expected = (DASHBOARD_TOKEN || '').trim();
  if (!expected) {
    res.status(500).json({ error: 'DASHBOARD_TOKEN not set' });
    return false;
  }
  const provided = (req.get('X-Dashboard-Token') || '').trim();
  const ok = provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) { res.status(403).json({ error: 'Forbidden' }); return false; }
  return true;
}

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
  if (!checkAuth(req, res)) return;
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
  if (!checkAuth(req, res)) return;
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

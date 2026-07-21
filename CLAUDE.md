# WhatConverts Lead Analyser — working notes

This repo is a client-facing dashboard for Dr Nyla's WhatConverts lead data,
Google Ads spend, and Pabau appointments/invoices, built almost entirely
through iterative chat requests rather than a planned spec. These notes exist
so a fresh session doesn't have to re-derive the same context every time.

## What's actually here

- **`index.html`** — the entire frontend. Single file, no build step, no
  external libraries or CDN dependencies. Tabs: Overview & Traffic, Paid
  Search, Pages, Leads, Attendance, Invoices. Deployed as-is via GitHub Pages.
- **`index.js`** — Express proxy on Railway. Forwards to the WhatConverts API
  (Basic Auth) and the Pabau API (key spliced server-side), gated behind a
  shared `DASHBOARD_TOKEN`. See README.md for the endpoint list and env vars.
- **`ads-daily-spend-export.js`** — a Google Ads Script, pasted directly into
  the Google Ads UI (not deployed from this repo). Runs daily, appends
  keyword-level spend to a Google Sheet, which is published to the web as CSV
  and fetched client-side from `index.html`.

## Live URLs

- Dashboard: https://lester-dotcom.github.io/WC-proxy/
- Proxy: the Railway URL is already filled into the "Proxy URL" field in
  index.html — check there rather than assuming a value.

## Non-obvious conventions (read before editing)

- **Never write the literal text `</script>` anywhere in this file — not even
  inside a comment.** The browser's HTML tokenizer looks for that exact
  substring to know where the real `<script>` block ends; it has no concept
  of JS comments or string literals. Writing it inside a comment (which
  happened once — see commit history) silently truncates everything after it
  from the app's JS and dumps it as raw text into the page body. When you
  need to describe this rule in a comment, describe it without spelling the
  tag out literally.
- **Every popup this app opens (leads drill-down, download summaries) is
  built the same way**: build an HTML string with no inline `<script>`,
  `window.open(URL.createObjectURL(new Blob([html], ...)))`, then attach
  handlers from the parent via the returned window reference + a `load`
  listener. This is a direct consequence of the rule above.
- **Two date-handling helpers, never mixed**: `fmtLocalDate()` (local
  getters) for "today"-relative Quick Range presets; `parseDateOnly()` /
  `fmtDateOnly()` (pure `Date.UTC`/`getUTC*`) for arithmetic on the plain
  `YYYY-MM-DD` strings already sitting in date `<input>`s. Mixing local
  construction with `toISOString()` UTC formatting caused a real off-by-one
  day bug in BST — don't reintroduce it.
- **Prior-period comparison** is the immediately-preceding period of equal
  length to the selected range (`priorPeriodBounds`), not a midpoint split of
  the selected range. The midpoint approach was the original design and
  silently halved every headline number — see the fix in the git log if this
  ever regresses.
- **Ad spend must be deduplicated on read**, not trusted as unique. The Ads
  Script only appends; if it ever runs twice concurrently (e.g. a leftover
  duplicate daily trigger), the same day's rows get appended twice and spend
  silently doubles. `fetchAdsSpend()` collapses rows by
  date+campaign+ad group+keyword before returning them — don't remove that
  without understanding why it's there.
- **Google/CPC-only gating**: campaign and keyword tables must only include
  leads where `isGoogleCpc(l)` is true, otherwise a Facebook or GMB lead whose
  `lead_campaign`/`lead_keyword` field happens to be populated pollutes real
  Google Ads performance data. Cookie-consent blocking wipes
  `lead_campaign`/`lead_content`/`lead_keyword` together but leaves
  `lead_source`/`lead_medium`/`gclid` intact — those leads are bucketed as
  "Not Tracked (Google CPC)" rather than dropped, since they're still real
  paid leads.

## Workflow for changes

1. **Always clone fresh from GitHub** rather than trusting a local copy —
   several stale copies exist in `~/Downloads` from early in this project's
   history and will cost you time if mistaken for the current state.
2. **Syntax-check before testing live**: extract the `<script>` block and run
   it through `new Function(...)` in Node — catches syntax errors without
   executing top-level side effects.
3. **Verify live against real data**, not mocks — the Railway proxy and the
   published Ads Sheet CSV are both real and reachable directly (the Ads
   Sheet fetch in particular needs no auth, so spend-calculation logic can be
   tested in isolation even without the dashboard access code).
4. **Commit directly to `main`** with a commit message that explains the root
   cause and how it was verified, not just what changed. No PRs, per
   established practice on this repo (though PR-based contributions from
   other sessions do also land here — check `git log` for recent work before
   assuming you know the current state of a file).
5. If you add a temporary local preview server entry to `.claude/launch.json`
   to test with Claude's browser/preview tools, remove it again once done.

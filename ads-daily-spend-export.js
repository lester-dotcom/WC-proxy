/**
 * Google Ads Script: Daily keyword-level spend export
 *
 * Pulls day-by-day spend, clicks, impressions, conversions and conversion
 * value at the keyword level (campaign ID/name and ad group ID/name are
 * included on every row) and appends it to a Google Sheet.
 *
 * On first run the sheet is empty, so it backfills from 1 January of the
 * current year through yesterday. On every run after that, it looks at the
 * date of the last row already in the sheet and only pulls days after that,
 * so it just appends "today's" new day each time it runs — re-running it
 * the same day is harmless since there's nothing new to catch up on.
 *
 * SETUP
 * 1. In Google Ads: Tools & Settings > Bulk Actions > Scripts > + (new script).
 * 2. Paste this whole file in.
 * 3. Set SHEET_URL below to your target Google Sheet's URL.
 * 4. Click "Preview" to test it (you'll be asked to authorize Sheets access
 *    the first time) — check the sheet gets the backfilled YTD rows.
 * 5. Save the script, then in the scripts list set its "Frequency" to
 *    Daily, at 9 AM (in the account's time zone).
 * 6. Once you've got the WhatConverts Lead Analyser doing its own thing,
 *    publish this sheet to the web as CSV (File > Share > Publish to web >
 *    select this sheet/tab > CSV) so the tool can fetch it.
 */

const SHEET_URL = 'PASTE_YOUR_GOOGLE_SHEET_URL_HERE';
const SHEET_NAME = 'Ads Daily Data';

const HEADERS = [
  'Date', 'Campaign ID', 'Campaign Name', 'Ad Group ID', 'Ad Group Name',
  'Keyword ID', 'Keyword Text', 'Match Type',
  'Cost', 'Clicks', 'Impressions', 'Conversions', 'Conv. Value'
];

function main() {
  // Guards against two overlapping executions (e.g. a duplicate daily
  // trigger left over from re-saving the script, or Ads Scripts retrying a
  // run it thinks timed out) both reading the same "last row" date before
  // either has appended, then both pulling and appending the identical date
  // range — which is exactly what silently doubled spend for a 12-day
  // stretch before this fix. If another run already holds the lock, this
  // one waits briefly and then bails rather than risk a duplicate append.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    Logger.log('Another run is already in progress — exiting without pulling data.');
    return;
  }

  try {
    const ss = SpreadsheetApp.openByUrl(SHEET_URL);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    const startDate = getStartDate(sheet);
    const endDate = getYesterday();

    if (startDate > endDate) {
      Logger.log('Already up to date through yesterday — nothing to pull.');
      return;
    }

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    Logger.log(`Pulling keyword-level spend from ${startStr} to ${endStr}`);

    const query = `
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value
      FROM keyword_view
      WHERE segments.date BETWEEN '${startStr}' AND '${endStr}'
      ORDER BY segments.date ASC
    `;

    const rows = [];
    const report = AdsApp.search(query);
    while (report.hasNext()) {
      const row = report.next();
      rows.push([
        row.segments.date,
        row.campaign.id,
        row.campaign.name,
        row.adGroup.id,
        row.adGroup.name,
        row.adGroupCriterion.criterionId,
        row.adGroupCriterion.keyword.text,
        row.adGroupCriterion.keyword.matchType,
        row.metrics.costMicros / 1000000,
        row.metrics.clicks,
        row.metrics.impressions,
        row.metrics.conversions,
        row.metrics.conversionsValue
      ]);
    }

    if (rows.length === 0) {
      Logger.log('No keyword rows returned for that date range.');
      return;
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    Logger.log(`Appended ${rows.length} rows.`);
  } finally {
    lock.releaseLock();
  }
}

function getStartDate(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1); // Jan 1 of current year, for the YTD backfill
  }
  const lastDate = new Date(sheet.getRange(lastRow, 1).getValue());
  lastDate.setDate(lastDate.getDate() + 1);
  return lastDate;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function formatDate(date) {
  return Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
}

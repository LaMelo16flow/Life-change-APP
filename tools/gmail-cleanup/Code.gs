/**
 * LC Shop – Gmail auto-cleanup for lcshop.app@gmail.com
 *
 * Every day it checks how full the account is (Gmail + Drive + Photos share
 * one 15 GB quota). When usage reaches CLEAN_AT_PERCENT (45%, "close to 50%")
 * it permanently deletes the OLDEST app emails until usage is back under
 * STOP_AT_PERCENT (35%):
 *   1. emails LC Shop sent (Sent folder) older than KEEP_DAYS
 *   2. bounce notices ("Mail Delivery Subsystem") older than KEEP_DAYS
 * Nothing newer than KEEP_DAYS is ever deleted, and nothing else in the
 * account (your own inbox mail, Drive files, photos) is touched.
 *
 * Setup (once, in lcshop.app@gmail.com): see README.md next to this file.
 */

const CLEAN_AT_PERCENT = 45;  // start cleaning here
const STOP_AT_PERCENT = 35;   // stop once usage is back under this
const KEEP_DAYS = 30;         // never delete emails younger than this
const BATCH = 500;            // messages deleted per step (Gmail API maximum is 1000)
const MAX_BATCHES_PER_RUN = 20;

const QUERIES = [
  'in:sent older_than:' + KEEP_DAYS + 'd',
  'from:mailer-daemon older_than:' + KEEP_DAYS + 'd',
];

function usagePercent_() {
  return (DriveApp.getStorageUsed() / DriveApp.getStorageLimit()) * 100;
}

/** Runs every day (see setup). Safe to run by hand any time. */
function cleanupIfNeeded() {
  const start = usagePercent_();
  console.log('Storage used: ' + start.toFixed(1) + '%');
  if (start < CLEAN_AT_PERCENT) {
    console.log('Below ' + CLEAN_AT_PERCENT + '% – nothing to do.');
    return;
  }

  let deleted = 0;
  let batches = 0;
  for (const q of QUERIES) {
    while (batches < MAX_BATCHES_PER_RUN) {
      const ids = oldestMessageIds_(q, BATCH);
      if (ids.length === 0) break;
      Gmail.Users.Messages.batchDelete({ ids: ids }, 'me');  // permanent, frees space right away
      deleted += ids.length;
      batches++;
      Utilities.sleep(2000);
      // Google updates the usage figure with a delay, so also estimate:
      // app emails are ~20 KB each.
      const estimate = usagePercent_() - (deleted * 20 * 1024) / DriveApp.getStorageLimit() * 100;
      if (estimate < STOP_AT_PERCENT) break;
    }
  }
  console.log('Deleted ' + deleted + ' old LC Shop emails. Storage now ~' + usagePercent_().toFixed(1) + '% (updates within a few hours).');
}

/** Message ids for a search, oldest first. */
function oldestMessageIds_(query, max) {
  const all = [];
  let pageToken;
  do {
    const res = Gmail.Users.Messages.list('me', { q: query, maxResults: 500, pageToken: pageToken });
    (res.messages || []).forEach(function (m) { all.push(m.id); });
    pageToken = res.nextPageToken;
  } while (pageToken && all.length < 5000);
  // The API lists newest first, so the oldest are at the end.
  return all.slice(-max);
}

/** Run ONCE to schedule the daily check (about 3 a.m.). */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanupIfNeeded') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanupIfNeeded').timeBased().everyDays(1).atHour(3).create();
  console.log('Daily cleanup scheduled. Storage used now: ' + usagePercent_().toFixed(1) + '%');
}

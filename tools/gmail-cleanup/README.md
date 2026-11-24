# LC Shop – Gmail auto-cleanup

Keeps **lcshop.app@gmail.com** from filling up. Every day at about 3 a.m. it checks
the account's storage (15 GB free). At **45 %** it permanently deletes the **oldest**
emails LC Shop sent (and old bounce notices), never anything younger than 30 days,
until usage is back under **35 %**. Your own mail, Drive and Photos are not touched.

## Setup (once, about 5 minutes, signed in as lcshop.app@gmail.com)

1. Open **script.google.com** → **New project**. Name it `LC Shop cleanup`.
2. Delete what is in `Code.gs` and paste the content of `Code.gs` from this folder. Save.
3. Left menu **Services (+)** → choose **Gmail API** → **Add**.
4. At the top, pick the function **setup** → **Run**. Approve the permissions
   (Google may show "Google hasn't verified this app": **Advanced → Go to LC Shop cleanup**;
   it is your own script).
5. Done. To test it any time, pick **cleanupIfNeeded** → **Run** and open **Executions** to see
   "Storage used: …%".

Change the numbers at the top of `Code.gs` (`CLEAN_AT_PERCENT`, `STOP_AT_PERCENT`, `KEEP_DAYS`)
to adjust when it cleans and how much it keeps.

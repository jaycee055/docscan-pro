# Switch on free accounts and backup (about 10 minutes)

Accounts and backups run in **your own Google account** for free, using Google Apps Script.
Users' scans go into a private folder in your Google Drive; the user list goes into a Google Sheet.

1. Go to **https://script.google.com** (signed in with the Google account that should hold the backups) and click **New project**.
2. Delete the sample code, then copy everything from `backend/Code.gs` in this repo and paste it in. Click **Save** and name the project **DocScan Pro backend**.
3. In the function menu at the top, choose **setup** and click **Run**.
   - Google asks for permission: click **Review permissions**, pick your account, then **Advanced › Go to DocScan Pro backend (unsafe) › Allow**.
     ("Unsafe" only means Google hasn't reviewed your own script.)
   - This creates the **DocScan Pro Backups** folder and the **DocScan Pro Users** sheet in your Drive.
4. Click **Deploy › New deployment**. Next to "Select type" click the gear and choose **Web app**.
   - Description: `DocScan Pro`
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy**, then copy the **Web app URL** (it ends in `/exec`).
5. In DocScan Pro, open **Me › Server address (for the app owner)**, paste the URL, tap **Test** then **Save**.
   Sign up works on that device right away.
6. Send the URL to Claude (or put it in `BACKEND_DEFAULT` in `index.html`) so every user gets accounts.

## Limits you can change (top of Code.gs)
- `PER_USER_QUOTA_MB = 200` backup space per person
- `STOP_WHEN_DRIVE_PERCENT = 85` stops uploads before your Drive (and Gmail) fill up
- `MAX_SIGNUPS_PER_DAY = 50`

## Updating the script later
Paste the new code, then **Deploy › Manage deployments › Edit (pencil) › Version: New version › Deploy**.
The URL stays the same.

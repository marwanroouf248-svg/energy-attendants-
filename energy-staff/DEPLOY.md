# Energy Staff — safe deploy runbook (staff.energyclubegypt.com)

Static assets are served with `Cache-Control: immutable` ONLY when the `?v=` token equals
the file's live content hash (server/asset-version.mjs). A stale or wrong token gets
`no-cache`, so a changed file can never keep an immutable cached URL.

## After editing anything in dist/ (js/css/html)
1. `node scripts/stamp-version.mjs`  (or `npm run stamp`) — rewrites ?v= in index.html + kiosk.html from real bytes. Idempotent.
2. `npm test` — tests/asset-version.test.mjs FAILS if the stamp is stale. Never deploy with it failing.
3. Upload via hPanel File Browser (hbuilds/current/nodejs/): rename old file to .bak-<token> first, upload, rename into place. server/ changes also need the new .mjs files uploaded.
4. hPanel → site → Running → Restart (NEVER Redeploy — it restores the old ZIP).
5. Verify: `curl -sI https://staff.energyclubegypt.com/hostinger.js?v=<token>` shows immutable; wrong token shows no-cache; `/` shows no-cache; `/api/health` shows no-store.
6. Commit + push branch energy-staff-hostinger.

Never hand-edit ?v= values. Never skip the stamp. kiosk.html has its own token.

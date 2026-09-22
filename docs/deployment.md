---
title: "Deployment"
description: "The live Railway architecture, every bug hit getting there, and how to redeploy or update the database"
---

**Status: live.** The site is deployed and running at **https://fullms-production.up.railway.app** with the same data as the local instance (all 100 students, 30 lecturers, 13 courses, grades, etc. - migrated from the local database, not a fresh install). Login with any account from `docs/presentation-guide.md`.

This document is now a record of what it actually took to get there, including the real bugs hit and fixed along the way - useful both for maintaining this deployment and if you ever need to explain the process.

## Architecture

- **Railway project**: "FUL LMS", containing two services:
  - **`fullms`** - built from this repo's `Dockerfile`, deployed from GitHub (`Faith-Temitope/FuLLMS`, `main` branch). Auto-redeploys on every push to `main`.
  - **`MySQL`** - Railway's managed MySQL, with a persistent volume for the database files.
- **`moodle-volume`** - a persistent Railway Volume mounted at `/var/www/moodledata` on the `fullms` service, so uploaded course files survive redeploys.

## Real problems hit and fixed (for future reference)

1. **`docker VOLUME` instruction rejected.** Railway's build rejects a Docker-native `VOLUME` line in the Dockerfile ("use Railway Volumes" instead). Fixed by removing it from the Dockerfile and adding a Railway Volume separately (`railway volume add -m /var/www/moodledata`, or via the dashboard).
2. **"More than one MPM loaded" - Apache crashed on every startup.** The base image (`moodlehq/moodle-php-apache`) ended up with both `mpm_event` and `mpm_prefork` enabled, which Apache refuses to start with. A build-time `a2dismod`/`a2enmod` didn't survive - something later in the base image's own startup re-enabled the conflicting module. Fixed properly via `docker/entrypoint.d/05-fix-mpm.sh`, which runs from the base image's own documented custom-hook directory (`/docker-entrypoint.d/`), immediately before Apache actually starts - nothing after it can undo the fix.
3. **502 "Application failed to respond."** Railway's proxy needs to know which port the app listens on; Apache listens on 80 by default. Fixed with `railway domain update <domain> --port 80`.
4. **500 error after adding the persistent volume.** Mounting a Railway Volume at `/var/www/moodledata` overrides the ownership set at build time (`chown www-data` in the Dockerfile only affects the image layer, not a volume mounted over it at container start) - it came up root-owned, which PHP (running as `www-data`) couldn't write to. Fixed via `docker/entrypoint.d/03-fix-moodledata-perms.sh`, which re-applies ownership on every container start, after the volume is mounted.
5. **Local `railway up` uploads kept hanging** (Windows Defender likely scanning 55,000+ files in real time during indexing). Switched to connecting the service directly to the GitHub repo (`railway service source connect --repo ... --branch main`) instead - Railway then builds by pulling from GitHub server-to-server, with no dependency on the local machine's upload speed at all. This is also what makes future deploys automatic on `git push`.
6. **Migrating the real data**, not a fresh install: exporting locally (`mysqldump`) and importing directly to Railway's MySQL over its public proxy repeatedly hung (the same kind of local network unreliability as the upload issue). Fixed by transferring the dump over `railway ssh` into the running container instead, then running the import from *inside* the container against MySQL's fast private network address (`mysql.railway.internal`) - avoids the unreliable local connection entirely for the actual bulk transfer.
7. **Custom logo/favicon 404'd after branding was applied.** A genuine Moodle core bug (`admin/lib.php`'s `core_admin_pluginfile()`): the URL builders in core (`get_logo_url()`, `get_compact_logo_url()`, `favicon()`) concatenate the theme revision number directly against the filename with no separator, which collapses two path segments into one on the wire for any large, timestamp-based revision number. The parser on the other end didn't account for that, so `$filename` came back empty and every request 404'd. Fixed with a small, documented patch to `core_admin_pluginfile()` that splits the leading digit run (the revision) from whatever follows (the real filename) - see the `admin/lib.php` diff and its commit message for the full explanation.

## Redeploying

Any push to `main` on GitHub triggers an automatic rebuild and redeploy - no manual steps needed. To force one without a code change: `railway redeploy -s fullms`.

## Updating the live database

The live database is now independent of your local one (they started identical, but will diverge as each gets used). To pull a fresh copy of local data onto the live site again:

```
"C:\xampp\mysql\bin\mysqldump.exe" -u root --routines --triggers --single-transaction moodle > dump.sql
railway ssh -s fullms -- "cat > /tmp/dump.sql" < dump.sql
railway ssh -s fullms -- 'mysql -h mysql.railway.internal -u root -p"$MOODLE_DB_PASS" railway < /tmp/dump.sql'
railway ssh -s fullms -- "rm -f /tmp/dump.sql"
railway ssh -s fullms -- "php admin/cli/purge_caches.php"
```

## Checking on it

```
railway logs -s fullms              # runtime logs
railway logs --build -s fullms      # build logs
railway service list --json         # deployment status
railway ssh -s fullms               # shell into the running container
```

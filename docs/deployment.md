# Deploying FUL LMS Online

This repository now includes everything needed to run this exact codebase (Moodle core + `mod_accessiblematerial` + `local_fulokoja_lms`) on a real cloud host, not just on this laptop's XAMPP: `Dockerfile`, `config.docker.php` (reads database settings from environment variables instead of the hardcoded local ones), and `.dockerignore`.

**Honesty about what's been verified**: the Docker build could not be tested in this development environment - it has no outbound internet access, so it can't reach Docker Hub to pull the base image. The Dockerfile is written correctly per standard Moodle/Docker conventions, but **you need to run the test in Step 0 yourself** before trusting it on a live host, so we're not debugging a broken build for the first time during a Railway deploy.

## Step 0: test the build locally (do this first)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running. Then, from a terminal in this repository's root folder:

```
docker build -t fullms-test .
```

- If it finishes with no errors, the image is good - move to Step 1.
- If it fails, copy the exact error output back to me and I'll fix it before we touch Railway. Common things that could go wrong: a typo'd base image tag, a missing PHP extension the base image doesn't include (rare, since MoodleHQ's image is built specifically for this).

Optional: run it locally to eyeball it before deploying anywhere:
```
docker run -p 8080:80 -e MOODLE_DB_HOST=host.docker.internal -e MOODLE_WWWROOT=http://localhost:8080 fullms-test
```
(This points it at your XAMPP MySQL - only useful as a smoke test that the container itself starts; you'd still need to visit `http://localhost:8080` and the DB user needs to allow connections from Docker's network.)

## Step 1: create a Railway account and project

[Railway](https://railway.app) is recommended: it deploys straight from a GitHub repo's Dockerfile, includes managed MySQL, and has a free trial tier. This step needs your own account/payment details, which I can't create on your behalf.

1. Go to railway.app and sign up (signing in with your GitHub account is easiest, since it can then see your `FuLLMS` repo directly).
2. Click **New Project > Deploy from GitHub repo**, select `Faith-Temitope/FuLLMS`.
3. Railway will detect the `Dockerfile` at the repo root automatically and build from it.

## Step 2: add a managed database

1. In the same Railway project, click **+ New > Database > Add MySQL**.
2. Railway provisions it and shows a set of connection variables (something like `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` - the exact names are shown in that service's **Variables** tab; use whatever it actually shows you, the names above are Railway's usual convention but confirm on screen).

## Step 3: configure the Moodle service's environment variables

On the **Moodle service** (not the database service), go to its **Variables** tab and add:

| Variable | Value |
|---|---|
| `MOODLE_DB_HOST` | Reference the MySQL service's host variable (Railway lets you type `${{MySQL.MYSQLHOST}}` to pull it in live) |
| `MOODLE_DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `MOODLE_DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `MOODLE_DB_PASS` | `${{MySQL.MYSQLPASSWORD}}` |
| `MOODLE_DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `MOODLE_WWWROOT` | set after Step 4 (see below) |

## Step 4: get a public URL and finish MOODLE_WWWROOT

1. On the Moodle service, go to **Settings > Networking > Generate Domain**. Railway gives you a URL like `fullms-production.up.railway.app`.
2. Go back to Variables and set `MOODLE_WWWROOT` to `https://fullms-production.up.railway.app` (your actual generated domain, with `https://`).
3. Redeploy the service (Railway usually does this automatically when variables change).

## Step 5: add persistent storage for uploaded files

1. On the Moodle service, go to **Settings > Volumes > New Volume**.
2. Mount path: `/var/www/moodledata`.
3. Without this, every redeploy wipes uploaded course files.

## Step 6: install the database schema

The Railway MySQL database starts empty - Moodle needs its schema installed once. Easiest path: open the Moodle service's Railway shell/console (or use `railway run`) and run:
```
php admin/cli/install_database.php --agree-license --fullname="FUL LMS" --shortname="FULLMS" --adminuser=faithtemitope --adminpass="<choose a real password>" --adminemail=faithtemitope068@gmail.com
```
Then, to get the same presentation data (100 students, 13 courses, etc.) on the live site:
```
php local/fulokoja_lms/cli/seed_full_semester.php
```

**Alternative**: instead of installing fresh, migrate your actual local data (preserves everything exactly as tested) by exporting your local database and importing it into Railway's MySQL:
```
"C:\xampp\mysql\bin\mysqldump.exe" -u root moodle > fullms_export.sql
```
then import `fullms_export.sql` into the Railway MySQL database using the connection details from Step 2 (Railway's dashboard has a "Connect" button showing the exact `mysql` command to use, since its databases are reachable from outside Railway too).

## Step 7: verify

Visit your Railway URL, log in with an account from `docs/presentation-guide.md`, and confirm a course loads. Report back any errors - Railway's **Deployments > View Logs** shows exactly what went wrong if something doesn't work, and that log output is what I'd need to fix it.

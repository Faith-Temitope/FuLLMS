# FUL LMS

A project on the implementation of LMS as an effective learning path for FUL and the Nigerian university sector as a whole.

**Live demo**: https://fullms-production.up.railway.app (see `docs/presentation-guide.md` for login accounts).

FUL LMS is the Integrated Learning Management System (ILMS) built and configured for Federal University Lokoja: a full, ready-to-deploy learning platform covering course delivery, assignments, grading, announcements and messaging, with accessibility built in from the ground up rather than bolted on afterward. It targets production use for the whole university, not a proof of concept.

The platform is built on [Moodle](https://moodle.org), the world's most widely deployed open-source LMS, rather than written from zero - the same approach used by the large majority of university LMS deployments worldwide, because it means the platform inherits over 20 years of hardening on security, grading correctness, accessibility (Boost theme is WCAG-aligned out of the box), performance at scale, and course/assessment logic, instead of that all needing to be re-proven from scratch for a system that will hold real student data. What FUL gets that a stock Moodle install doesn't is everything in this repository layered on top of it: the accessibility compliance system, the FULokoja-specific dashboard and preferences, its branding/theming, its configured course structure, and its documentation (this README, the student/lecturer guides in `docs/`) - that whole package, not just the two plugin folders below, is the deliverable.

## Engineering additions in this repository

For anyone auditing what's newly written vs. inherited from the platform - this section exists for that purpose, not to scope down what counts as "the project":

- **`mod/accessiblematerial/`** - the Accessibility Compliance Module. A Moodle activity type that lets lecturers upload course material and automatically checks it for accessibility compliance (captions on video, alternative text on images/documents) before publishing it to students.
- **`local/fulokoja_lms/`** - the FULokoja dashboard, the site-wide accessibility preferences system (screen-reader mode, text size, high contrast, caption defaults), the hooks that apply them across every page, and the installable-app (PWA) support described below.

Everything else - course structure, categories, enrolled users, theme/branding configuration, site settings - is deployment and product work on top of the platform, and evolves as the project does (see `docs/`).

## License

This project is built on Moodle, which is free software distributed under the **GNU General Public License v3** - see [`COPYING.txt`](COPYING.txt). The custom components listed above (`mod/accessiblematerial`, `local/fulokoja_lms`) were written for this project by Faith Temitope (2026) and are also released under GPLv3, for compatibility with the platform they extend.

"Moodle" is a registered trademark of Moodle Pty Ltd; this project describes its own implementation built on the Moodle platform, which is an explicitly permitted use under [Moodle's trademark policy](TRADEMARK.txt).

## Getting started (local development)

This project is set up to run under [XAMPP](https://www.apachefriends.org/) on Windows (Apache + MariaDB + PHP).

1. **Install XAMPP** and clone/copy this repository into `C:\xampp\htdocs\moodle` (or your XAMPP `htdocs` folder).
2. **Start Apache and MariaDB** from the XAMPP Control Panel (or `apache_start.bat` / `mysql_start.bat` in the XAMPP folder).
3. **Create the database.** Open `http://localhost/phpmyadmin` and create a database named `moodle` (utf8mb4_unicode_ci collation).
4. **Configure `config.php`** in the repository root with your database name/user/password and `$CFG->wwwroot` (e.g. `http://localhost/moodle`). A `config-dist.php` template is provided if you need to recreate it.
5. **Run the installer/upgrader** from a terminal in the repository root:
   ```
   C:\xampp\php\php.exe admin\cli\upgrade.php --non-interactive
   ```
   (For a brand-new database instead of an existing one, run `admin\cli\install_database.php` first - see `admin/cli/install.php --help`.)
6. **Log in** at `http://localhost/moodle` with your Moodle admin account.
7. To add course material with accessibility checking, open a course, turn editing on, and **Add an activity > Accessible Material**.

### Running checks / tests from the command line

```
C:\xampp\php\php.exe admin\cli\checks.php
```

## Using the platform

- [Student guide](docs/student-guide.md)
- [Lecturer guide](docs/lecturer-guide.md)
- [Demo/presentation accounts and course data](docs/demo-accounts.md)

## Installing it as an app

- **Official Moodle app** (works today, no extra setup beyond enabling mobile web services in Site administration, already on by default here): search "Moodle" on the Play Store or App Store, open it, and enter the site's address to log in.
- **Installable web app (PWA)**: open the site in Chrome (Android) or Safari (iOS) and choose "Add to Home Screen" / "Install app". It installs with FUL's own name and icon, no app store needed. This is provided by `local/fulokoja_lms` (`pwa/manifest.php`, `sw.js`).
- A fully custom native app published under FUL's name in the app stores is a separate, larger undertaking (native app development plus store publishing) - not part of this repository.

## Deployment

This runs under XAMPP for local development, but a real deployment for the whole university needs a persistent Linux server with PHP, a MySQL/MariaDB (or PostgreSQL) database, and a cron job running every minute - Moodle cannot run on serverless/static hosting (e.g. Vercel, Netlify), which has no persistent filesystem, database, or long-running processes. Realistic options:

- **FULokoja's own server infrastructure** - the natural home for this long-term, likely the same infrastructure behind the existing `lms.fulokoja.edu.ng` pilot; requires coordinating with the university's IT/ICT department.
- **A Linux VPS** (DigitalOcean, Hetzner, AWS Lightsail, etc.) running Apache/Nginx + PHP + MariaDB - full control, inexpensive, standard for independent Moodle hosting.

MoodleCloud (Moodle's own managed hosting) is not suitable here, since it does not allow installing custom plugins like the ones in this repository.

For a Docker-based deploy to a platform like Railway (git-push style, closer to what a JS developer expects from Vercel, with a free/cheap tier), see **[docs/deployment.md](docs/deployment.md)** - it includes a ready-to-use `Dockerfile` and step-by-step instructions.

## Original Moodle documentation

- [User documentation](https://docs.moodle.org/)
- [Developer documentation](https://moodledev.io)
- [moodle.org](https://moodle.org) - the central hub for the Moodle community

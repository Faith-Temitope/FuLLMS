# FuLLMS

A project on the implementation of LMS as an effective learning path for FUL and the Nigerian university sector as a whole.

FuLLMS is the Integrated Learning Management System (ILMS) built and configured for Federal University Lokoja: a full, ready-to-deploy learning platform covering course delivery, assignments, grading, announcements and messaging, with accessibility built in from the ground up rather than bolted on afterward. It targets production use for the whole university, not a proof of concept.

The platform is built on [Moodle](https://moodle.org), the world's most widely deployed open-source LMS, rather than written from zero - the same approach used by the large majority of university LMS deployments worldwide, because it means the platform inherits over 20 years of hardening on security, grading correctness, accessibility (Boost theme is WCAG-aligned out of the box), performance at scale, and course/assessment logic, instead of that all needing to be re-proven from scratch for a system that will hold real student data. What FUL gets that a stock Moodle install doesn't is everything in this repository layered on top of it: the accessibility compliance system, the FULokoja-specific dashboard and preferences, its branding/theming, its configured course structure, and its documentation (this README, the student/lecturer guides in `docs/`) - that whole package, not just the two plugin folders below, is the deliverable.

## Engineering additions in this repository

For anyone auditing what's newly written vs. inherited from the platform - this section exists for that purpose, not to scope down what counts as "the project":

- **`mod/accessiblematerial/`** - the Accessibility Compliance Module. A Moodle activity type that lets lecturers upload course material and automatically checks it for accessibility compliance (captions on video, alternative text on images/documents) before publishing it to students.
- **`local/fulokoja_lms/`** - the FULokoja dashboard, the site-wide accessibility preferences system (screen-reader mode, text size, high contrast, caption defaults), and the hooks that apply them across every page.

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

## Original Moodle documentation

- [User documentation](https://docs.moodle.org/)
- [Developer documentation](https://moodledev.io)
- [moodle.org](https://moodle.org) - the central hub for the Moodle community

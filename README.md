# FuLLMS

A project on the implementation of LMS as an effective learning path for FUL and the Nigerian university sector as a whole.

FuLLMS is an Integrated Learning Management System (ILMS) built for Federal University Lokoja as a final year project. It is built on top of [Moodle](https://moodle.org), extended with custom, accessibility-first features designed for FULokoja's course delivery and accessibility needs (see the project report, Chapters 1-3).

## What's custom in this repository

The bulk of this codebase is the Moodle platform itself (unmodified core). The original work for this project lives in:

- **`mod/accessiblematerial/`** - the Accessibility Compliance Module. A Moodle activity type that lets lecturers upload course material and automatically checks it for accessibility compliance (captions on video, alternative text on images/documents) before publishing it to students.
- **`local/fulokoja_lms/`** - a dashboard plugin summarising course, user and assignment activity.

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

## Original Moodle documentation

- [User documentation](https://docs.moodle.org/)
- [Developer documentation](https://moodledev.io)
- [moodle.org](https://moodle.org) - the central hub for the Moodle community

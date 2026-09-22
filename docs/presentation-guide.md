# Presentation Guide

Everything you need to run the system, answer questions about it, and query it live during your presentation (24 & 28 September). Written so you can present from this document without needing to ask me anything in the room.

## 1. How to run it

**For the actual presentation, use the live site - nothing to start up:**

**https://fullms-production.up.railway.app**

It runs on Railway's own servers, independently of this laptop - no need to open XAMPP, Docker, or anything else. Just open that URL in any browser (on any device, including your phone) and log in with an account from section 1a below.

### Local copy (for your own development/testing only)

A separate local copy also exists on this laptop under XAMPP, with its own separate data - useful for testing changes before they go live, not needed for presenting.

1. Open **XAMPP Control Panel** (search it in the Start menu).
2. Click **Start** next to **Apache** and next to **MySQL**.
3. Open a browser to `http://localhost/moodle`.

Changes made locally don't affect the live site until you `git push` and the site auto-redeploys (see `docs/deployment.md`).

**A scheduled task now runs Moodle's background jobs (cron) automatically every minute** (see section 5) as long as this Windows account is logged in. You don't need to do anything for it.

## 1a. Login details

**Important**: your own real matric number is NOT a seeded account - none of the generated students use real FUL matric numbers, only the same *format* (`sci22csc074`-style). Use the exact usernames below, not your own number.

**Your admin account** (the password was reset because the original wasn't known - this is your own account, now with a password on record):

| Username | Password | Role |
|---|---|---|
| `faithtemitope` | `FulAdmin2026!` | Site Administrator (full control) |

**Admin-dashboard accounts** (Manager role - see `docs/demo-accounts.md` for why these aren't raw Site Administrators):

| Username | Password |
|---|---|
| `admin.chioma` | `FulLms2026!` |
| `admin.abdullahi` | `FulLms2026!` |
| `admin.halima` | `FulLms2026!` |

**One ready-to-use student + lecturer per course** (all passwords `FulLms2026!`):

| Course | Student username | Lecturer username |
|---|---|---|
| CSC101 | `sci25csc001` | `halima.adewale` |
| CYB101 | `sci25cyb001` | `ayodele.usman` |
| IFT101 | `sci25ift001` | `kemi.adeyemi` |
| SEN101 | `sci25sen001` | `amina.yakubu` |
| BIO101 | `sci25bio001` | `halima.afolabi` |
| MCB101 | `sci25mcb001` | `bukola.adeyemi` |
| BCH101 | `sci25bch001` | `aliyu.nwosu` |
| CHM101 | `sci25chm001` | `hauwa.lawal` |
| PHY101 | `sci25phy001` | `grace.suleiman` |
| MTH101 | `sci25mth001` | `sani.nwosu` |
| STA101 | `sci25sta001` | `chidinma.sadiq` |
| EDU101 | `edu25edf001` | `damilola.suleiman` |
| SED101 | `edu25sed001` | `musa.adewale` |

For the full list of all 133 accounts, use the SQL query in section 2 below, or `docs/demo-accounts.md`.

## 2. Querying the database yourself

You don't need me for this. Two ways:

### Option A: phpMyAdmin (visual, no typing SQL)
1. With XAMPP running, go to `http://localhost/phpmyadmin`.
2. Click the **moodle** database on the left.
3. Click the **SQL** tab at the top to type/paste a query, or just click on any table name (e.g. `mdl_user`) to browse its rows visually.

### Option B: command line
```
C:\xampp\mysql\bin\mysql.exe -u root moodle -e "YOUR QUERY HERE;"
```

### Useful queries for the presentation

**List all students:**
```sql
SELECT username, firstname, lastname, email FROM mdl_user
WHERE username REGEXP '^(sci|edu)[0-9]{2}' ORDER BY username;
```

**List all courses:**
```sql
SELECT shortname, fullname FROM mdl_course WHERE id > 1;
```

**Check a student's grades in a course** (replace the shortname):
```sql
SELECT gi.itemname, gg.finalgrade
FROM mdl_grade_grades gg
JOIN mdl_grade_items gi ON gi.id = gg.itemid
JOIN mdl_course c ON c.id = gi.courseid
JOIN mdl_user u ON u.id = gg.userid
WHERE c.shortname = 'CSC101' AND u.username = 'sci22csc004';
```

**Accessibility compliance counts** (what FR10's report shows):
```sql
SELECT accessibilitystatus, COUNT(*) FROM mdl_accessiblematerial GROUP BY accessibilitystatus;
```

**Count everything at a glance:**
```sql
SELECT
  (SELECT COUNT(*) FROM mdl_user WHERE deleted=0) AS total_users,
  (SELECT COUNT(*) FROM mdl_course WHERE id>1) AS total_courses,
  (SELECT COUNT(*) FROM mdl_assign) AS total_assignments,
  (SELECT COUNT(*) FROM mdl_quiz) AS total_quizzes;
```

Every table is prefixed `mdl_` (e.g. the "users" table is `mdl_user`, "courses" is `mdl_course`). If someone asks "how is data stored," this prefix convention plus the fact it's a normal relational MySQL/MariaDB database is the honest, simple answer.

## 3. How to create a user (live, in front of the panel)

1. Log in as admin.
2. Go to **☰ menu > Site administration > Users > Add a new user**.
3. Fill in Username, choose "Manual accounts" auth, set a password, First name, Last name, Email.
4. Click **Create user**.
5. To enrol them in a course: open the course → **Participants** (left menu) → **Enrol users** → search their name → pick a role (Student/Teacher) → **Enrol**.

That's the entire manual flow. For bulk creation (which is how the 100 students/30 lecturers were actually made), see section 8.

## 3a. Getting the mobile app

Two ways, in order of how much effort they take:

**1. Install it as an app right now, no app store (recommended for the demo):**
- On Android: open **https://fullms-production.up.railway.app** in Chrome, tap the **⋮** menu, tap **"Add to Home Screen"** / **"Install app"**.
- On iPhone: open the same URL in Safari, tap the **Share** icon, tap **"Add to Home Screen"**.
- It installs with the FUL crest and "FUL LMS" as its name, opens full-screen like a native app, no Play Store/App Store visit needed.

**2. Official Moodle app (full native app, from the app store):**
1. Install **"Moodle"** from the Google Play Store or Apple App Store (the official app, published by Moodle Pty Ltd - free).
2. Open it, tap **"I already have an account"** (or similar), and when it asks for a site URL, enter: `https://fullms-production.up.railway.app`
3. Log in with any account from section 1a.

Both connect to the exact same live site and data - option 1 is faster to show live in a presentation since it needs no app store visit.

## 4. How the forum and communication features work

- **Announcements forum**: every course gets one automatically. Only the lecturer posts here; every enrolled student is notified. This is the direct replacement for the course WhatsApp group described in your Chapter 1.
- **Regular discussion forums** (e.g. "Class Discussion" in CSC101): any enrolled user can start a thread and reply. Fully two-way, unlike Announcements.
- **Private messaging**: the speech-bubble icon (top right) lets any two enrolled people message each other directly, independent of any specific course.
- Under the hood, all three are the same Moodle `forum` activity module (Announcements is just a forum with `type = 'news'`, which restricts posting to teachers) plus Moodle's core messaging system for private messages. Nothing custom was built here - it's stock, mature Moodle functionality your Chapter 3 already argues for reusing rather than rebuilding.

## 5. Cron - what it is and why it matters

Cron is a scheduled background job that Moodle needs to run **every minute** to do anything time-based: send notifications, process the message queue, run scheduled reports, handle calendar reminders, expire old sessions, and more. Without it, the site still works for browsing, but nothing "happens on its own" - notifications queue up and never send, for example.

- **Status**: it's now running automatically via a Windows Scheduled Task called `FULMoodleCron`, registered to fire every minute for as long as this Windows user account is logged in.
- **To check it's alive**: `C:\xampp\php\php.exe admin\cli\checks.php` - if it complains "Cron running... has never been run," it's stopped; otherwise it's fine.
- **To run it manually once** (e.g. to force notifications to send right now for a demo): `C:\xampp\php\php.exe admin\cli\cron.php`
- **In real production**, this would be a Linux cron entry (`* * * * * php admin/cli/cron.php`) on the server instead of a Windows Scheduled Task - same idea, different OS mechanism.

## 6. "Competencies" - is that in here?

Moodle has a real built-in feature called **Competencies** (Site administration > Users > Competencies frameworks) for competency-based education: defining a framework of skills/outcomes, linking them to courses and activities, and tracking whether a student has demonstrated each one. It's not currently configured or used in this project - your project's design centres on accessibility and course delivery, not competency-based assessment, so bringing it up unprompted isn't necessary. If a panel member asks specifically whether Moodle supports competency frameworks, the honest answer is yes, natively, but it wasn't part of this project's scope.

## 7. The stack, methodology and tools - for your presentation

This matches what your project report (Chapter 3) already states, plus the concrete tools actually used:

- **Platform**: [Moodle](https://moodle.org) 4.5, the world's most widely deployed open-source LMS - chosen so the project builds on 20+ years of hardened course/grading/security logic instead of re-proving it from scratch (Section 3.3.2 of your report makes this argument).
- **Language/runtime**: PHP 8.2.
- **Database**: MariaDB (MySQL-compatible), accessed through Moodle's own database abstraction layer.
- **Web server**: Apache, via XAMPP for local development.
- **Frontend**: Moodle's Boost theme (Bootstrap-based, responsive, WCAG-aligned out of the box), extended with custom CSS/JS for the accessibility preference system.
- **Version control**: Git, hosted on GitHub (`github.com/Faith-Temitope/FuLLMS`).
- **Methodology**: Agile, in four sprints, exactly as described in your Chapter 3.3 - each sprint delivered one working increment (environment setup; Accessibility Compliance Module; assignments/grading; announcements/messaging/preferences) rather than one long unbroken build phase.
- **Custom engineering** (the actual new code written for this project, on top of Moodle):
  - `mod_accessiblematerial` - the Accessibility Compliance Module (a Moodle activity plugin).
  - `local_fulokoja_lms` - the dashboard, accessibility preferences system, PWA support, and the FR10 compliance report.
- **AI-assisted development**: built with Claude Code (Anthropic) as a pair-programming/build tool throughout - worth being upfront about this if asked, the same way you'd disclose using any other development tool.
- **Testing approach**: functional verification by logging in as real seeded accounts across every role (student/lecturer/admin) and confirming each feature end to end, rather than relying only on code review.

## 8. How the 100 students / 30 lecturers / 13 courses were actually created

Not by hand - by a PHP script checked into the project (`local/fulokoja_lms/cli/seed_full_semester.php`), run from the command line:
```
C:\xampp\php\php.exe local\fulokoja_lms\cli\seed_full_semester.php
```
This is worth mentioning if asked "how would you roll this out to the whole university" - the same scripted approach (adapted to read a real CSV of FUL's actual students/courses instead of generated placeholder names) is how a real bulk rollout would work, rather than creating thousands of accounts by hand through the web interface.

## 9. Quick answers to likely panel questions

- **"Is this just Moodle with a new coat of paint?"** No - it's Moodle as the proven, secure platform layer, with a genuinely new Accessibility Compliance Module (automatic captioning/alt-text enforcement before publishing, which stock Moodle does not have) and a site-wide accessibility preferences system built specifically for this project.
- **"How do you know the accessibility check actually works?"** It was tested with 7 real scenarios (video with/without captions, image/document with/without alt text, plain text) confirming the exact pass/flag logic from Chapter 3's Algorithm 2, plus confirmed that flagged material is genuinely hidden from students, including a direct-file-URL bypass attempt.
- **"Can lecturers cheat-proof their exams?"** Free measures are already on (shuffled questions, one-per-page, time limits, single attempt). Full Respondus LockDown Browser + webcam proctoring needs a paid institutional subscription - a procurement decision, not a technical gap.
- **"Is it accessible to blind students right now?"** Moodle's Boost theme has strong built-in keyboard/ARIA support, and this project adds a further screen-reader-optimised mode - but it has not yet been tested with a real screen reader (NVDA/JAWS), matching the limitation your own Chapter 1 already discloses.

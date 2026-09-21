# Demo / Presentation Data

This is placeholder data for testing and presentations, seeded on top of the real platform - **not FUL's real student/staff records.** Replace it with FUL's actual course catalogue, department structure, and accounts once available. Nothing here is permanent: courses, categories, and accounts can be renamed, added to, or deleted at any time through Site administration, exactly like any other Moodle data.

## Scale

- **4 faculties, 13 departments** (Computing, Life Sciences, Physical Sciences, Education - the first three faculty names come from your project report's Chapter 1; departments and course catalogue within them are invented placeholders).
- **13 courses**, each built out with a full 8-week structure: a weekly overview page, a reading/content page, a weekly assignment with a due date, an ungraded practice quiz, a proctored-style **Section Exam** at Week 4, and a **Final Exam** at Week 8.
- **100 students** (at least 5 per department), **30 lecturers**, **3 accounts with full admin-dashboard access** (via Moodle's Manager role - see the note below on why these aren't raw Site Administrators).
- Weeks whose due date has already passed (relative to today) have **simulated submissions and grades** (a plausible 65-95 range) so the gradebook looks lived-in rather than empty.
- A general **Class Discussion** forum with a starter thread on CSC101, alongside the existing Announcements forum, demonstrating student-to-student discussion.

## Course structure (one per department)

| Code | Title | Department |
|---|---|---|
| CSC101 | Introduction to Computer Science | Computer Science |
| CYB101 | Introduction to Cybersecurity | Cyber Security |
| IFT101 | Introduction to Information Technology | Information Technology |
| SEN101 | Introduction to Software Engineering | Software Engineering |
| BIO101 | Introduction to Anatomy and Physiology | Biological Sciences |
| MCB101 | Introduction to Microbiology | Microbiology |
| BCH101 | Introduction to Biochemistry | Biochemistry |
| CHM101 | Introductory Chemistry | Chemistry |
| PHY101 | General Physics I | Physics |
| MTH101 | General Mathematics I | Mathematics |
| STA101 | Introduction to Statistics | Statistics |
| EDU101 | Foundations of Education | Educational Foundations |
| SED101 | Introduction to Science Education | Science Education |

Term dates: **24 August - 11 December 2026**.

**Honesty about the quiz content**: each subject has a small reused pool of 5 real, correct multiple-choice questions (not one unique question per week - authoring ~450 unique questions wasn't feasible in the time available). The weekly practice quiz draws 2 rotating questions from the pool; the Section Exam and Final Exam both draw the full 5-question pool. This is enough to demonstrate the real, working quiz/exam mechanism (timed, one-question-per-page, auto-graded) - it is not a substitute for a lecturer building their actual question bank.

**On "Requires Respondus LockDown Browser + Webcam"**: the Section Exam and Final Exam are labelled this way to match what lecturers will expect (per the Oklahoma Christian Canvas example). This is a label only. Actual lockdown/webcam proctoring requires a **paid annual subscription from Respondus Inc.** plus installing their official Moodle plugin - a procurement decision for FUL, not something built into this platform. Free anti-cheating measures Moodle already applies to these exams: one question per page, shuffled answers, a time limit, and a single attempt.

## Accounts

All generated accounts use the password: **`FulLms2026!`**

- **Students**: username = matric number in the form `sci22csc074` (faculty prefix `sci`/`edu` + 2-digit year + department code + serial), email `firstname.lastname@ug.fulokoja.edu.ng`.
- **Lecturers**: username = `firstname.lastname`, email `firstname.lastname@fulokoja.edu.ng`.
- **Admin-role accounts**: username = `admin.firstname`, same email pattern as lecturers.

Query the database for the full list at any time, e.g.:

```sql
SELECT username, firstname, lastname, email FROM mdl_user WHERE username REGEXP '^(sci|edu)[0-9]{2}' ORDER BY username;
```

Your own account (`faithtemitope`) remains the top-level Site Administrator - see `docs/presentation-guide.md` section 1a for its password, which was reset since the original wasn't known.

### Why "admin" accounts use the Manager role, not raw Site Administrator

Adding accounts to Moodle's `$CFG->siteadmins` grants **unrestricted superuser access that bypasses every permission check** - it's the highest-risk privilege in the system, and not something that should be granted by an unattended script. The 3 admin-role accounts instead have the system **Manager** role, which gives full practical admin-dashboard access (user management, course management, reports, the accessibility compliance report) through Moodle's normal, auditable, revocable role/capability system. If you want one of them to become a true Site Administrator, do it explicitly and deliberately via **Site administration > Users > Permissions > Site administrators**.

The smaller original demo accounts (`demo.lecturer1/2`, `demo.student1-4`) and their placeholder courses (CSC201, CSC301, CSC401, LIFSCI101) from initial testing have been removed now that this larger dataset supersedes them. `a11ytestuser` remains - it's a distinct-purpose account exercising the Accessibility Compliance Module's specific pass/flag test cases in the A11YTEST course, not part of the general demo roster.

## Reproducing this data

This is created by a version-controlled, idempotent script, not by hand, so it's reproducible on any install (including a real deployment):

```
C:\xampp\php\php.exe local\fulokoja_lms\cli\seed_full_semester.php
```

It's safe to re-run - every step checks whether the data already exists before creating it. (An earlier, smaller `seed_demo_data.php` script was removed as superseded once this one covered the same ground plus far more; CSC101's original announcement/assignment/accessible-material content it created still exists in the database, just no longer has a script that would recreate it from scratch.)

## Replacing this with real data

When FUL's real course catalogue, department list, and staff/student accounts are available:

- **Bulk-create courses**: Site administration > Courses > Upload courses (CSV) - one row per course.
- **Bulk-create/enrol users**: Site administration > Users > Upload users (CSV) - one row per user, including their role and course.
- **Categories**: Site administration > Courses > Manage courses and categories.

This can also be scripted the same way this placeholder data was, given a spreadsheet/CSV of real courses and accounts.

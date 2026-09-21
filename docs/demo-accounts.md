# Demo / Presentation Data

This is placeholder data for testing and presentations, seeded on top of the real platform. It uses two real faculty names mentioned in the project report (Computing, Life Sciences, Education) but invented course codes and demo names - **replace with FUL's actual course catalogue and department structure once available.** Nothing here is permanent: courses, categories, and accounts can be renamed, added to, or deleted at any time through Site administration, exactly like any other Moodle data.

## Course structure

```
Faculty of Computing
  Department of Computer Science
    CSC101 - Introduction to Computer Science
    CSC201 - Data Structures and Algorithms
    CSC301 - Database Management Systems
    CSC401 - Final Year Project
Faculty of Life Sciences
    LIFSCI101 - Introduction to Life Sciences (placeholder)
Faculty of Education
    EDU101 - Foundations of Education (placeholder)
```

CSC101 has real working content as a demo of the full flow: a welcome announcement, "Assignment 1 - Algorithm Basics" (due 3 weeks from creation), and an Accessible Material item ("Week 1 Slides") that has passed its compliance check.

## Accounts

All demo accounts use the password: **`FulLms2026!`**

| Username | Role | Courses |
|---|---|---|
| `demo.lecturer1` (Amina Suleiman) | Editing teacher | CSC101, CSC201, CSC301, LIFSCI101 |
| `demo.lecturer2` (Chinedu Okafor) | Editing teacher | CSC401, EDU101 |
| `demo.student1` (Blessing Adeyemi) | Student | CSC101, CSC201, CSC301, CSC401 |
| `demo.student2` (Ibrahim Musa) | Student | CSC101, CSC201, CSC301, CSC401 |
| `demo.student3` (Ngozi Eze) | Student | CSC101, CSC201, CSC301, CSC401 |
| `demo.student4` (Yusuf Bello) | Student | CSC101, CSC201, CSC301, CSC401 |
| `a11ytestuser` | Student | A11YTEST demo course only (accessibility compliance test cases) |

Your own account remains the site administrator.

This data is created by a script, not by hand, so it's reproducible on any fresh install (including a real production deployment) by running:

```
C:\xampp\php\php.exe local\fulokoja_lms\cli\seed_demo_data.php
```

It's safe to re-run - every step checks whether the data already exists first.

## Replacing this with real data

When FUL's real course catalogue, department list, and staff/student accounts are available:

- **Bulk-create courses**: Site administration > Courses > Upload courses (CSV) - one row per course.
- **Bulk-create/enrol users**: Site administration > Users > Upload users (CSV) - one row per user, including their role and course.
- **Categories**: Site administration > Courses > Manage courses and categories.

All of this can also be scripted the same way this placeholder data was, if there's a large dataset to import at once - ask and it can be generated from a spreadsheet/CSV of real courses and accounts.

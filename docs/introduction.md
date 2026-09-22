---
title: "Introduction"
description: "The Federal University Lokoja Integrated Learning Management System - what it is and how this documentation is organised"
---

FUL LMS is the Integrated Learning Management System (ILMS) built and configured for Federal University Lokoja: a full, production-targeted learning platform covering course delivery, assignments, grading, announcements and messaging, with accessibility built in from the ground up rather than bolted on afterward.

**Live site**: [fullms-production.up.railway.app](https://fullms-production.up.railway.app)
**Source code**: [github.com/Faith-Temitope/FuLLMS](https://github.com/Faith-Temitope/FuLLMS)

## What's actually new here

The platform is built on [Moodle](https://moodle.org), the world's most widely deployed open-source LMS, extended with two original components:

- **Accessibility Compliance Module** (`mod_accessiblematerial`) - a Moodle activity type that automatically checks uploaded course material for accessibility (captions on video, alternative text on images/documents) before publishing it to students, flagging anything that fails until the lecturer fixes it.
- **FULokoja dashboard and accessibility preferences** (`local_fulokoja_lms`) - site-wide screen-reader mode, adjustable text size, high contrast mode, an installable-app (PWA) layer, and the accessibility/usage compliance report for administrators.

## Where to go next

- New here? Start with the [Student Guide](/docs/student-guide) or [Lecturer Guide](/docs/lecturer-guide).
- Presenting or defending this project? [Presentation Guide](/docs/presentation-guide) has login accounts, SQL queries, the tech stack, and likely panel questions, all in one place.
- Deploying or maintaining the live site? [Deployment](/docs/deployment) is a full record of the production setup and every bug hit getting there.
- Curious about the demo data (100 students, 13 courses, etc.)? See [Demo Accounts](/docs/demo-accounts).

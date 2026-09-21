<?php
/**
 * Seeds placeholder demo/presentation data: faculty/department categories, a semester's
 * worth of courses, demo accounts across every role, and working sample content in one
 * course (announcement, assignment, Accessible Material). Safe to re-run - every step
 * checks for existing data first, so it will not create duplicates.
 *
 * This is throwaway placeholder data for testing and presentations (see
 * docs/demo-accounts.md), not FUL's real course catalogue. Replace it via Site
 * administration's "Upload courses"/"Upload users" CSV tools once real data is available.
 *
 * Usage: php local/fulokoja_lms/cli/seed_demo_data.php
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/mod/accessiblematerial/lib.php');

global $DB, $CFG;

$admins = get_admins();
$admin = reset($admins);
if (!$admin) {
    cli_error('No admin account found - create one before running this script.');
}
\core\session\manager::set_user($admin);

function fulokoja_get_or_create_category(string $name, int $parentid = 0): core_course_category {
    global $DB;
    $existing = $DB->get_record('course_categories', ['name' => $name, 'parent' => $parentid]);
    if ($existing) {
        return core_course_category::get($existing->id);
    }
    return core_course_category::create(['name' => $name, 'parent' => $parentid]);
}

function fulokoja_get_or_create_user(string $username, string $firstname, string $lastname): stdClass {
    global $DB, $CFG;
    $existing = $DB->get_record('user', ['username' => $username]);
    if ($existing) {
        return $existing;
    }
    $user = new stdClass();
    $user->username = $username;
    $user->password = 'FulLms2026!';
    $user->firstname = $firstname;
    $user->lastname = $lastname;
    $user->email = $username . '@fulokoja.demo';
    $user->auth = 'manual';
    $user->confirmed = 1;
    $user->mnethostid = $CFG->mnet_localhost_id;
    $userid = user_create_user($user, true, false);
    return $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
}

function fulokoja_get_or_create_course(string $shortname, string $fullname, int $categoryid, string $summary): stdClass {
    global $DB;
    $existing = $DB->get_record('course', ['shortname' => $shortname]);
    if ($existing) {
        return $existing;
    }
    $data = new stdClass();
    $data->fullname = $fullname;
    $data->shortname = $shortname;
    $data->category = $categoryid;
    $data->summary = $summary;
    $data->visible = 1;
    $data->startdate = strtotime('2026-01-12');
    $data->enddate = strtotime('2026-05-15');
    return create_course($data);
}

function fulokoja_enrol_as(stdClass $course, stdClass $user, string $rolename): void {
    global $DB;
    $context = context_course::instance($course->id);
    if (is_enrolled($context, $user->id)) {
        return;
    }
    $role = $DB->get_record('role', ['shortname' => $rolename], '*', MUST_EXIST);
    $enrolplugin = enrol_get_plugin('manual');
    $instances = enrol_get_instances($course->id, true);
    $manualinstance = null;
    foreach ($instances as $instance) {
        if ($instance->enrol === 'manual') {
            $manualinstance = $instance;
            break;
        }
    }
    if (!$manualinstance) {
        $instanceid = $enrolplugin->add_instance($course);
        $manualinstance = $DB->get_record('enrol', ['id' => $instanceid]);
    }
    $enrolplugin->enrol_user($manualinstance, $user->id, $role->id);
}

mtrace('=== Categories ===');
$facultyofcomputing = fulokoja_get_or_create_category('Faculty of Computing');
$deptcs = fulokoja_get_or_create_category('Department of Computer Science', $facultyofcomputing->id);
$facultyoflifesciences = fulokoja_get_or_create_category('Faculty of Life Sciences');
$facultyofeducation = fulokoja_get_or_create_category('Faculty of Education');
mtrace('Faculty of Computing > Department of Computer Science, Faculty of Life Sciences, Faculty of Education');

mtrace('');
mtrace('=== Courses ===');
$courses = [
    'CSC101' => fulokoja_get_or_create_course('CSC101', 'CSC101 - Introduction to Computer Science', $deptcs->id,
        'Foundational concepts of computing, algorithms and problem solving.'),
    'CSC201' => fulokoja_get_or_create_course('CSC201', 'CSC201 - Data Structures and Algorithms', $deptcs->id,
        'Core data structures, algorithm design and complexity analysis.'),
    'CSC301' => fulokoja_get_or_create_course('CSC301', 'CSC301 - Database Management Systems', $deptcs->id,
        'Relational database design, SQL, and database administration.'),
    'CSC401' => fulokoja_get_or_create_course('CSC401', 'CSC401 - Final Year Project', $deptcs->id,
        'Supervised final year research and development project.'),
    'LIFSCI101' => fulokoja_get_or_create_course('LIFSCI101', 'LIFSCI101 - Introduction to Life Sciences', $facultyoflifesciences->id,
        'Placeholder course - replace with real Life Sciences department course list.'),
    'EDU101' => fulokoja_get_or_create_course('EDU101', 'EDU101 - Foundations of Education', $facultyofeducation->id,
        'Placeholder course - replace with real Faculty of Education course list.'),
];
foreach ($courses as $shortname => $c) {
    mtrace(" - $shortname: {$c->fullname} (id={$c->id})");
}

mtrace('');
mtrace('=== Demo accounts ===');
$lecturers = [
    fulokoja_get_or_create_user('demo.lecturer1', 'Amina', 'Suleiman'),
    fulokoja_get_or_create_user('demo.lecturer2', 'Chinedu', 'Okafor'),
];
$students = [
    fulokoja_get_or_create_user('demo.student1', 'Blessing', 'Adeyemi'),
    fulokoja_get_or_create_user('demo.student2', 'Ibrahim', 'Musa'),
    fulokoja_get_or_create_user('demo.student3', 'Ngozi', 'Eze'),
    fulokoja_get_or_create_user('demo.student4', 'Yusuf', 'Bello'),
];
foreach (array_merge($lecturers, $students) as $u) {
    mtrace(" - {$u->username} ({$u->firstname} {$u->lastname})");
}

mtrace('');
mtrace('=== Enrolments ===');
foreach ([$courses['CSC101'], $courses['CSC201'], $courses['CSC301']] as $course) {
    fulokoja_enrol_as($course, $lecturers[0], 'editingteacher');
}
fulokoja_enrol_as($courses['CSC401'], $lecturers[1], 'editingteacher');
fulokoja_enrol_as($courses['LIFSCI101'], $lecturers[0], 'editingteacher');
fulokoja_enrol_as($courses['EDU101'], $lecturers[1], 'editingteacher');

foreach ([$courses['CSC101'], $courses['CSC201'], $courses['CSC301'], $courses['CSC401']] as $course) {
    foreach ($students as $student) {
        fulokoja_enrol_as($course, $student, 'student');
    }
}
mtrace('Enrolled lecturers and students on their courses.');

mtrace('');
mtrace('=== Sample course content (CSC101) ===');
$csc101 = $courses['CSC101'];
$lecturer = $lecturers[0];

$newsforum = $DB->get_record('forum', ['course' => $csc101->id, 'type' => 'news']);
if ($newsforum && !$DB->record_exists('forum_discussions', ['forum' => $newsforum->id, 'name' => 'Welcome to CSC101'])) {
    $discussion = new stdClass();
    $discussion->course = $csc101->id;
    $discussion->forum = $newsforum->id;
    $discussion->name = 'Welcome to CSC101';
    $discussion->assessed = 0;
    $discussion->userid = $lecturer->id;
    $discussion->message = 'Welcome to Introduction to Computer Science. Lecture materials, assignments and '
        . 'announcements will all be posted here going forward instead of the WhatsApp group.';
    $discussion->messageformat = FORMAT_HTML;
    $discussion->messagetrust = 0;
    $discussion->mailnow = 0;
    forum_add_discussion($discussion, null, null, $lecturer->id);
    mtrace('Added welcome announcement.');
} else {
    mtrace('Announcement already present.');
}

if (!$DB->record_exists('assign', ['course' => $csc101->id, 'name' => 'Assignment 1 - Algorithm Basics'])) {
    $moduleinfo = new stdClass();
    $moduleinfo->modulename = 'assign';
    $moduleinfo->course = $csc101->id;
    $moduleinfo->section = 0;
    $moduleinfo->visible = 1;
    $moduleinfo->name = 'Assignment 1 - Algorithm Basics';
    $moduleinfo->introeditor = [
        'text' => 'Write pseudocode for three basic sorting algorithms and submit as a single PDF.',
        'format' => FORMAT_HTML,
        'itemid' => 0,
    ];
    $moduleinfo->showdescription = 1;
    $moduleinfo->allowsubmissionsfromdate = time();
    $moduleinfo->duedate = strtotime('+3 weeks');
    $moduleinfo->cutoffdate = 0;
    $moduleinfo->gradingduedate = 0;
    $moduleinfo->assignsubmission_onlinetext_enabled = 0;
    $moduleinfo->assignsubmission_file_enabled = 1;
    $moduleinfo->assignsubmission_file_maxfiles = 1;
    $moduleinfo->assignsubmission_file_maxsizebytes = 0;
    $moduleinfo->submissiondrafts = 0;
    $moduleinfo->requiresubmissionstatement = 0;
    $moduleinfo->sendnotifications = 0;
    $moduleinfo->sendlatenotifications = 0;
    $moduleinfo->sendstudentnotifications = 0;
    $moduleinfo->grade = 100;
    $moduleinfo->teamsubmission = 0;
    $moduleinfo->requireallteammemberssubmit = 0;
    $moduleinfo->blindmarking = 0;
    $moduleinfo->markingworkflow = 0;
    $moduleinfo->markingallocation = 0;
    $moduleinfo->maxattempts = -1;
    $moduleinfo->attemptreopenmethod = 'none';
    $moduleinfo->completion = 0;
    $moduleinfo->groupmode = 0;
    $moduleinfo->groupingid = 0;
    create_module($moduleinfo);
    mtrace('Added Assignment 1.');
} else {
    mtrace('Assignment already present.');
}

if (!$DB->record_exists('accessiblematerial', ['course' => $csc101->id])) {
    $usercontext = context_user::instance($lecturer->id);
    $draftitemid = 0;
    file_prepare_draft_area($draftitemid, $usercontext->id, 'user', 'draft', null);
    get_file_storage()->create_file_from_string([
        'contextid' => $usercontext->id,
        'component' => 'user',
        'filearea' => 'draft',
        'itemid' => $draftitemid,
        'filepath' => '/',
        'filename' => 'week1-slides.pdf',
    ], str_repeat('x', 2000));
    $emptycaptiondraft = 0;
    file_prepare_draft_area($emptycaptiondraft, $usercontext->id, 'user', 'draft', null);

    $moduleinfo = new stdClass();
    $moduleinfo->modulename = 'accessiblematerial';
    $moduleinfo->course = $csc101->id;
    $moduleinfo->section = 0;
    $moduleinfo->visible = 1;
    $moduleinfo->name = 'Week 1 Slides - Introduction to Computing';
    $moduleinfo->introeditor = ['text' => '', 'format' => FORMAT_HTML, 'itemid' => 0];
    $moduleinfo->showdescription = 0;
    $moduleinfo->material = $draftitemid;
    $moduleinfo->captionfile = $emptycaptiondraft;
    $moduleinfo->alttext = 'Week 1 lecture slides covering the history and basic concepts of computer science.';
    $moduleinfo->completion = 0;
    $moduleinfo->groupmode = 0;
    $moduleinfo->groupingid = 0;
    create_module($moduleinfo);
    mtrace('Added Accessible Material (Week 1 Slides).');
} else {
    mtrace('Accessible Material already present.');
}

mtrace('');
mtrace('Done. See docs/demo-accounts.md for the account list and password.');

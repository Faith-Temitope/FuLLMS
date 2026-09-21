<?php
/**
 * Seeds a full presentation-ready semester: faculty/department categories, ~100 students,
 * ~30 lecturers, 3 extra admins, and 10 courses each built out with a full 8-week structure
 * (overview, content, weekly assignment with due date, practice quiz, a proctored-style
 * Section Exam at week 4 and Final Exam at week 8) - plus simulated submissions/grades for
 * completed weeks so the gradebook looks lived-in.
 *
 * This is placeholder presentation data (see docs/demo-accounts.md), not FUL's real student
 * records - it exists to demo the platform convincingly, and is safe to re-run (every step
 * checks for existing data first).
 *
 * Usage: php local/fulokoja_lms/cli/seed_full_semester.php
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/mod/assign/lib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/question/engine/bank.php');
require_once($CFG->dirroot . '/question/type/questiontypebase.php');

global $DB, $CFG;

$admins = get_admins();
$admin = reset($admins);
if (!$admin) {
    cli_error('No admin account found - create one before running this script.');
}
\core\session\manager::set_user($admin);

// ---------------------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------------------

$faculties = [
    'Faculty of Computing' => [
        'matricprefix' => 'sci',
        'depts' => [
            'csc' => ['name' => 'Computer Science', 'students' => 12, 'instructors' => 4],
            'cyb' => ['name' => 'Cyber Security', 'students' => 8, 'instructors' => 2],
            'ift' => ['name' => 'Information Technology', 'students' => 6, 'instructors' => 2],
            'sen' => ['name' => 'Software Engineering', 'students' => 6, 'instructors' => 2],
        ],
    ],
    'Faculty of Life Sciences' => [
        'matricprefix' => 'sci',
        'depts' => [
            'bio' => ['name' => 'Biological Sciences', 'students' => 10, 'instructors' => 3],
            'mcb' => ['name' => 'Microbiology', 'students' => 6, 'instructors' => 2],
            'bch' => ['name' => 'Biochemistry', 'students' => 6, 'instructors' => 2],
            'chm' => ['name' => 'Chemistry', 'students' => 8, 'instructors' => 3],
        ],
    ],
    'Faculty of Physical Sciences' => [
        'matricprefix' => 'sci',
        'depts' => [
            'phy' => ['name' => 'Physics', 'students' => 6, 'instructors' => 2],
            'mth' => ['name' => 'Mathematics', 'students' => 8, 'instructors' => 3],
            'sta' => ['name' => 'Statistics', 'students' => 5, 'instructors' => 2],
        ],
    ],
    'Faculty of Education' => [
        'matricprefix' => 'edu',
        'depts' => [
            'edf' => ['name' => 'Educational Foundations', 'students' => 10, 'instructors' => 2],
            'sed' => ['name' => 'Science Education', 'students' => 9, 'instructors' => 1],
        ],
    ],
];

$firstnames = [
    'Amina', 'Chinedu', 'Blessing', 'Ibrahim', 'Ngozi', 'Yusuf', 'Fatima', 'Emeka', 'Grace', 'Musa',
    'Chioma', 'Abdullahi', 'Halima', 'Oluwaseun', 'Tunde', 'Aisha', 'Chukwuemeka', 'Folake', 'Sani', 'Adaeze',
    'Kabiru', 'Bukola', 'Nnamdi', 'Zainab', 'Ayodele', 'Umar', 'Chidinma', 'Bello', 'Temitope', 'Aliyu',
    'Ify', 'Suleiman', 'Kemi', 'Garba', 'Ada', 'Rasheed', 'Nkechi', 'Yakubu', 'Damilola', 'Hauwa',
];
$lastnames = [
    'Suleiman', 'Okafor', 'Adeyemi', 'Musa', 'Eze', 'Bello', 'Ibrahim', 'Chukwu', 'Okonkwo', 'Abubakar',
    'Nwosu', 'Yakubu', 'Adewale', 'Mohammed', 'Okoro', 'Danjuma', 'Balogun', 'Uzoma', 'Sadiq', 'Obi',
    'Lawal', 'Nwachukwu', 'Idris', 'Afolabi', 'Usman', 'Onyeka', 'Garba', 'Adekunle', 'Haruna', 'Ekwueme',
];

function fulokoja_name(int $index): array {
    global $firstnames, $lastnames;
    // Shifting the lastname pool position by a full firstname-cycle count avoids the short
    // repeat period a fixed-multiplier formula would have for a name space this size.
    $first = $firstnames[$index % count($firstnames)];
    $last = $lastnames[($index + intdiv($index, count($firstnames))) % count($lastnames)];
    return [$first, $last];
}

// ---------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------

function fulokoja_get_or_create_category(string $name, int $parentid = 0): core_course_category {
    global $DB;
    $existing = $DB->get_record('course_categories', ['name' => $name, 'parent' => $parentid]);
    if ($existing) {
        return core_course_category::get($existing->id);
    }
    return core_course_category::create(['name' => $name, 'parent' => $parentid]);
}

function fulokoja_get_or_create_person(string $username, string $first, string $last, string $email): stdClass {
    global $DB, $CFG;
    $existing = $DB->get_record('user', ['username' => $username]);
    if ($existing) {
        return $existing;
    }
    $user = new stdClass();
    $user->username = $username;
    $user->password = 'FulLms2026!';
    $user->firstname = $first;
    $user->lastname = $last;
    $user->email = $email;
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
    $data->startdate = strtotime('2026-08-24');
    $data->enddate = strtotime('2026-12-11');
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

function fulokoja_add_page(stdClass $course, int $section, string $name, string $content): stdClass {
    global $DB;
    $existing = $DB->get_record('page', ['course' => $course->id, 'name' => $name]);
    if ($existing) {
        return $existing;
    }
    $moduleinfo = new stdClass();
    $moduleinfo->modulename = 'page';
    $moduleinfo->course = $course->id;
    $moduleinfo->section = $section;
    $moduleinfo->visible = 1;
    $moduleinfo->name = $name;
    $moduleinfo->introeditor = ['text' => '', 'format' => FORMAT_HTML, 'itemid' => 0];
    $moduleinfo->showdescription = 0;
    $moduleinfo->page = ['text' => $content, 'format' => FORMAT_HTML, 'itemid' => 0];
    $moduleinfo->printintro = 0;
    $moduleinfo->printlastmodified = 0;
    $moduleinfo->display = 0;
    $moduleinfo->popupwidth = 620;
    $moduleinfo->popupheight = 450;
    $moduleinfo->revision = 1;
    $moduleinfo->completion = 0;
    $moduleinfo->groupmode = 0;
    $moduleinfo->groupingid = 0;
    $created = create_module($moduleinfo);
    return $DB->get_record('page', ['id' => $created->instance], '*', MUST_EXIST);
}

function fulokoja_add_assignment(stdClass $course, int $section, string $name, string $intro, int $duedate): stdClass {
    global $DB;
    $existing = $DB->get_record('assign', ['course' => $course->id, 'name' => $name]);
    if ($existing) {
        return $existing;
    }
    $moduleinfo = new stdClass();
    $moduleinfo->modulename = 'assign';
    $moduleinfo->course = $course->id;
    $moduleinfo->section = $section;
    $moduleinfo->visible = 1;
    $moduleinfo->name = $name;
    $moduleinfo->introeditor = ['text' => $intro, 'format' => FORMAT_HTML, 'itemid' => 0];
    $moduleinfo->showdescription = 1;
    $moduleinfo->allowsubmissionsfromdate = $duedate - (7 * DAYSECS);
    $moduleinfo->duedate = $duedate;
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
    $created = create_module($moduleinfo);
    return $DB->get_record('assign', ['id' => $created->instance], '*', MUST_EXIST);
}

/**
 * Creates (or reuses) a question category + a set of multichoice questions for a subject.
 * $questions: array of ['text' => ..., 'options' => [...], 'correct' => index]
 * @return int[] question ids
 */
function fulokoja_get_or_create_question_bank(string $subjectname, array $questions): array {
    global $DB;

    $syscontext = context_system::instance();
    $category = $DB->get_record('question_categories', ['name' => $subjectname, 'contextid' => $syscontext->id]);
    if (!$category) {
        $topcat = question_get_top_category($syscontext->id, true);
        $category = new stdClass();
        $category->name = $subjectname;
        $category->contextid = $syscontext->id;
        $category->info = '';
        $category->infoformat = FORMAT_HTML;
        $category->stamp = make_unique_id_code();
        $category->parent = $topcat->id;
        $category->sortorder = 999;
        $category->id = $DB->insert_record('question_categories', $category);
    }

    $qtype = question_bank::get_qtype('multichoice');
    $ids = [];
    foreach ($questions as $i => $q) {
        $qname = $subjectname . ' Q' . ($i + 1);
        $existingentry = $DB->get_record('question', ['name' => $qname]);
        if ($existingentry) {
            $ids[] = (int) $existingentry->id;
            continue;
        }

        $form = new stdClass();
        $form->category = $category->id . ',' . $syscontext->id;
        $form->name = $qname;
        $form->questiontext = ['text' => $q['text'], 'format' => FORMAT_HTML];
        $form->generalfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $form->defaultmark = 1;
        $form->penalty = 0.3333333;
        $form->single = 1;
        $form->shuffleanswers = 1;
        $form->answernumbering = 'abc';
        $form->showstandardinstruction = 0;
        $form->correctfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $form->partiallycorrectfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $form->incorrectfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $form->answer = [];
        $form->fraction = [];
        $form->feedback = [];
        foreach ($q['options'] as $oi => $optiontext) {
            $form->answer[] = ['text' => $optiontext, 'format' => FORMAT_HTML];
            $form->fraction[] = ($oi === $q['correct']) ? 1 : 0;
            $form->feedback[] = ['text' => '', 'format' => FORMAT_HTML];
        }

        $question = new stdClass();
        $question->qtype = 'multichoice';
        $saved = $qtype->save_question($question, $form);
        $ids[] = (int) $saved->id;
    }
    return $ids;
}

function fulokoja_add_quiz(stdClass $course, int $section, string $name, string $intro, array $questionids, array $opts = []): stdClass {
    global $DB;
    $existing = $DB->get_record('quiz', ['course' => $course->id, 'name' => $name]);
    if (!$existing) {
        $moduleinfo = new stdClass();
        $moduleinfo->modulename = 'quiz';
        $moduleinfo->course = $course->id;
        $moduleinfo->section = $section;
        $moduleinfo->visible = 1;
        $moduleinfo->name = $name;
        $moduleinfo->introeditor = ['text' => $intro, 'format' => FORMAT_HTML, 'itemid' => 0];
        $moduleinfo->showdescription = 1;
        $moduleinfo->quizpassword = '';
        $moduleinfo->subnet = '';
        $moduleinfo->browsersecurity = '-';
        $moduleinfo->delay1 = 0;
        $moduleinfo->delay2 = 0;
        $moduleinfo->showblocks = 0;
        $moduleinfo->allowofflineattempts = 0;
        $moduleinfo->timeopen = 0;
        $moduleinfo->timeclose = 0;
        $moduleinfo->timelimit = $opts['timelimit'] ?? 0;
        $moduleinfo->overduehandling = 'autosubmit';
        $moduleinfo->graceperiod = 0;
        $moduleinfo->preferredbehaviour = 'deferredfeedback';
        $moduleinfo->attempts = $opts['attempts'] ?? 0;
        $moduleinfo->grademethod = 1;
        $moduleinfo->questiondecimalpoints = -1;
        $moduleinfo->reviewattempt = 0x11110;
        $moduleinfo->reviewcorrectness = 0x11110;
        $moduleinfo->reviewmarks = 0x11110;
        $moduleinfo->reviewspecificfeedback = 0x11110;
        $moduleinfo->reviewgeneralfeedback = 0x11110;
        $moduleinfo->reviewrightanswer = 0x11110;
        $moduleinfo->reviewoverallfeedback = 0x11110;
        $moduleinfo->questionsperpage = 1;
        $moduleinfo->navmethod = 'free';
        $moduleinfo->shuffleanswers = 1;
        $moduleinfo->sumgrades = count($questionids);
        $moduleinfo->grade = 100;
        $moduleinfo->completion = 0;
        $moduleinfo->groupmode = 0;
        $moduleinfo->groupingid = 0;
        $created = create_module($moduleinfo);
        $existing = $DB->get_record('quiz', ['id' => $created->instance], '*', MUST_EXIST);

        foreach ($questionids as $qid) {
            quiz_add_quiz_question($qid, $existing);
        }
    }
    return $existing;
}

/**
 * Simulates a graded submission for a past-due assignment so the gradebook looks lived-in.
 */
function fulokoja_simulate_grade(stdClass $assign, stdClass $student, stdClass $grader, float $grade): void {
    global $DB;

    if ($DB->record_exists('assign_grades', ['assignment' => $assign->id, 'userid' => $student->id])) {
        return;
    }

    $submission = new stdClass();
    $submission->assignment = $assign->id;
    $submission->userid = $student->id;
    $submission->timecreated = time();
    $submission->timemodified = time();
    $submission->status = 'submitted';
    $submission->attemptnumber = 0;
    $submission->latest = 1;
    $DB->insert_record('assign_submission', $submission);

    $gradereco = new stdClass();
    $gradereco->assignment = $assign->id;
    $gradereco->userid = $student->id;
    $gradereco->timecreated = time();
    $gradereco->timemodified = time();
    $gradereco->grader = $grader->id;
    $gradereco->grade = $grade;
    $gradereco->attemptnumber = 0;
    $DB->insert_record('assign_grades', $gradereco);

    assign_update_grades($assign, $student->id);
}

// ---------------------------------------------------------------------------------------
// 1. Categories
// ---------------------------------------------------------------------------------------

mtrace('=== Categories ===');
$facultycats = [];
$deptcats = [];
foreach ($faculties as $facultyname => $facultydata) {
    $facultycats[$facultyname] = fulokoja_get_or_create_category($facultyname);
    foreach ($facultydata['depts'] as $deptcode => $deptdata) {
        $deptcats[$deptcode] = fulokoja_get_or_create_category('Department of ' . $deptdata['name'], $facultycats[$facultyname]->id);
    }
}
mtrace('Created/verified ' . count($faculties) . ' faculties and ' . count($deptcats) . ' departments.');

// ---------------------------------------------------------------------------------------
// 2. Students, instructors, admins
// ---------------------------------------------------------------------------------------

mtrace('');
mtrace('=== Generating people ===');
$nameindex = 0;
$studentsbydept = [];
$instructorsbydept = [];
$years = ['26', '25', '24', '23', '22'];

foreach ($faculties as $facultyname => $facultydata) {
    $prefix = $facultydata['matricprefix'];
    foreach ($facultydata['depts'] as $deptcode => $deptdata) {
        $studentsbydept[$deptcode] = [];
        for ($i = 1; $i <= $deptdata['students']; $i++) {
            [$first, $last] = fulokoja_name($nameindex++);
            $year = $years[$i % count($years)];
            $matric = $prefix . $year . $deptcode . str_pad((string) $i, 3, '0', STR_PAD_LEFT);
            $email = strtolower($first . '.' . $last) . '@ug.fulokoja.edu.ng';
            $studentsbydept[$deptcode][] = fulokoja_get_or_create_person($matric, $first, $last, $email);
        }

        $instructorsbydept[$deptcode] = [];
        for ($i = 1; $i <= $deptdata['instructors']; $i++) {
            [$first, $last] = fulokoja_name($nameindex++);
            $username = strtolower($first . '.' . $last);
            $email = $username . '@fulokoja.edu.ng';
            $instructorsbydept[$deptcode][] = fulokoja_get_or_create_person($username, $first, $last, $email);
        }
    }
}
$totalstudents = array_sum(array_map('count', $studentsbydept));
$totalinstructors = array_sum(array_map('count', $instructorsbydept));
mtrace("Created/verified $totalstudents students and $totalinstructors instructors across departments.");

// Admins: given the system "manager" role at the system context. This grants full
// admin-dashboard capabilities (user management, course management, reports, etc.) through
// Moodle's normal, auditable, revocable role system. It deliberately does NOT add these
// accounts to $CFG->siteadmins, which is unrestricted superuser access that bypasses every
// capability check - too high-blast-radius to grant from an unattended script. If true
// Site Administrator access is wanted for one of these accounts, add it explicitly via
// Site administration > Users > Permissions > Site administrators.
$adminaccounts = [];
$managerrole = $DB->get_record('role', ['shortname' => 'manager'], '*', MUST_EXIST);
$syscontext = context_system::instance();
for ($i = 1; $i <= 3; $i++) {
    [$first, $last] = fulokoja_name($nameindex++);
    $username = 'admin.' . strtolower($first);
    $email = strtolower($first . '.' . $last) . '@fulokoja.edu.ng';
    $adminuser = fulokoja_get_or_create_person($username, $first, $last, $email);
    role_assign($managerrole->id, $adminuser->id, $syscontext->id);
    $adminaccounts[] = $adminuser;
}
mtrace('Created/verified 3 accounts with the system Manager role (full admin dashboard access, not raw superuser).');

mtrace('Done with people. See docs/demo-accounts.md for the full list and password (FulLms2026!).');

// ---------------------------------------------------------------------------------------
// 3. Subject question banks (reused across weekly practice quizzes and exams - see
//    docs/demo-accounts.md for the note on this being a reused pool, not per-week content)
// ---------------------------------------------------------------------------------------

$questionbanks = [
    'csc' => [
        ['text' => 'Which data structure uses FIFO (First In, First Out) ordering?', 'options' => ['Stack', 'Queue', 'Tree', 'Graph'], 'correct' => 1],
        ['text' => 'What is the time complexity of binary search on a sorted array of n elements?', 'options' => ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], 'correct' => 1],
        ['text' => 'Which of the following is NOT a programming paradigm?', 'options' => ['Object-Oriented', 'Functional', 'Procedural', 'Alphabetical'], 'correct' => 3],
        ['text' => 'In SQL, which statement is used to retrieve data from a database?', 'options' => ['INSERT', 'UPDATE', 'SELECT', 'DELETE'], 'correct' => 2],
        ['text' => 'What does CPU stand for?', 'options' => ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit'], 'correct' => 0],
    ],
    'bio' => [
        ['text' => 'Which organ is primarily responsible for filtering blood and producing urine?', 'options' => ['Liver', 'Kidney', 'Lung', 'Pancreas'], 'correct' => 1],
        ['text' => 'What is the basic unit of life?', 'options' => ['Tissue', 'Organ', 'Cell', 'Organism'], 'correct' => 2],
        ['text' => 'Which blood cells are primarily responsible for fighting infection?', 'options' => ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma'], 'correct' => 1],
        ['text' => 'The process by which plants make their own food using sunlight is called?', 'options' => ['Respiration', 'Photosynthesis', 'Digestion', 'Transpiration'], 'correct' => 1],
        ['text' => 'Which system in the human body is responsible for hormone regulation?', 'options' => ['Nervous system', 'Endocrine system', 'Skeletal system', 'Muscular system'], 'correct' => 1],
    ],
    'mcb' => [
        ['text' => 'Which type of microorganism is used to make bread rise?', 'options' => ['Bacteria', 'Yeast (fungus)', 'Virus', 'Protozoa'], 'correct' => 1],
        ['text' => 'Gram staining is used to classify which type of microorganism?', 'options' => ['Viruses', 'Bacteria', 'Fungi', 'Algae'], 'correct' => 1],
        ['text' => 'What is the smallest unit capable of independent reproduction, generally considered non-living?', 'options' => ['Bacterium', 'Virus', 'Fungus', 'Protozoan'], 'correct' => 1],
        ['text' => 'Which process do bacteria commonly use to reproduce?', 'options' => ['Binary fission', 'Meiosis', 'Mitosis only', 'Budding only'], 'correct' => 0],
        ['text' => 'Antibiotics are effective against which type of pathogen?', 'options' => ['Viruses', 'Bacteria', 'Prions', 'All of the above'], 'correct' => 1],
    ],
    'bch' => [
        ['text' => 'Which biomolecule is the primary source of quick energy for cells?', 'options' => ['Protein', 'Carbohydrate', 'Vitamin', 'Mineral'], 'correct' => 1],
        ['text' => 'Enzymes are primarily made of which biomolecule?', 'options' => ['Lipids', 'Proteins', 'Carbohydrates', 'Nucleic acids'], 'correct' => 1],
        ['text' => 'DNA is composed of repeating units called?', 'options' => ['Amino acids', 'Nucleotides', 'Fatty acids', 'Monosaccharides'], 'correct' => 1],
        ['text' => 'Which organelle is responsible for producing most of a cell\'s ATP?', 'options' => ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], 'correct' => 1],
        ['text' => 'What is the end product of glycolysis?', 'options' => ['Glucose', 'Pyruvate', 'Lactose', 'Glycogen'], 'correct' => 1],
    ],
    'chm' => [
        ['text' => 'What is the chemical formula for water?', 'options' => ['HO2', 'H2O', 'OH2', 'H2O2'], 'correct' => 1],
        ['text' => 'Which of these is a noble gas?', 'options' => ['Oxygen', 'Nitrogen', 'Argon', 'Hydrogen'], 'correct' => 2],
        ['text' => 'What is the pH value of a neutral solution?', 'options' => ['0', '7', '14', '10'], 'correct' => 1],
        ['text' => 'Which subatomic particle has a negative charge?', 'options' => ['Proton', 'Neutron', 'Electron', 'Nucleus'], 'correct' => 2],
        ['text' => 'Which type of bond involves the sharing of electron pairs between atoms?', 'options' => ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Hydrogen bond'], 'correct' => 1],
    ],
    'phy' => [
        ['text' => 'What is the SI unit of force?', 'options' => ['Joule', 'Newton', 'Watt', 'Pascal'], 'correct' => 1],
        ['text' => "According to Newton's First Law, an object at rest stays at rest unless acted upon by a:", 'options' => ['Mass', 'Net external force', 'Friction only', 'Gravity only'], 'correct' => 1],
        ['text' => 'What is the approximate speed of light in a vacuum?', 'options' => ['3 x 10^5 m/s', '3 x 10^8 m/s', '3 x 10^6 m/s', '3 x 10^3 m/s'], 'correct' => 1],
        ['text' => 'Which of these quantities is a vector?', 'options' => ['Speed', 'Distance', 'Velocity', 'Mass'], 'correct' => 2],
        ['text' => 'What form of energy is stored in a stretched rubber band?', 'options' => ['Kinetic energy', 'Potential energy', 'Thermal energy', 'Electrical energy'], 'correct' => 1],
    ],
    'mth' => [
        ['text' => 'What is the derivative of x^2 with respect to x?', 'options' => ['x', '2x', 'x^2', '2'], 'correct' => 1],
        ['text' => 'Solve for x: 2x + 6 = 14', 'options' => ['4', '6', '8', '10'], 'correct' => 0],
        ['text' => 'What is the value of pi rounded to two decimal places?', 'options' => ['3.14', '3.41', '3.12', '3.16'], 'correct' => 0],
        ['text' => 'Which of the following is a prime number?', 'options' => ['21', '27', '29', '33'], 'correct' => 2],
        ['text' => 'What is the sum of the interior angles of a triangle?', 'options' => ['90 degrees', '180 degrees', '270 degrees', '360 degrees'], 'correct' => 1],
    ],
    'sta' => [
        ['text' => 'What is the mean of the numbers 2, 4, 6, 8?', 'options' => ['4', '5', '6', '8'], 'correct' => 1],
        ['text' => 'Which measure of central tendency is most affected by outliers?', 'options' => ['Mean', 'Median', 'Mode', 'Range'], 'correct' => 0],
        ['text' => 'What does standard deviation measure?', 'options' => ['Central tendency', 'Spread/variability of data', 'Sample size', 'Correlation'], 'correct' => 1],
        ['text' => 'A p-value less than 0.05 typically indicates?', 'options' => ['No significance', 'Statistical significance', 'An error', 'Nothing'], 'correct' => 1],
        ['text' => "Which type of data is 'gender' an example of?", 'options' => ['Continuous', 'Categorical', 'Numerical', 'Ratio'], 'correct' => 1],
    ],
    'edf' => [
        ['text' => 'Who is closely associated with the constructivist theory of learning?', 'options' => ['B.F. Skinner', 'Jean Piaget', 'Ivan Pavlov', 'Sigmund Freud'], 'correct' => 1],
        ['text' => 'Which domain of learning deals with attitudes and values?', 'options' => ['Cognitive', 'Affective', 'Psychomotor', 'Behavioural'], 'correct' => 1],
        ['text' => 'What does "curriculum" refer to in education?', 'options' => ['A single textbook', "The planned learning experiences of a school", 'A classroom building', "A teacher's salary"], 'correct' => 1],
        ['text' => 'Formative assessment is primarily used to:', 'options' => ['Assign final grades', 'Monitor and improve learning during instruction', 'Rank students', 'Replace summative assessment'], 'correct' => 1],
        ['text' => 'Which teaching method actively involves students in discussion and problem solving?', 'options' => ['Lecture method', 'Rote memorization', 'Learner-centred method', 'Silent reading only'], 'correct' => 2],
    ],
    'cyb' => [
        ['text' => "What does 'phishing' refer to in cybersecurity?", 'options' => ['A firewall configuration', 'A fraudulent attempt to obtain sensitive information', 'A type of encryption', 'A network protocol'], 'correct' => 1],
        ['text' => 'Which of these makes the strongest password?', 'options' => ['password123', 'Fulokoja2026!', '12345678', 'qwerty'], 'correct' => 1],
        ['text' => 'What does VPN stand for?', 'options' => ['Virtual Private Network', 'Verified Public Network', 'Virtual Protocol Node', 'Virtual Personal Network'], 'correct' => 0],
        ['text' => 'What is malware?', 'options' => ['Legitimate software', 'Malicious software designed to harm systems', 'A hardware component', 'A network cable'], 'correct' => 1],
        ['text' => 'Two-factor authentication adds security by requiring:', 'options' => ['Only a password', 'A password and a second verification method', 'Only a username', 'Nothing extra'], 'correct' => 1],
    ],
    'ift' => [
        ['text' => "What does 'IP' stand for in IP address?", 'options' => ['Internet Protocol', 'Internal Process', 'Information Packet', 'Internet Provider'], 'correct' => 0],
        ['text' => 'Which of these is an operating system?', 'options' => ['Microsoft Word', 'Windows', 'Google Chrome', 'Excel'], 'correct' => 1],
        ['text' => "What does 'RAM' stand for?", 'options' => ['Random Access Memory', 'Read Access Memory', 'Rapid Application Module', 'Random Application Memory'], 'correct' => 0],
        ['text' => 'Which device connects multiple networks together?', 'options' => ['Mouse', 'Router', 'Monitor', 'Keyboard'], 'correct' => 1],
        ['text' => 'What is cloud computing?', 'options' => ['Weather prediction software', 'Delivery of computing services over the internet', 'A type of printer', 'Local hard drive storage'], 'correct' => 1],
    ],
    'sen' => [
        ['text' => 'What does SDLC stand for?', 'options' => ['Software Development Life Cycle', 'System Design Logic Chart', 'Software Design Language Code', 'System Development Logical Cycle'], 'correct' => 0],
        ['text' => 'Which of these is a version control system?', 'options' => ['Git', 'Excel', 'Photoshop', 'PowerPoint'], 'correct' => 0],
        ['text' => 'What is the purpose of unit testing?', 'options' => ['To test the entire system at once', 'To test individual components in isolation', 'To design the user interface', 'To manage project budget'], 'correct' => 1],
        ['text' => 'Which methodology emphasises iterative development and collaboration?', 'options' => ['Waterfall', 'Agile', 'Big Bang', 'None of the above'], 'correct' => 1],
        ['text' => 'What does API stand for?', 'options' => ['Application Programming Interface', 'Advanced Programming Instruction', 'Application Process Integration', 'Automated Program Interface'], 'correct' => 0],
    ],
];

$questionbanks['sed'] = $questionbanks['edf']; // Science Education reuses the Education pool.

$questionids = [];
foreach ($questionbanks as $deptcode => $questions) {
    $subjectname = strtoupper($deptcode) . ' Question Bank';
    $questionids[$deptcode] = fulokoja_get_or_create_question_bank($subjectname, $questions);
}
mtrace('');
mtrace('=== Question banks ===');
mtrace('Created/verified question banks for: ' . implode(', ', array_keys($questionbanks)));

// ---------------------------------------------------------------------------------------
// 4. Courses - one full 8-week course per department
// ---------------------------------------------------------------------------------------

$coursedefs = [
    'csc' => ['code' => 'CSC101', 'title' => 'Introduction to Computer Science'],
    'cyb' => ['code' => 'CYB101', 'title' => 'Introduction to Cybersecurity'],
    'ift' => ['code' => 'IFT101', 'title' => 'Introduction to Information Technology'],
    'sen' => ['code' => 'SEN101', 'title' => 'Introduction to Software Engineering'],
    'bio' => ['code' => 'BIO101', 'title' => 'Introduction to Anatomy and Physiology'],
    'mcb' => ['code' => 'MCB101', 'title' => 'Introduction to Microbiology'],
    'bch' => ['code' => 'BCH101', 'title' => 'Introduction to Biochemistry'],
    'chm' => ['code' => 'CHM101', 'title' => 'Introductory Chemistry'],
    'phy' => ['code' => 'PHY101', 'title' => 'General Physics I'],
    'mth' => ['code' => 'MTH101', 'title' => 'General Mathematics I'],
    'sta' => ['code' => 'STA101', 'title' => 'Introduction to Statistics'],
    'edf' => ['code' => 'EDU101', 'title' => 'Foundations of Education'],
    'sed' => ['code' => 'SED101', 'title' => 'Introduction to Science Education'],
];

$now = time();
$termstart = strtotime('2026-08-24');

mtrace('');
mtrace('=== Building 8-week courses ===');
foreach ($coursedefs as $deptcode => $def) {
    $course = fulokoja_get_or_create_course(
        $def['code'],
        $def['code'] . ' - ' . $def['title'],
        $deptcats[$deptcode]->id,
        $def['title'] . ' (' . strtoupper($deptcode) . ').'
    );
    course_create_sections_if_missing($course->id, range(1, 8));

    $lecturers = $instructorsbydept[$deptcode];
    $leadlecturer = $lecturers[0];
    foreach ($lecturers as $lecturer) {
        fulokoja_enrol_as($course, $lecturer, 'editingteacher');
    }
    $students = $studentsbydept[$deptcode];
    foreach ($students as $student) {
        fulokoja_enrol_as($course, $student, 'student');
    }

    $bank = $questionids[$deptcode];

    for ($week = 1; $week <= 8; $week++) {
        course_update_section($course, get_fast_modinfo($course)->get_section_info($week), ['name' => 'Week ' . $week]);

        $weekstart = $termstart + (($week - 1) * WEEKSECS);
        $duedate = $weekstart + (6 * DAYSECS) + (23 * HOURSECS) + (59 * MINSECS);

        fulokoja_add_page(
            $course, $week, "Week $week Overview",
            "<p>This week covers Topic $week of {$def['title']}. Review the content below, complete the practice questions, and submit the weekly assignment by the due date.</p>"
        );
        fulokoja_add_page(
            $course, $week, "Week $week Content and Reading Guide",
            "<p>Reading material and lecture notes for Week $week of {$def['title']} go here.</p>"
        );

        $assign = fulokoja_add_assignment(
            $course, $week, "Week $week Assignment",
            "Complete the Week $week exercise for {$def['title']} and submit as a single PDF.",
            $duedate
        );

        // Two practice questions from the bank, rotated by week.
        $practiceids = [
            $bank[($week - 1) % count($bank)],
            $bank[$week % count($bank)],
        ];
        fulokoja_add_quiz(
            $course, $week, "Week $week Practice Questions",
            'Ungraded practice - attempt as many times as you like before the assignment deadline.',
            array_unique($practiceids),
            ['attempts' => 0]
        );

        // Simulate submissions/grades for weeks already in the past relative to "today".
        if ($duedate < $now) {
            foreach ($students as $student) {
                $grade = 65 + (($student->id + $week) % 31); // varied but plausible 65-95 range
                fulokoja_simulate_grade($assign, $student, $leadlecturer, (float) $grade);
            }
        }

        if ($week === 4) {
            fulokoja_add_quiz(
                $course, $week, 'Section Exam 1',
                'Timed, proctored assessment. <strong>Requires Respondus LockDown Browser + Webcam.</strong> '
                    . '(Note: LockDown Browser enforcement requires a separate Respondus subscription - see docs/demo-accounts.md.)',
                $bank,
                ['timelimit' => 45 * 60, 'attempts' => 1]
            );
        }
        if ($week === 8) {
            fulokoja_add_quiz(
                $course, $week, 'Final Exam',
                'Timed, proctored assessment. <strong>Requires Respondus LockDown Browser + Webcam.</strong> '
                    . '(Note: LockDown Browser enforcement requires a separate Respondus subscription - see docs/demo-accounts.md.)',
                $bank,
                ['timelimit' => 90 * 60, 'attempts' => 1]
            );
        }
    }

    mtrace(" - {$def['code']}: {$def['title']} (" . count($students) . ' students, ' . count($lecturers) . ' lecturers)');
}

mtrace('');
mtrace('=== Discussion forum demo ===');
$csc101 = $DB->get_record('course', ['shortname' => 'CSC101'], '*', MUST_EXIST);
if (!$DB->record_exists('forum', ['course' => $csc101->id, 'type' => 'general'])) {
    $moduleinfo = new stdClass();
    $moduleinfo->modulename = 'forum';
    $moduleinfo->course = $csc101->id;
    $moduleinfo->section = 1;
    $moduleinfo->visible = 1;
    $moduleinfo->name = 'Class Discussion';
    $moduleinfo->introeditor = ['text' => 'Ask questions and discuss the course content with your classmates here.', 'format' => FORMAT_HTML, 'itemid' => 0];
    $moduleinfo->showdescription = 1;
    $moduleinfo->type = 'general';
    $moduleinfo->forcesubscribe = 0;
    $moduleinfo->trackingtype = 1;
    $moduleinfo->maxbytes = 0;
    $moduleinfo->maxattachments = 1;
    $moduleinfo->assessed = 0;
    $moduleinfo->assessed_type = 0;
    $moduleinfo->scale = 0;
    $moduleinfo->completion = 0;
    $moduleinfo->groupmode = 0;
    $moduleinfo->groupingid = 0;
    $created = create_module($moduleinfo);

    $discussion = new stdClass();
    $discussion->course = $csc101->id;
    $discussion->forum = $created->instance;
    $discussion->name = 'Struggling with Week 1 concepts?';
    $discussion->assessed = 0;
    $discussion->userid = $studentsbydept['csc'][0]->id;
    $discussion->message = 'Does anyone have tips for understanding the material from this week? Would love to compare notes before the assignment is due.';
    $discussion->messageformat = FORMAT_HTML;
    $discussion->messagetrust = 0;
    $discussion->mailnow = 0;
    forum_add_discussion($discussion, null, null, $studentsbydept['csc'][0]->id);
    mtrace('Added a general Class Discussion forum with a starter thread to CSC101.');
} else {
    mtrace('Class Discussion forum already present.');
}

mtrace('');
mtrace('All done.');

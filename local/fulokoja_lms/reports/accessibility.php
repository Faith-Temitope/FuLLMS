<?php
require(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/accessiblematerial/lib.php');

require_login();
$context = context_system::instance();
require_capability('mod/accessiblematerial:viewreports', $context);

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/fulokoja_lms/reports/accessibility.php'));
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('accessibilityreport', 'local_fulokoja_lms'));
$PAGE->set_heading(get_string('accessibilityreport', 'local_fulokoja_lms'));

global $DB;

// FR10: usage report - material upload counts and accessibility compliance rates.
$totals = $DB->get_records_sql(
    "SELECT accessibilitystatus, COUNT(*) AS total
       FROM {accessiblematerial}
   GROUP BY accessibilitystatus"
);
$passed = (int) ($totals[ACCESSIBLEMATERIAL_STATUS_PASSED]->total ?? 0);
$flagged = (int) ($totals[ACCESSIBLEMATERIAL_STATUS_FLAGGED]->total ?? 0);
$pending = (int) ($totals[ACCESSIBLEMATERIAL_STATUS_PENDING]->total ?? 0);
$total = $passed + $flagged + $pending;
$compliancerate = $total > 0 ? round(($passed / $total) * 100, 1) : 0;

// Per-course breakdown.
$percourse = $DB->get_records_sql(
    "SELECT c.id, c.shortname, c.fullname,
            COUNT(am.id) AS total,
            SUM(CASE WHEN am.accessibilitystatus = :passed THEN 1 ELSE 0 END) AS passed,
            SUM(CASE WHEN am.accessibilitystatus = :flagged THEN 1 ELSE 0 END) AS flagged
       FROM {accessiblematerial} am
       JOIN {course} c ON c.id = am.course
   GROUP BY c.id, c.shortname, c.fullname
   ORDER BY c.shortname",
    ['passed' => ACCESSIBLEMATERIAL_STATUS_PASSED, 'flagged' => ACCESSIBLEMATERIAL_STATUS_FLAGGED]
);

// Flagged items needing lecturer correction, with a direct link to fix each one.
$flagreasoncase = "CASE WHEN am.filetype = 'video' THEN :reasonvideo ELSE :reasonalt END";
$flaggeditems = $DB->get_records_sql(
    "SELECT am.id, am.name, am.filetype, c.shortname AS courseshortname, cm.id AS cmid,
            $flagreasoncase AS reason
       FROM {accessiblematerial} am
       JOIN {course} c ON c.id = am.course
       JOIN {modules} m ON m.name = 'accessiblematerial'
       JOIN {course_modules} cm ON cm.module = m.id AND cm.instance = am.id
      WHERE am.accessibilitystatus = :flagged
   ORDER BY c.shortname, am.name",
    [
        'flagged' => ACCESSIBLEMATERIAL_STATUS_FLAGGED,
        'reasonvideo' => get_string('flagreasonshortvideo', 'local_fulokoja_lms'),
        'reasonalt' => get_string('flagreasonshortalt', 'local_fulokoja_lms'),
    ]
);

// General usage report (FR10): material upload counts per course.
$uploadsbycourse = $DB->get_records_sql(
    "SELECT c.shortname, COUNT(am.id) AS uploadcount
       FROM {accessiblematerial} am
       JOIN {course} c ON c.id = am.course
   GROUP BY c.shortname
   ORDER BY uploadcount DESC"
);

echo $OUTPUT->header();
?>
<style>
.fulokoja-report-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 20px 0; }
.fulokoja-report-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; text-align: center; }
.fulokoja-report-number { font-size: 2rem; font-weight: 700; }
.fulokoja-report-card.passed .fulokoja-report-number { color: #1b7a3d; }
.fulokoja-report-card.flagged .fulokoja-report-number { color: #b8860b; }
.fulokoja-report-card.rate .fulokoja-report-number { color: #01351e; }
</style>

<div class="fulokoja-report-cards">
    <div class="fulokoja-report-card rate">
        <div class="fulokoja-report-number"><?php echo $compliancerate; ?>%</div>
        <div><?php echo get_string('compliancerate', 'local_fulokoja_lms'); ?></div>
    </div>
    <div class="fulokoja-report-card">
        <div class="fulokoja-report-number"><?php echo $total; ?></div>
        <div><?php echo get_string('totalmaterials', 'local_fulokoja_lms'); ?></div>
    </div>
    <div class="fulokoja-report-card passed">
        <div class="fulokoja-report-number"><?php echo $passed; ?></div>
        <div><?php echo get_string('status_passed', 'mod_accessiblematerial'); ?></div>
    </div>
    <div class="fulokoja-report-card flagged">
        <div class="fulokoja-report-number"><?php echo $flagged; ?></div>
        <div><?php echo get_string('status_flagged', 'mod_accessiblematerial'); ?></div>
    </div>
</div>

<h3><?php echo get_string('compliancebycourse', 'local_fulokoja_lms'); ?></h3>
<?php
$table = new html_table();
$table->head = [
    get_string('course'),
    get_string('totalmaterials', 'local_fulokoja_lms'),
    get_string('status_passed', 'mod_accessiblematerial'),
    get_string('status_flagged', 'mod_accessiblematerial'),
    get_string('compliancerate', 'local_fulokoja_lms'),
];
foreach ($percourse as $row) {
    $rate = $row->total > 0 ? round(($row->passed / $row->total) * 100, 1) : 0;
    $table->data[] = [
        format_string($row->shortname),
        $row->total,
        $row->passed,
        $row->flagged,
        $rate . '%',
    ];
}
if (empty($percourse)) {
    echo html_writer::tag('p', get_string('nomaterialsyet', 'local_fulokoja_lms'));
} else {
    echo html_writer::table($table);
}
?>

<h3><?php echo get_string('flaggeditems', 'local_fulokoja_lms'); ?></h3>
<?php
if (empty($flaggeditems)) {
    echo html_writer::tag('p', get_string('noflaggeditems', 'local_fulokoja_lms'));
} else {
    $flagtable = new html_table();
    $flagtable->head = [get_string('course'), get_string('materialtitle', 'mod_accessiblematerial'), get_string('reason', 'local_fulokoja_lms'), ''];
    foreach ($flaggeditems as $item) {
        $editurl = new moodle_url('/course/modedit.php', ['update' => $item->cmid, 'return' => 1]);
        $flagtable->data[] = [
            format_string($item->courseshortname),
            format_string($item->name),
            $item->reason,
            html_writer::link($editurl, get_string('fixit', 'local_fulokoja_lms'), ['class' => 'btn btn-sm btn-warning']),
        ];
    }
    echo html_writer::table($flagtable);
}
?>

<h3><?php echo get_string('uploadsbycourse', 'local_fulokoja_lms'); ?></h3>
<?php
$uploadtable = new html_table();
$uploadtable->head = [get_string('course'), get_string('uploadcount', 'local_fulokoja_lms')];
foreach ($uploadsbycourse as $row) {
    $uploadtable->data[] = [format_string($row->shortname), $row->uploadcount];
}
if (empty($uploadsbycourse)) {
    echo html_writer::tag('p', get_string('nomaterialsyet', 'local_fulokoja_lms'));
} else {
    echo html_writer::table($uploadtable);
}

echo $OUTPUT->footer();

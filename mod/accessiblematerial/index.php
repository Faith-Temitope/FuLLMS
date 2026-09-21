<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/accessiblematerial/lib.php');

$id = required_param('id', PARAM_INT);

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_course_login($course, true);
$PAGE->set_pagelayout('incourse');

$context = context_course::instance($course->id);
$event = \mod_accessiblematerial\event\course_module_instance_list_viewed::create(['context' => $context]);
$event->add_record_snapshot('course', $course);
$event->trigger();

$strplural = get_string('modulenameplural', 'mod_accessiblematerial');

$PAGE->set_url('/mod/accessiblematerial/index.php', ['id' => $course->id]);
$PAGE->set_title($course->shortname . ': ' . $strplural);
$PAGE->set_heading($course->fullname);
$PAGE->navbar->add($strplural);
echo $OUTPUT->header();
echo $OUTPUT->heading($strplural);

if (!$materials = get_all_instances_in_course('accessiblematerial', $course)) {
    notice(get_string('thereareno', 'moodle', $strplural), "$CFG->wwwroot/course/view.php?id=$course->id");
    exit;
}

$table = new html_table();
$table->head = [get_string('name'), get_string('materialtype', 'mod_accessiblematerial'), get_string('status', 'mod_accessiblematerial')];
$table->attributes['class'] = 'generaltable mod_index';

$canmanage = has_capability('mod/accessiblematerial:managecompliance', $context);

foreach ($materials as $material) {
    if ($material->accessibilitystatus === ACCESSIBLEMATERIAL_STATUS_FLAGGED && !$canmanage) {
        continue;
    }
    $statusstring = get_string('status_' . $material->accessibilitystatus, 'mod_accessiblematerial');
    $badgeclass = $material->accessibilitystatus === ACCESSIBLEMATERIAL_STATUS_PASSED ? 'badge-success'
        : ($material->accessibilitystatus === ACCESSIBLEMATERIAL_STATUS_FLAGGED ? 'badge-warning' : 'badge-secondary');

    $table->data[] = [
        html_writer::link(new moodle_url('/mod/accessiblematerial/view.php', ['id' => $material->coursemodule]),
            format_string($material->name)),
        get_string('filetype_' . $material->filetype, 'mod_accessiblematerial'),
        html_writer::span($statusstring, 'badge ' . $badgeclass),
    ];
}

echo html_writer::table($table);

echo $OUTPUT->footer();

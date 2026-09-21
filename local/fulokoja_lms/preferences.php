<?php
require(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/local/fulokoja_lms/classes/accessibility_prefs.php');
require_once($CFG->dirroot . '/local/fulokoja_lms/classes/form/preferences_form.php');

require_login();
if (isguestuser()) {
    throw new \moodle_exception('noguest');
}

$context = context_user::instance($USER->id);
$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/fulokoja_lms/preferences.php'));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('accessibilitysettings', 'local_fulokoja_lms'));
$PAGE->set_heading(get_string('accessibilitysettings', 'local_fulokoja_lms'));

$current = \local_fulokoja_lms\accessibility_prefs::get_for_user($USER->id);

$mform = new \local_fulokoja_lms\form\preferences_form();
$mform->set_data($current);

if ($mform->is_cancelled()) {
    redirect(new moodle_url('/my/'));
} else if ($data = $mform->get_data()) {
    \local_fulokoja_lms\accessibility_prefs::save_for_user($USER->id, $data);
    redirect(
        new moodle_url('/local/fulokoja_lms/preferences.php'),
        get_string('preferencessaved', 'local_fulokoja_lms'),
        null,
        \core\output\notification::NOTIFY_SUCCESS
    );
}

echo $OUTPUT->header();
echo $OUTPUT->box_start('generalbox', 'fulokoja-a11y-prefs');
echo html_writer::tag('p', get_string('accessibilitysettings_intro', 'local_fulokoja_lms'));
$mform->display();
echo $OUTPUT->box_end();
echo $OUTPUT->footer();

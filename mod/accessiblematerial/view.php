<?php
require('../../config.php');
require_once($CFG->dirroot . '/mod/accessiblematerial/lib.php');
require_once($CFG->libdir . '/completionlib.php');

$id = optional_param('id', 0, PARAM_INT);
$a = optional_param('a', 0, PARAM_INT);

if ($a) {
    $material = $DB->get_record('accessiblematerial', ['id' => $a], '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('accessiblematerial', $material->id, $material->course, false, MUST_EXIST);
} else {
    $cm = get_coursemodule_from_id('accessiblematerial', $id, 0, false, MUST_EXIST);
    $material = $DB->get_record('accessiblematerial', ['id' => $cm->instance], '*', MUST_EXIST);
}

$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);

require_course_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/accessiblematerial:view', $context);

$event = \mod_accessiblematerial\event\course_module_viewed::create([
    'objectid' => $material->id,
    'context' => $context,
]);
$event->add_record_snapshot('course_modules', $cm);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('accessiblematerial', $material);
$event->trigger();

$completion = new completion_info($course);
$completion->set_module_viewed($cm);

$PAGE->set_url('/mod/accessiblematerial/view.php', ['id' => $cm->id]);
$PAGE->add_body_class('limitedwidth');
$PAGE->set_title($course->shortname . ': ' . $material->name);
$PAGE->set_heading($course->fullname);
$PAGE->set_activity_record($material);

echo $OUTPUT->header();

$canmanage = has_capability('mod/accessiblematerial:managecompliance', $context);
$flagged = ($material->accessibilitystatus === ACCESSIBLEMATERIAL_STATUS_FLAGGED);

if ($material->intro) {
    echo $OUTPUT->box(format_module_intro('accessiblematerial', $material, $cm->id), 'generalbox mod_introbox', 'accessiblematerialintro');
}

if ($flagged) {
    if ($canmanage) {
        $reason = $material->filetype === 'video'
            ? get_string('flagreasonvideo', 'mod_accessiblematerial')
            : get_string('flagreasonalttext', 'mod_accessiblematerial');
        echo $OUTPUT->notification(get_string('flaggedteachernotice', 'mod_accessiblematerial', $reason), 'warning');
        echo html_writer::link(
            new moodle_url('/course/modedit.php', ['update' => $cm->id, 'return' => 1]),
            get_string('editsettings'),
            ['class' => 'btn btn-secondary']
        );
    } else {
        echo $OUTPUT->notification(get_string('flaggedstudentnotice', 'mod_accessiblematerial'), 'info');
    }
    echo $OUTPUT->footer();
    exit;
}

$mainfile = accessiblematerial_get_main_file($context->id, 'content');
$captionfile = accessiblematerial_get_main_file($context->id, 'captions');

if ($mainfile) {
    $fileurl = moodle_url::make_pluginfile_url(
        $context->id, 'mod_accessiblematerial', 'content', 0, $mainfile->get_filepath(), $mainfile->get_filename()
    );

    if ($material->filetype === 'image') {
        echo html_writer::empty_tag('img', [
            'src' => $fileurl->out(),
            'alt' => format_string($material->alttext),
            'class' => 'img-fluid',
        ]);
        echo html_writer::div(get_string('alttextlabel', 'mod_accessiblematerial') . ': ' . format_string($material->alttext),
            'text-muted mt-2');
    } else if ($material->filetype === 'video') {
        $captionsattr = '';
        if ($captionfile) {
            $captionurl = moodle_url::make_pluginfile_url(
                $context->id, 'mod_accessiblematerial', 'captions', 0, $captionfile->get_filepath(), $captionfile->get_filename()
            );
            $captionsattr = html_writer::empty_tag('track', [
                'kind' => 'captions',
                'src' => $captionurl->out(),
                'srclang' => 'en',
                'label' => get_string('captionfile', 'mod_accessiblematerial'),
                'default' => 'default',
            ]);
        }
        echo html_writer::tag('video', $captionsattr, [
            'src' => $fileurl->out(),
            'controls' => 'controls',
            'style' => 'max-width:100%;',
        ]);
    } else {
        echo html_writer::link($fileurl, get_string('downloadmaterial', 'mod_accessiblematerial', $mainfile->get_filename()),
            ['class' => 'btn btn-primary']);
    }
} else {
    echo $OUTPUT->notification(get_string('nofile', 'mod_accessiblematerial'), 'error');
}

echo $OUTPUT->footer();

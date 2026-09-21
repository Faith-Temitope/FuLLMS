<?php
defined('MOODLE_INTERNAL') || die();

define('ACCESSIBLEMATERIAL_STATUS_PENDING', 'pending');
define('ACCESSIBLEMATERIAL_STATUS_PASSED', 'passed');
define('ACCESSIBLEMATERIAL_STATUS_FLAGGED', 'flagged');

/**
 * List of features supported by this module.
 *
 * @param string $feature FEATURE_xx constant
 * @return mixed
 */
function accessiblematerial_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_ARCHETYPE:
            return MOD_ARCHETYPE_RESOURCE;
        case FEATURE_GROUPS:
            return false;
        case FEATURE_GROUPINGS:
            return false;
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return false;
        case FEATURE_BACKUP_MOODLE2:
            return false;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_MOD_PURPOSE:
            return MOD_PURPOSE_CONTENT;
        default:
            return null;
    }
}

/**
 * Works out which of the file-type buckets from Table 3.2 an uploaded file falls into.
 *
 * @param string $filename
 * @return string one of 'video', 'image', 'document', 'text', 'other'
 */
function accessiblematerial_classify_filetype(string $filename): string {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    $video = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
    $image = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $document = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'];
    $text = ['txt', 'md'];

    if (in_array($ext, $video, true)) {
        return 'video';
    }
    if (in_array($ext, $image, true)) {
        return 'image';
    }
    if (in_array($ext, $document, true)) {
        return 'document';
    }
    if (in_array($ext, $text, true)) {
        return 'text';
    }
    return 'other';
}

/**
 * Returns the first real (non-directory) stored file in a file area, or null.
 *
 * @param int $contextid
 * @param string $filearea
 * @return stored_file|null
 */
function accessiblematerial_get_main_file(int $contextid, string $filearea): ?stored_file {
    $fs = get_file_storage();
    $files = $fs->get_area_files($contextid, 'mod_accessiblematerial', $filearea, 0, 'itemid, filepath, filename', false);
    foreach ($files as $file) {
        return $file;
    }
    return null;
}

/**
 * Runs the accessibility compliance check described in Section 3.2.4.2 (Figure 3.3) and
 * Section 3.2.7.1 (Algorithm 2) of the project document: identify the file type, check for
 * captions on video or alternative text on images/documents, flag and notify the lecturer if
 * missing, or mark as passed and notify enrolled students.
 *
 * @param stdClass $material the accessiblematerial record (id, course, name, alttext must be set)
 * @param context_module $context
 * @return stdClass the updated record (also persisted to the database)
 */
function accessiblematerial_run_accessibility_check(stdClass $material, context_module $context): stdClass {
    global $DB;

    $mainfile = accessiblematerial_get_main_file($context->id, 'content');
    $filetype = $mainfile ? accessiblematerial_classify_filetype($mainfile->get_filename()) : 'other';

    $hascaptions = 0;
    $hasalttext = 0;
    $status = ACCESSIBLEMATERIAL_STATUS_PASSED;
    $flagreason = '';

    if ($filetype === 'video') {
        $captionfile = accessiblematerial_get_main_file($context->id, 'captions');
        if ($captionfile === null) {
            $status = ACCESSIBLEMATERIAL_STATUS_FLAGGED;
            $flagreason = get_string('flagreasonvideo', 'mod_accessiblematerial');
        } else {
            $hascaptions = 1;
        }
    } else if (in_array($filetype, ['image', 'document', 'other'], true)) {
        $alttext = trim((string) ($material->alttext ?? ''));
        if (core_text::strlen($alttext) < 5) {
            $status = ACCESSIBLEMATERIAL_STATUS_FLAGGED;
            $flagreason = get_string('flagreasonalttext', 'mod_accessiblematerial');
        } else {
            $hasalttext = 1;
        }
    }
    // filetype === 'text' is already accessible in plain-text form: passes directly.

    $material->filetype = $filetype;
    $material->hascaptions = $hascaptions;
    $material->hasalttext = $hasalttext;
    $material->accessibilitystatus = $status;
    $material->timemodified = time();

    $DB->update_record('accessiblematerial', $material);

    if ($status === ACCESSIBLEMATERIAL_STATUS_FLAGGED) {
        accessiblematerial_notify_lecturer($material, $context, $flagreason);
    } else if (empty($material->notifiedstudents)) {
        accessiblematerial_notify_enrolled_students($material, $context);
        $DB->set_field('accessiblematerial', 'notifiedstudents', 1, ['id' => $material->id]);
        $material->notifiedstudents = 1;
    }

    return $material;
}

/**
 * Notifies the lecturer that material was flagged and is not yet published to students.
 */
function accessiblematerial_notify_lecturer(stdClass $material, context_module $context, string $reason): void {
    global $USER;

    \core\notification::add(
        get_string('flaggedteachernotice', 'mod_accessiblematerial', $reason),
        \core\notification::WARNING
    );
}

/**
 * Notifies students enrolled on the course that new accessible material was published.
 */
function accessiblematerial_notify_enrolled_students(stdClass $material, context_module $context): void {
    global $USER, $DB;

    $course = $DB->get_record('course', ['id' => $material->course], 'id, fullname', MUST_EXIST);
    $enrolled = get_enrolled_users($context, 'mod/accessiblematerial:view', 0, 'u.*', null, 0, 0, true);

    foreach ($enrolled as $student) {
        if ($student->id == $USER->id) {
            continue;
        }

        $message = new \core\message\message();
        $message->component = 'mod_accessiblematerial';
        $message->name = 'materialpublished';
        $message->userfrom = $USER;
        $message->userto = $student;
        $message->subject = get_string('notifysubject', 'mod_accessiblematerial', $course->fullname);
        $message->fullmessage = get_string('notifybody', 'mod_accessiblematerial', $material->name);
        $message->fullmessageformat = FORMAT_PLAIN;
        $message->fullmessagehtml = '<p>' . s(get_string('notifybody', 'mod_accessiblematerial', $material->name)) . '</p>';
        $message->smallmessage = get_string('notifysubject', 'mod_accessiblematerial', $course->fullname);
        $message->notification = 1;
        $message->contexturl = (new moodle_url('/mod/accessiblematerial/view.php', ['id' => $context->instanceid]))->out(false);
        $message->contexturlname = $material->name;

        message_send($message);
    }
}

/**
 * Add accessiblematerial instance.
 *
 * @param stdClass $data
 * @param mod_accessiblematerial_mod_form|null $mform
 * @return int new instance id
 */
function accessiblematerial_add_instance(stdClass $data, $mform = null): int {
    global $DB;

    $data->timecreated = time();
    $data->timemodified = time();
    $data->filetype = ACCESSIBLEMATERIAL_STATUS_PENDING;
    $data->accessibilitystatus = ACCESSIBLEMATERIAL_STATUS_PENDING;
    $data->hascaptions = 0;
    $data->hasalttext = 0;
    $data->notifiedstudents = 0;

    $data->id = $DB->insert_record('accessiblematerial', $data);

    $cmid = $data->coursemodule;
    $DB->set_field('course_modules', 'instance', $data->id, ['id' => $cmid]);
    $context = context_module::instance($cmid);

    if (!empty($data->material)) {
        file_save_draft_area_files($data->material, $context->id, 'mod_accessiblematerial', 'content', 0,
            ['subdirs' => 0, 'maxfiles' => 1]);
    }
    if (!empty($data->captionfile)) {
        file_save_draft_area_files($data->captionfile, $context->id, 'mod_accessiblematerial', 'captions', 0,
            ['subdirs' => 0, 'maxfiles' => 1]);
    }

    $material = $DB->get_record('accessiblematerial', ['id' => $data->id], '*', MUST_EXIST);
    accessiblematerial_run_accessibility_check($material, $context);

    return $data->id;
}

/**
 * Update accessiblematerial instance.
 *
 * @param stdClass $data
 * @param mod_accessiblematerial_mod_form $mform
 * @return bool
 */
function accessiblematerial_update_instance(stdClass $data, $mform): bool {
    global $DB;

    $data->timemodified = time();
    $data->id = $data->instance;

    $cmid = $data->coursemodule;
    $context = context_module::instance($cmid);

    file_save_draft_area_files($data->material, $context->id, 'mod_accessiblematerial', 'content', 0,
        ['subdirs' => 0, 'maxfiles' => 1]);
    file_save_draft_area_files($data->captionfile, $context->id, 'mod_accessiblematerial', 'captions', 0,
        ['subdirs' => 0, 'maxfiles' => 1]);

    // Re-uploading material means it needs to go through the compliance check again.
    $data->notifiedstudents = 0;

    $DB->update_record('accessiblematerial', $data);

    $material = $DB->get_record('accessiblematerial', ['id' => $data->id], '*', MUST_EXIST);
    accessiblematerial_run_accessibility_check($material, $context);

    return true;
}

/**
 * Delete accessiblematerial instance.
 *
 * @param int $id
 * @return bool
 */
function accessiblematerial_delete_instance(int $id): bool {
    global $DB;

    if (!$material = $DB->get_record('accessiblematerial', ['id' => $id])) {
        return false;
    }

    $DB->delete_records('accessiblematerial', ['id' => $material->id]);

    return true;
}

/**
 * Adds a status badge next to the activity name on the course page.
 *
 * @param stdClass $coursemodule
 * @return cached_cm_info|null
 */
function accessiblematerial_get_coursemodule_info($coursemodule) {
    global $DB;

    $material = $DB->get_record('accessiblematerial', ['id' => $coursemodule->instance],
        'id, name, intro, introformat, accessibilitystatus');
    if (!$material) {
        return null;
    }

    $info = new cached_cm_info();
    $info->name = $material->name;

    if ($coursemodule->showdescription) {
        $info->content = format_module_intro('accessiblematerial', $material, $coursemodule->id, false);
    }

    return $info;
}

/**
 * File areas browsable/servable by this module.
 */
function accessiblematerial_get_file_areas($course, $cm, $context) {
    return [
        'content' => get_string('filearea_content', 'mod_accessiblematerial'),
        'captions' => get_string('filearea_captions', 'mod_accessiblematerial'),
    ];
}

/**
 * Serves the material and caption files, respecting accessibility compliance status: a student
 * cannot download a flagged (not-yet-compliant) file, matching the "End (not published)" branches
 * of the activity diagram in Figure 3.3.
 */
function accessiblematerial_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    global $DB;

    if ($context->contextlevel != CONTEXT_MODULE) {
        return false;
    }

    require_course_login($course, true, $cm);

    if (!has_capability('mod/accessiblematerial:view', $context)) {
        return false;
    }

    if (!in_array($filearea, ['content', 'captions'], true)) {
        return false;
    }

    $material = $DB->get_record('accessiblematerial', ['id' => $cm->instance], '*', MUST_EXIST);

    $canmanage = has_capability('mod/accessiblematerial:managecompliance', $context);
    if ($material->accessibilitystatus === ACCESSIBLEMATERIAL_STATUS_FLAGGED && !$canmanage) {
        // Flagged material is withheld from everyone except the lecturer/manager who can fix it.
        return false;
    }

    $fs = get_file_storage();
    $relativepath = implode('/', $args);
    $fullpath = "/$context->id/mod_accessiblematerial/$filearea/0/$relativepath";
    $file = $fs->get_file_by_hash(sha1($fullpath));
    if (!$file || $file->is_directory()) {
        return false;
    }

    send_stored_file($file, null, 0, $forcedownload, $options);
}

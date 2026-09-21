<?php
defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');
require_once($CFG->libdir . '/filelib.php');

class mod_accessiblematerial_mod_form extends moodleform_mod {

    public function definition() {
        $mform = $this->_form;

        $mform->addElement('header', 'general', get_string('general', 'form'));

        $mform->addElement('text', 'name', get_string('materialtitle', 'mod_accessiblematerial'), ['size' => '48']);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 200), 'maxlength', 200, 'client');

        $this->standard_intro_elements(get_string('materialdescription', 'mod_accessiblematerial'));

        $mform->addElement('header', 'materialsection', get_string('materialsection', 'mod_accessiblematerial'));
        $mform->setExpanded('materialsection');

        $mform->addElement(
            'filemanager',
            'material',
            get_string('materialfile', 'mod_accessiblematerial'),
            null,
            [
                'subdirs' => 0,
                'maxfiles' => 1,
                'maxbytes' => 200 * 1024 * 1024,
                'accepted_types' => ['.pdf', '.docx', '.doc', '.mp4', '.mov', '.jpg', '.jpeg', '.png', '.txt'],
            ]
        );
        $mform->addHelpButton('material', 'materialfile', 'mod_accessiblematerial');

        $mform->addElement(
            'filemanager',
            'captionfile',
            get_string('captionfile', 'mod_accessiblematerial'),
            null,
            [
                'subdirs' => 0,
                'maxfiles' => 1,
                'maxbytes' => 5 * 1024 * 1024,
                'accepted_types' => ['.vtt', '.srt'],
            ]
        );
        $mform->addHelpButton('captionfile', 'captionfile', 'mod_accessiblematerial');

        $mform->addElement('textarea', 'alttext', get_string('alttext', 'mod_accessiblematerial'), ['rows' => 3, 'cols' => 60]);
        $mform->setType('alttext', PARAM_TEXT);
        $mform->addHelpButton('alttext', 'alttext', 'mod_accessiblematerial');

        $this->standard_coursemodule_elements();

        $this->add_action_buttons();
    }

    public function data_preprocessing(&$defaultvalues) {
        if (!empty($this->current->instance)) {
            $draftitemid = file_get_submitted_draft_itemid('material');
            file_prepare_draft_area($draftitemid, $this->context->id, 'mod_accessiblematerial', 'content', 0,
                ['subdirs' => 0, 'maxfiles' => 1]);
            $defaultvalues['material'] = $draftitemid;

            $captiondraftitemid = file_get_submitted_draft_itemid('captionfile');
            file_prepare_draft_area($captiondraftitemid, $this->context->id, 'mod_accessiblematerial', 'captions', 0,
                ['subdirs' => 0, 'maxfiles' => 1]);
            $defaultvalues['captionfile'] = $captiondraftitemid;
        }
    }

    public function validation($data, $files) {
        global $USER;

        $errors = parent::validation($data, $files);

        $usercontext = context_user::instance($USER->id);
        $fs = get_file_storage();
        $areafiles = $fs->get_area_files($usercontext->id, 'user', 'draft', $data['material'], 'id', false);
        if (empty($areafiles)) {
            $errors['material'] = get_string('required');
        }

        return $errors;
    }
}

<?php
namespace local_fulokoja_lms\form;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/formslib.php');

class preferences_form extends \moodleform {

    public function definition() {
        $mform = $this->_form;

        $mform->addElement('header', 'general', get_string('accessibilitysettings', 'local_fulokoja_lms'));

        $mform->addElement('advcheckbox', 'screenreaderenabled', get_string('screenreadermode', 'local_fulokoja_lms'));
        $mform->addHelpButton('screenreaderenabled', 'screenreadermode', 'local_fulokoja_lms');

        $textsizeoptions = [
            \local_fulokoja_lms\accessibility_prefs::TEXTSIZE_DEFAULT => get_string('textsize_default', 'local_fulokoja_lms'),
            \local_fulokoja_lms\accessibility_prefs::TEXTSIZE_LARGE => get_string('textsize_large', 'local_fulokoja_lms'),
            \local_fulokoja_lms\accessibility_prefs::TEXTSIZE_EXTRALARGE => get_string('textsize_extralarge', 'local_fulokoja_lms'),
        ];
        $mform->addElement('select', 'textsize', get_string('textsize', 'local_fulokoja_lms'), $textsizeoptions);

        $mform->addElement('advcheckbox', 'highcontrast', get_string('highcontrast', 'local_fulokoja_lms'));
        $mform->addHelpButton('highcontrast', 'highcontrast', 'local_fulokoja_lms');

        $mform->addElement('advcheckbox', 'showcaptions', get_string('showcaptions', 'local_fulokoja_lms'));
        $mform->addHelpButton('showcaptions', 'showcaptions', 'local_fulokoja_lms');

        $this->add_action_buttons(false, get_string('savechanges'));
    }
}

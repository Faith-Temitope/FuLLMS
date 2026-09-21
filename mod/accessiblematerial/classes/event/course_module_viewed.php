<?php
namespace mod_accessiblematerial\event;

defined('MOODLE_INTERNAL') || die();

class course_module_viewed extends \core\event\base {

    protected function init() {
        $this->data['crud'] = 'r';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
        $this->data['objecttable'] = 'accessiblematerial';
    }

    public static function get_name() {
        return get_string('eventcoursemoduleviewed', 'mod_accessiblematerial');
    }

    public function get_description() {
        return "The user with id '$this->userid' viewed the accessiblematerial activity with course module id '$this->contextinstanceid'.";
    }

    public function get_url() {
        return new \moodle_url('/mod/accessiblematerial/view.php', ['id' => $this->contextinstanceid]);
    }
}

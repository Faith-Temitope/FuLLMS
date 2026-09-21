<?php
namespace mod_accessiblematerial\privacy;

defined('MOODLE_INTERNAL') || die();

/**
 * The accessiblematerial activity stores no personal data of its own: it only stores the
 * course material itself, which is lecturer-authored course content, not user data.
 */
class provider implements \core_privacy\local\metadata\null_provider {
    public static function get_reason(): string {
        return 'privacy:metadata';
    }
}

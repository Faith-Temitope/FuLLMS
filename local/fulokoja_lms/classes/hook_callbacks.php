<?php
namespace local_fulokoja_lms;

use core\hook\output\before_html_attributes;
use core\hook\output\before_standard_top_of_body_html_generation;

defined('MOODLE_INTERNAL') || die();

/**
 * Applies the current user's saved accessibility preferences (FR6, FR7) to every page.
 */
class hook_callbacks {

    /**
     * Adds the accessibility preference classes to the <html> tag so styles.css can respond.
     */
    public static function before_html_attributes(before_html_attributes $hook): void {
        global $USER;

        if (empty($USER->id) || isguestuser()) {
            return;
        }

        $classes = accessibility_prefs::get_html_classes_for_user($USER->id);
        if (empty($classes)) {
            return;
        }

        $attributes = $hook->get_attributes();
        $existingclass = $attributes['class'] ?? '';
        $hook->add_attribute('class', trim($existingclass . ' ' . implode(' ', $classes)));
    }

    /**
     * Adds a persistent, always-visible "Accessibility settings" link near the top of every
     * page, so the feature is reachable without hunting through menus (relevant to FR6).
     */
    public static function before_standard_top_of_body_html_generation(before_standard_top_of_body_html_generation $hook): void {
        global $USER;

        if (empty($USER->id) || isguestuser()) {
            return;
        }

        $url = new \moodle_url('/local/fulokoja_lms/preferences.php');
        $hook->add_html(
            \html_writer::link(
                $url,
                get_string('accessibilitysettings', 'local_fulokoja_lms'),
                ['class' => 'fulokoja-a11y-quicklink']
            )
        );
    }
}

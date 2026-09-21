<?php
namespace local_fulokoja_lms;

defined('MOODLE_INTERNAL') || die();

/**
 * Reads and writes the per-user AccessibilityPreferences described in Section 3.2.6 of the
 * project report: screen reader mode, text size, high contrast, and whether video captions
 * are shown by default (FR6, FR7).
 */
class accessibility_prefs {

    const TEXTSIZE_DEFAULT = 'default';
    const TEXTSIZE_LARGE = 'large';
    const TEXTSIZE_EXTRALARGE = 'extralarge';

    /**
     * Returns the given user's saved preferences, or sensible defaults if they have none yet.
     */
    public static function get_for_user(int $userid): \stdClass {
        global $DB;

        $record = $DB->get_record('local_fulokoja_a11yprefs', ['userid' => $userid]);
        if ($record) {
            return $record;
        }

        $defaults = new \stdClass();
        $defaults->userid = $userid;
        $defaults->screenreaderenabled = 0;
        $defaults->textsize = self::TEXTSIZE_DEFAULT;
        $defaults->highcontrast = 0;
        $defaults->showcaptions = 1;
        return $defaults;
    }

    /**
     * Saves a user's accessibility preferences (insert or update).
     */
    public static function save_for_user(int $userid, \stdClass $data): void {
        global $DB;

        $record = $DB->get_record('local_fulokoja_a11yprefs', ['userid' => $userid]);

        $tosave = new \stdClass();
        $tosave->userid = $userid;
        $tosave->screenreaderenabled = !empty($data->screenreaderenabled) ? 1 : 0;
        $tosave->textsize = in_array($data->textsize, [self::TEXTSIZE_DEFAULT, self::TEXTSIZE_LARGE, self::TEXTSIZE_EXTRALARGE], true)
            ? $data->textsize : self::TEXTSIZE_DEFAULT;
        $tosave->highcontrast = !empty($data->highcontrast) ? 1 : 0;
        $tosave->showcaptions = !empty($data->showcaptions) ? 1 : 0;
        $tosave->timemodified = time();

        if ($record) {
            $tosave->id = $record->id;
            $DB->update_record('local_fulokoja_a11yprefs', $tosave);
        } else {
            $DB->insert_record('local_fulokoja_a11yprefs', $tosave);
        }
    }

    /**
     * Computes the CSS classes that should be applied to the <html> element for this user's
     * saved preferences, so the site-wide stylesheet (styles.css) can respond to them.
     *
     * @return string[] list of class names
     */
    public static function get_html_classes_for_user(int $userid): array {
        $prefs = self::get_for_user($userid);

        $classes = [];
        if (!empty($prefs->screenreaderenabled)) {
            $classes[] = 'fulokoja-a11y-screenreader';
        }
        if (!empty($prefs->highcontrast)) {
            $classes[] = 'fulokoja-a11y-highcontrast';
        }
        if ($prefs->textsize === self::TEXTSIZE_LARGE) {
            $classes[] = 'fulokoja-a11y-text-large';
        } else if ($prefs->textsize === self::TEXTSIZE_EXTRALARGE) {
            $classes[] = 'fulokoja-a11y-text-extralarge';
        }
        return $classes;
    }
}

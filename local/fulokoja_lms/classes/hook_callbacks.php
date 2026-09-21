<?php
namespace local_fulokoja_lms;

use core\hook\output\before_html_attributes;
use core\hook\output\before_standard_head_html_generation;
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

    /**
     * Adds the PWA manifest, theme colour, and iOS home-screen tags, and registers the
     * service worker, so FUL LMS can be installed as an app on phones and desktops.
     */
    public static function before_standard_head_html_generation(before_standard_head_html_generation $hook): void {
        global $CFG;

        $wwwroot = rtrim($CFG->wwwroot, '/');
        $scope = rtrim(parse_url($wwwroot, PHP_URL_PATH) ?: '', '/') . '/';

        $html = '';
        $html .= \html_writer::empty_tag('link', [
            'rel' => 'manifest',
            'href' => $wwwroot . '/local/fulokoja_lms/pwa/manifest.php',
        ]);
        $html .= \html_writer::empty_tag('meta', ['name' => 'theme-color', 'content' => '#01351e']);
        $html .= \html_writer::empty_tag('link', [
            'rel' => 'apple-touch-icon',
            'href' => $wwwroot . '/local/fulokoja_lms/pwa/apple-touch-icon.png',
        ]);
        $html .= \html_writer::empty_tag('meta', ['name' => 'apple-mobile-web-app-capable', 'content' => 'yes']);
        $html .= \html_writer::empty_tag('meta', ['name' => 'apple-mobile-web-app-title', 'content' => 'FUL LMS']);
        $html .= \html_writer::tag('script', sprintf(
            "if ('serviceWorker' in navigator) { window.addEventListener('load', function() {" .
            " navigator.serviceWorker.register('%s/sw.js', {scope: '%s'}).catch(function(){}); }); }",
            $wwwroot,
            $scope
        ));

        $hook->add_html($html);
    }
}

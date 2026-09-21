<?php
/**
 * Applies FUL branding: site logo, compact logo, favicon (from a supplied crest image),
 * the FUL blue brand colour, and overrides the "Powered by Moodle" footer string with FUL's
 * own. Safe to re-run.
 *
 * Usage: php local/fulokoja_lms/cli/apply_branding.php /path/to/ful-crest.png
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/clilib.php');

global $DB, $CFG;

$admins = get_admins();
\core\session\manager::set_user(reset($admins));

$logopath = $argv[1] ?? null;
if (!$logopath || !is_file($logopath)) {
    cli_error('Usage: php apply_branding.php /path/to/ful-crest.png (file not found)');
}

$syscontext = context_system::instance();
$fs = get_file_storage();

function fulokoja_store_branding_file(file_storage $fs, context $context, string $component, string $filearea, string $sourcepath, string $targetfilename): void {
    $fs->delete_area_files($context->id, $component, $filearea, 0);
    $fs->create_file_from_pathname([
        'contextid' => $context->id,
        'component' => $component,
        'filearea' => $filearea,
        'itemid' => 0,
        'filepath' => '/',
        'filename' => $targetfilename,
    ], $sourcepath);
}

// Site logo and compact logo (shown in the navbar/drawer and various pages).
fulokoja_store_branding_file($fs, $syscontext, 'core_admin', 'logo', $logopath, 'fullogo.png');
set_config('logo', 'fullogo.png', 'core_admin');

fulokoja_store_branding_file($fs, $syscontext, 'core_admin', 'logocompact', $logopath, 'fullogocompact.png');
set_config('logocompact', 'fullogocompact.png', 'core_admin');

// Favicon (browser tab icon).
fulokoja_store_branding_file($fs, $syscontext, 'core_admin', 'favicon', $logopath, 'fulfavicon.png');
set_config('favicon', 'fulfavicon.png', 'core_admin');

// FUL brand blue, sampled from the crest.
set_config('brandcolor', '#4c638f', 'theme_boost');

// Override "Powered by Moodle" in the footer with FUL's own line, via Moodle's supported
// en_local language customisation mechanism (does not touch core lang files, survives
// upgrades). See lib/classes/string_manager_standard.php for how *_local packs are loaded.
$locallangdir = $CFG->dataroot . '/lang/en_local';
if (!is_dir($locallangdir)) {
    mkdir($locallangdir, 02777, true);
}
file_put_contents($locallangdir . '/moodle.php', <<<'PHP'
<?php
defined('MOODLE_INTERNAL') || die();
$string['poweredbymoodle'] = 'FUL LMS - built on the Moodle platform';
PHP
);

purge_all_caches();

echo "Applied FUL branding: logo, compact logo, favicon, brand colour (#4c638f), and footer text.\n";

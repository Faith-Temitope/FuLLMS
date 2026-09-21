<?php  // Moodle configuration file for container/cloud deployment (Railway, Render, etc.)
//
// This is used ONLY inside the Docker image (see Dockerfile) - it is copied to config.php
// at container startup. Local XAMPP development is untouched and keeps using the plain
// config.php in the repository root with its own hardcoded local settings.
//
// All values below are read from environment variables set on the hosting platform, so the
// same image can be deployed anywhere without editing this file. See docs/deployment.md.

unset($CFG);
global $CFG;
$CFG = new stdClass();

function fulokoja_env(string $name, ?string $default = null): ?string {
    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
}

$CFG->dbtype    = 'mysqli';
$CFG->dblibrary = 'native';
$CFG->dbhost    = fulokoja_env('MOODLE_DB_HOST', 'localhost');
$CFG->dbname    = fulokoja_env('MOODLE_DB_NAME', 'moodle');
$CFG->dbuser    = fulokoja_env('MOODLE_DB_USER', 'root');
$CFG->dbpass    = fulokoja_env('MOODLE_DB_PASS', '');
$CFG->prefix    = 'mdl_';
$CFG->dboptions = [
    'dbpersist' => false,
    'dbport' => fulokoja_env('MOODLE_DB_PORT', '3306'),
    'dbsocket' => '',
    'dbcollation' => 'utf8mb4_unicode_ci',
];

$CFG->wwwroot  = fulokoja_env('MOODLE_WWWROOT', 'http://localhost');
$CFG->dataroot = fulokoja_env('MOODLE_DATAROOT', '/var/www/moodledata');
$CFG->admin    = 'admin';

$CFG->directorypermissions = 02777;

// Trust the platform's HTTPS-terminating reverse proxy so Moodle knows requests are secure.
if (fulokoja_env('MOODLE_BEHIND_PROXY', '1') === '1') {
    $CFG->sslproxy = true;
}

require_once(__DIR__ . '/lib/setup.php');

// There is no php closing tag in this file,
// it is intentional because it prevents trailing whitespace problems!

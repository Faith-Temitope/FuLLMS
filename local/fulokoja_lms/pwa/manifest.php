<?php
require(__DIR__ . '/../../../config.php');

header('Content-Type: application/manifest+json');

$wwwroot = rtrim($CFG->wwwroot, '/');
$path = parse_url($wwwroot, PHP_URL_PATH) ?: '';
$scope = ($path ?: '') . '/';

$manifest = [
    'name' => 'FUL LMS',
    'short_name' => 'FUL LMS',
    'description' => 'Federal University Lokoja Integrated Learning Management System',
    'start_url' => $wwwroot . '/my/?pwa=1',
    'scope' => $scope,
    'display' => 'standalone',
    'background_color' => '#01351e',
    'theme_color' => '#01351e',
    'orientation' => 'portrait-primary',
    'icons' => [
        ['src' => $wwwroot . '/local/fulokoja_lms/pwa/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
        ['src' => $wwwroot . '/local/fulokoja_lms/pwa/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
        ['src' => $wwwroot . '/local/fulokoja_lms/pwa/icon-512-maskable.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
    ],
];

echo json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

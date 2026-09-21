<?php
defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook' => \core\hook\output\before_html_attributes::class,
        'callback' => \local_fulokoja_lms\hook_callbacks::class . '::before_html_attributes',
        'priority' => 0,
    ],
    [
        'hook' => \core\hook\output\before_standard_top_of_body_html_generation::class,
        'callback' => \local_fulokoja_lms\hook_callbacks::class . '::before_standard_top_of_body_html_generation',
        'priority' => 0,
    ],
    [
        'hook' => \core\hook\output\before_standard_head_html_generation::class,
        'callback' => \local_fulokoja_lms\hook_callbacks::class . '::before_standard_head_html_generation',
        'priority' => 0,
    ],
];

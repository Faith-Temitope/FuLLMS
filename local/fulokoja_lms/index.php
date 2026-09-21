<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/local/fulokoja_lms/lib.php');

require_login();

$context = context_system::instance();
require_capability('local/fulokoja_lms:view', $context);

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/fulokoja_lms/index.php'));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('title', 'local_fulokoja_lms'));
$PAGE->set_heading(get_string('title', 'local_fulokoja_lms'));

$stats = local_fulokoja_lms_get_dashboard_stats();

$features = [
    get_string('feature1', 'local_fulokoja_lms'),
    get_string('feature2', 'local_fulokoja_lms'),
    get_string('feature3', 'local_fulokoja_lms'),
    get_string('feature4', 'local_fulokoja_lms'),
];

$roles = [
    [
        'title' => get_string('studentview', 'local_fulokoja_lms'),
        'desc' => get_string('studentdesc', 'local_fulokoja_lms'),
    ],
    [
        'title' => get_string('teacherview', 'local_fulokoja_lms'),
        'desc' => get_string('teacherdesc', 'local_fulokoja_lms'),
    ],
    [
        'title' => get_string('adminview', 'local_fulokoja_lms'),
        'desc' => get_string('admindesc', 'local_fulokoja_lms'),
    ],
];

echo $OUTPUT->header();
?>
<style>
    .fulokoja-dashboard {
        max-width: 1200px;
        margin: 0 auto;
    }
    .fulokoja-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin: 24px 0;
    }
    .fulokoja-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .fulokoja-number {
        font-size: 2rem;
        font-weight: 700;
        color: #0b5fff;
        margin-bottom: 8px;
    }
    .fulokoja-role {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
    }
    .fulokoja-role-item {
        background: #f8fafc;
        border-left: 5px solid #0b5fff;
        padding: 16px;
        border-radius: 8px;
    }
    .fulokoja-role-item h4 {
        margin: 0 0 6px 0;
    }
    ul.fulokoja-features {
        margin: 12px 0 0 18px;
    }
    ul.fulokoja-features li {
        margin-bottom: 8px;
    }
</style>

<div class="fulokoja-dashboard">
    <h2><?php echo get_string('overview', 'local_fulokoja_lms'); ?></h2>

    <div class="fulokoja-grid">
        <div class="fulokoja-card">
            <div class="fulokoja-number"><?php echo $stats->users; ?></div>
            <div><?php echo get_string('students', 'local_fulokoja_lms'); ?></div>
        </div>
        <div class="fulokoja-card">
            <div class="fulokoja-number"><?php echo $stats->courses; ?></div>
            <div><?php echo get_string('courses', 'local_fulokoja_lms'); ?></div>
        </div>
        <div class="fulokoja-card">
            <div class="fulokoja-number"><?php echo $stats->assignments; ?></div>
            <div><?php echo get_string('assignments', 'local_fulokoja_lms'); ?></div>
        </div>
        <div class="fulokoja-card">
            <div class="fulokoja-number"><?php echo $stats->activeenrolments; ?></div>
            <div><?php echo get_string('enrolments', 'local_fulokoja_lms'); ?></div>
        </div>
    </div>

    <h3><?php echo get_string('featuretitle', 'local_fulokoja_lms'); ?></h3>
    <ul class="fulokoja-features">
        <?php foreach ($features as $feature) { ?>
            <li><?php echo $feature; ?></li>
        <?php } ?>
    </ul>

    <div class="fulokoja-role">
        <?php foreach ($roles as $role) { ?>
            <div class="fulokoja-role-item">
                <h4><?php echo $role['title']; ?></h4>
                <p><?php echo $role['desc']; ?></p>
            </div>
        <?php } ?>
    </div>
</div>

<?php
echo $OUTPUT->footer();

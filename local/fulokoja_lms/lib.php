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

defined('MOODLE_INTERNAL') || die();

function local_fulokoja_lms_get_dashboard_stats(): stdClass {
    global $DB;

    $stats = new stdClass();
    $stats->users = $DB->count_records_select('user', 'deleted = 0 AND username <> ?', ['guest']);
    $stats->courses = $DB->count_records('course', ['visible' => 1]);
    $stats->assignments = $DB->count_records('assign');
    $stats->activeenrolments = $DB->count_records_sql(
        "SELECT COUNT(DISTINCT ue.userid)
           FROM {user_enrolments} ue
           JOIN {enrol} e ON e.id = ue.enrolid
          WHERE e.status = :active",
        ['active' => ENROL_INSTANCE_ENABLED]
    );

    return $stats;
}

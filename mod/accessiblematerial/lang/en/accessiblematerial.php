<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Accessible Material';
$string['modulename'] = 'Accessible Material';
$string['modulenameplural'] = 'Accessible Materials';
$string['modulename_help'] = 'The Accessible Material activity lets a lecturer upload course material that is automatically checked for accessibility compliance (captions on video, alternative text on images and documents) before it is published to students.';
$string['pluginadministration'] = 'Accessible Material administration';

$string['accessiblematerial:addinstance'] = 'Add a new accessible material activity';
$string['accessiblematerial:view'] = 'View accessible material';
$string['accessiblematerial:managecompliance'] = 'Manage accessibility compliance for material';
$string['accessiblematerial:viewreports'] = 'View accessibility compliance reports';

$string['materialtitle'] = 'Title';
$string['materialdescription'] = 'Description';
$string['materialsection'] = 'Course material';
$string['materialfile'] = 'File';
$string['materialfile_help'] = 'Accepted formats: PDF, DOCX, MP4, MOV, JPG, PNG, TXT. Maximum size 200MB.';
$string['captionfile'] = 'Caption file (required for video)';
$string['captionfile_help'] = 'Upload a .vtt or .srt caption file if the material above is a video. Video without a caption file will be flagged and withheld from students until one is added.';
$string['alttext'] = 'Alternative text (required for images and documents)';
$string['alttext_help'] = 'Describe the content of the image or document in at least 5 characters. This is read aloud by screen readers. Images and documents without alternative text will be flagged and withheld from students.';
$string['alttextlabel'] = 'Alternative text';

$string['filearea_content'] = 'Material file';
$string['filearea_captions'] = 'Caption file';

$string['materialtype'] = 'Type';
$string['status'] = 'Accessibility status';
$string['status_pending'] = 'Pending';
$string['status_passed'] = 'Passed';
$string['status_flagged'] = 'Flagged';
$string['filetype_video'] = 'Video';
$string['filetype_image'] = 'Image';
$string['filetype_document'] = 'Document';
$string['filetype_text'] = 'Plain text';
$string['filetype_other'] = 'Other';
$string['filetype_pending'] = 'Pending';

$string['downloadmaterial'] = 'Download {$a}';
$string['nofile'] = 'No material file has been uploaded for this activity yet.';

$string['flagreasonvideo'] = 'this video has no caption file (.vtt or .srt) attached';
$string['flagreasonalttext'] = 'this material has no alternative text, or the alternative text is shorter than 5 characters';
$string['flaggedteachernotice'] = 'This material was not published to students because {$a}. Edit the activity to add the missing accessibility information, and it will be re-checked and published automatically.';
$string['flaggedstudentnotice'] = 'This material is not yet available. Your lecturer needs to add the required accessibility information before it can be published.';

$string['notifysubject'] = 'New accessible material in {$a}';
$string['notifybody'] = 'New course material "{$a}" has just been published and is ready to view.';

$string['eventcoursemoduleviewed'] = 'Accessible material viewed';

$string['privacy:metadata'] = 'The Accessible Material activity only stores course material and its accessibility status; it does not store personal data about students.';

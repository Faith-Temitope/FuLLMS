#!/bin/bash
# A Railway Volume mounted at /var/www/moodledata overrides whatever ownership the image set
# at build time (RUN chown ... in the Dockerfile only affects the image layer, not a volume
# mounted over it at container start) - it comes up root-owned, which Moodle's PHP process
# (running as www-data) can't write to, causing a 500 on every request. Fix it every start.
set -e

mkdir -p /var/www/moodledata
chown -R www-data:www-data /var/www/moodledata
chmod -R 02777 /var/www/moodledata

echo "03-fix-moodledata-perms.sh: fixed moodledata ownership"

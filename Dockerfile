# Deploys this exact Moodle checkout (core + our custom plugins) to a container host
# (Railway, Render, Fly.io, etc.). Local XAMPP development is untouched by this file.
#
# Base image: MoodleHQ's own PHP+Apache image, purpose-built for running a Moodle codebase
# you bring yourself (it already has every PHP extension Moodle requires configured
# correctly), rather than assembling that from a generic php:apache image by hand.
FROM moodlehq/moodle-php-apache:8.2

WORKDIR /var/www/html

COPY . /var/www/html/

# Use the environment-variable-driven config for cloud deployment instead of the
# hardcoded-localhost config.php used for local XAMPP development.
COPY config.docker.php /var/www/html/config.php

RUN mkdir -p /var/www/moodledata \
    && chown -R www-data:www-data /var/www/moodledata /var/www/html \
    && chmod -R 02777 /var/www/moodledata

# The base image can end up with more than one Apache MPM enabled at once
# ("apache2: Configuration error: More than one MPM loaded"), which is fatal at startup.
# This uses mod_php (not PHP-FPM), which requires the prefork MPM specifically.
RUN a2dismod mpm_event mpm_worker 2>/dev/null; a2enmod mpm_prefork

# NOTE: no Docker VOLUME instruction here - Railway (and most container platforms) rejects
# it, since persistence is configured through their own volume system instead. On Railway:
# service Settings > Volumes > New Volume, mounted at /var/www/moodledata. Without this,
# uploaded files are lost on every redeploy.

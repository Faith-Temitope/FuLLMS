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

# Persisted across deploys/restarts - uploaded files, caches, sessions.
VOLUME ["/var/www/moodledata"]

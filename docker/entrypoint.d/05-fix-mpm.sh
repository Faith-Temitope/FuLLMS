#!/bin/bash
# Forces the prefork MPM (required by mod_php, which this image uses) and removes any other
# MPM that the base image's own setup may have enabled, which otherwise crashes Apache at
# startup with "Configuration error: More than one MPM loaded." Runs from
# /docker-entrypoint.d/, the base image's own hook point for custom startup steps, since a
# build-time `a2dismod`/`a2enmod` alone gets overridden by the base image's later setup.
set -e

a2dismod mpm_event mpm_worker >/dev/null 2>&1 || true
a2enmod mpm_prefork >/dev/null 2>&1 || true

# Belt and braces: if the above didn't take (symlinks recreated some other way), fix the
# symlinks directly.
rm -f /etc/apache2/mods-enabled/mpm_event.load /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_worker.load /etc/apache2/mods-enabled/mpm_worker.conf
ln -sf /etc/apache2/mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load
ln -sf /etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf

echo "05-fix-mpm.sh: forced prefork MPM"

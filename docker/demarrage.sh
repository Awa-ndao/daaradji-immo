#!/bin/sh
# Démarrage du backend sur Render : connexion sécurisée à MySQL, mise en cache, migrations, puis Apache
set -e
cd /var/www/html

# Certificat de la base MySQL en ligne (variable DB_CA_CERT sur Render)
if [ -n "$DB_CA_CERT" ]; then
  printf '%s\n' "$DB_CA_CERT" > /tmp/db-ca.pem
  export MYSQL_ATTR_SSL_CA=/tmp/db-ca.pem
fi

php artisan package:discover --ansi
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Crée ou met à jour les tables (ne supprime aucune donnée)
php artisan migrate --force

chown -R www-data:www-data storage bootstrap/cache
exec apache2-foreground

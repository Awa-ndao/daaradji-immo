# Image de production du backend DAARADJI IMMO (Laravel 12 + Apache), utilisée par Render
FROM php:8.3-apache

# Extensions PHP nécessaires à Laravel et à MySQL
RUN apt-get update \
 && apt-get install -y --no-install-recommends libzip-dev libicu-dev unzip git \
 && docker-php-ext-install pdo_mysql zip intl bcmath opcache \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

# Apache sert le dossier public/ et écoute sur le port donné par Render ($PORT)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
ENV PORT=10000
RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
 && sed -ri 's!Listen 80!Listen ${PORT}!' /etc/apache2/ports.conf \
 && sed -ri 's!<VirtualHost \*:80>!<VirtualHost *:${PORT}>!' /etc/apache2/sites-available/000-default.conf \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

# Dépendances d'abord (mise en cache), puis le code
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --prefer-dist
COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && chown -R www-data:www-data storage bootstrap/cache

COPY docker/demarrage.sh /usr/local/bin/demarrage.sh
RUN sed -i "s/\r$//" /usr/local/bin/demarrage.sh && chmod +x /usr/local/bin/demarrage.sh
CMD ["/usr/local/bin/demarrage.sh"]

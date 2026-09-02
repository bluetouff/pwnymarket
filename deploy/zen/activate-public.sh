#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /etc/letsencrypt/live/CERTIFICATE_NAME" >&2
  exit 2
fi

cert_dir=$(realpath --canonicalize-existing "$1")
case ${cert_dir} in
  /etc/letsencrypt/live/*) ;;
  *) echo "Certificate must be under /etc/letsencrypt/live." >&2; exit 2 ;;
esac
for file in fullchain.pem privkey.pem; do
  [[ -r ${cert_dir}/${file} ]] || { echo "Missing ${file}." >&2; exit 2; }
done
openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkhost pwnymarket.fr >/dev/null
openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkend 604800 >/dev/null
getent ahostsv4 pwnymarket.fr >/dev/null || { echo "DNS for pwnymarket.fr is unavailable." >&2; exit 3; }
systemctl is-active --quiet pwnymarket.service
curl --fail --silent --show-error --unix-socket /run/pwnymarket/pwnymarket.sock http://localhost/healthz >/dev/null

a2enmod headers proxy proxy_http rewrite ssl >/dev/null
escaped_cert_dir=${cert_dir//&/\\&}
sed "s|__CERT_DIR__|${escaped_cert_dir}|g" /var/www/html/pwnymarket/current/deploy/zen/pwnymarket.apache.conf > /etc/apache2/sites-available/pwnymarket.conf.candidate
install -m 0644 -o root -g root /etc/apache2/sites-available/pwnymarket.conf.candidate /etc/apache2/sites-available/pwnymarket.conf
rm -f /etc/apache2/sites-available/pwnymarket.conf.candidate
a2ensite pwnymarket.conf >/dev/null
if ! apache2ctl configtest; then
  a2dissite pwnymarket.conf >/dev/null || true
  exit 4
fi
systemctl reload apache2
if ! curl --fail --silent --show-error --resolve pwnymarket.fr:443:127.0.0.1 https://pwnymarket.fr/healthz >/dev/null; then
  a2dissite pwnymarket.conf >/dev/null || true
  systemctl reload apache2 || true
  echo "HTTPS verification failed; vhost disabled." >&2
  exit 5
fi
echo "PUBLIC_HTTPS_OK"

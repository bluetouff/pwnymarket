#!/usr/bin/env bash
set -euo pipefail
umask 027

[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ $# -eq 1 ]] || { echo "Usage: $0 NODE_BINARY" >&2; exit 2; }
release=/var/www/html/pwnymarket/current
node_binary=$(realpath --canonicalize-existing "$1")
[[ ${node_binary} =~ ^/[A-Za-z0-9_./-]+$ && -x ${node_binary} ]] || exit 2
checked_path=${node_binary}
while true; do
  permissions=$(stat -c %a "${checked_path}")
  if [[ $(stat -c %u "${checked_path}") != 0 ]] || (( (8#${permissions} & 0022) != 0 )); then
    echo "Node and its parents must be root-owned and not group/world writable." >&2
    exit 2
  fi
  [[ ${checked_path} == / ]] && break
  checked_path=$(dirname "${checked_path}")
done
"${node_binary}" "${release}/deploy/zen/check-runtime.mjs"
for binary in /usr/bin/goaccess /usr/bin/htpasswd /usr/sbin/runuser; do
  [[ -x ${binary} ]] || { echo "Missing required package: ${binary}" >&2; exit 2; }
done
grep -Fq 'IncludeOptional /etc/apache2/pwnymarket-stats-vhost.conf' /etc/apache2/sites-enabled/pwnymarket.conf || {
  echo "Activate the current public release before installing statistics." >&2
  exit 2
}

for path in /var/lib/pwnymarket-stats /var/lib/pwnymarket-stats/logs /var/lib/pwnymarket-stats/report /etc/apache2/pwnymarket-stats.htpasswd /etc/apache2/pwnymarket-stats-vhost.conf; do
  [[ ! -L ${path} ]] || { echo "Refusing a symlink in statistics paths." >&2; exit 2; }
done
if ! id pwnystats >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin pwnystats
fi
# The stats account must not join www-data, which can reach the vote socket.
[[ $(id -Gn pwnystats) == pwnystats ]] || { echo "Unexpected stats account groups." >&2; exit 2; }
install -d -m 0711 -o root -g root /var/lib/pwnymarket-stats
install -d -m 0700 -o pwnystats -g pwnystats /var/lib/pwnymarket-stats/logs
install -d -m 2750 -o pwnystats -g www-data /var/lib/pwnymarket-stats/report

if [[ ! -e /etc/apache2/pwnymarket-stats.htpasswd ]]; then
  echo "Create the PRIVATE stats password for user bluetouff. Enter it here, never in chat."
  /usr/bin/htpasswd -cB -C 12 /etc/apache2/pwnymarket-stats.htpasswd bluetouff
fi
[[ -s /etc/apache2/pwnymarket-stats.htpasswd ]] || { echo "Empty authentication file." >&2; exit 2; }
chown root:www-data /etc/apache2/pwnymarket-stats.htpasswd
chmod 0640 /etc/apache2/pwnymarket-stats.htpasswd

backup=$(mktemp -d /etc/apache2/pwnymarket-stats-backup.XXXXXX)
if [[ -f /etc/apache2/pwnymarket-stats-vhost.conf ]]; then
  cp -p /etc/apache2/pwnymarket-stats-vhost.conf "${backup}/vhost.conf"
fi
rollback_config() {
  if [[ -f ${backup}/vhost.conf ]]; then
    install -m 0644 -o root -g root "${backup}/vhost.conf" /etc/apache2/pwnymarket-stats-vhost.conf
  else
    rm -f /etc/apache2/pwnymarket-stats-vhost.conf
  fi
}
sed "s|__NODE_BINARY__|${node_binary}|g" "${release}/deploy/zen/pwnymarket-stats.apache.conf" > "${backup}/candidate.conf"
/usr/sbin/runuser -u pwnystats -- "${node_binary}" "${release}/deploy/zen/generate-stats.mjs"
a2enmod auth_basic authn_file authz_user alias dir setenvif >/dev/null
install -m 0644 -o root -g root "${backup}/candidate.conf" /etc/apache2/pwnymarket-stats-vhost.conf
if ! apache2ctl configtest; then
  rollback_config
  exit 3
fi
if ! systemctl reload apache2; then
  rollback_config
  systemctl reload apache2 || true
  exit 3
fi
if ! status=$(curl --silent --show-error --max-time 10 --resolve pwnymarket.fr:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://pwnymarket.fr/stats/) || [[ ${status} != 401 ]]; then
  rollback_config
  systemctl reload apache2
  echo "Private stats authentication check failed; previous configuration restored." >&2
  exit 4
fi

sed "s|__NODE_BINARY__|${node_binary}|g" "${release}/deploy/zen/pwnymarket-stats.service" > "${backup}/service"
install -m 0644 -o root -g root "${backup}/service" /etc/systemd/system/pwnymarket-stats.service
install -m 0644 -o root -g root "${release}/deploy/zen/pwnymarket-stats.timer" /etc/systemd/system/pwnymarket-stats.timer
systemctl daemon-reload
systemctl enable --now pwnymarket-stats.timer >/dev/null
systemctl start pwnymarket-stats.service
systemctl is-active --quiet pwnymarket-stats.timer
echo "PRIVATE_GOACCESS_OK https://pwnymarket.fr/stats/"

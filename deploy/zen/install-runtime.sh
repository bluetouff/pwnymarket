#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 RELEASE_DIR SOURCE_SHA" >&2
  exit 2
fi

release_dir=$(realpath --canonicalize-existing "$1")
source_sha=$2
if [[ ! ${source_sha} =~ ^[a-f0-9]{40}$ ]]; then
  echo "Invalid source SHA." >&2
  exit 2
fi
if [[ ! -f ${release_dir}/zen/server.mjs || ! -f ${release_dir}/deploy/zen/pwnymarket.service || ! -f ${release_dir}/deploy/zen/pwnymarket-private-files.conf || ! -f ${release_dir}/deploy/zen/check-runtime.mjs ]]; then
  echo "Incomplete release." >&2
  exit 2
fi
if find "${release_dir}" -type l -print -quit | grep -q .; then
  echo "Release symlinks are not allowed." >&2
  exit 2
fi

# Abort before any Apache, systemd, account or filesystem mutation on old Node.
/usr/bin/node "${release_dir}/deploy/zen/check-runtime.mjs"

target=/var/www/html/pwnymarket/releases/${source_sha}
candidate=${target}.candidate
if [[ -e ${target} || -e ${candidate} ]]; then
  echo "Release already exists; refusing to overwrite it." >&2
  exit 3
fi

# Protect the shared document root before copying any application files into it.
guard=/etc/apache2/conf-available/pwnymarket-private-files.conf
guard_enabled=false
if [[ -e /etc/apache2/conf-enabled/pwnymarket-private-files.conf ]]; then
  guard_enabled=true
fi
if [[ -e ${guard} ]] && ! cmp -s "${release_dir}/deploy/zen/pwnymarket-private-files.conf" "${guard}"; then
  echo "An unexpected Apache filesystem guard already exists; refusing to replace it." >&2
  exit 3
fi
install -m 0644 -o root -g root "${release_dir}/deploy/zen/pwnymarket-private-files.conf" "${guard}"
a2enconf pwnymarket-private-files >/dev/null
if ! apache2ctl configtest; then
  if [[ ${guard_enabled} == false ]]; then
    a2disconf pwnymarket-private-files >/dev/null || true
  fi
  exit 4
fi
systemctl reload apache2

if ! id pwnymarket >/dev/null 2>&1; then
  useradd --system --gid www-data --home-dir /nonexistent --shell /usr/sbin/nologin pwnymarket
fi

install -d -m 0755 -o root -g root /var/www/html/pwnymarket/releases
install -d -m 0755 -o root -g root "${candidate}"
cp -a --no-preserve=ownership "${release_dir}/." "${candidate}/"
find "${candidate}" -type d -exec chmod 0755 {} +
find "${candidate}" -type f -exec chmod 0644 {} +
chown -R root:root "${candidate}"
mv "${candidate}" "${target}"

if [[ ! -e /etc/pwnymarket.env ]]; then
  umask 077
  printf 'VOTE_HASH_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/pwnymarket.env
  chown root:root /etc/pwnymarket.env
  chmod 0600 /etc/pwnymarket.env
fi

install -m 0644 -o root -g root "${target}/deploy/zen/pwnymarket.service" /etc/systemd/system/pwnymarket.service
previous_target=$(readlink -f /var/www/html/pwnymarket/current 2>/dev/null || true)
ln -sfn "${target}" /var/www/html/pwnymarket/current.next
mv -Tf /var/www/html/pwnymarket/current.next /var/www/html/pwnymarket/current

systemctl daemon-reload
systemctl enable pwnymarket.service >/dev/null
if ! systemctl restart pwnymarket.service; then
  if [[ -n ${previous_target} ]]; then
    ln -sfn "${previous_target}" /var/www/html/pwnymarket/current
  else
    rm -f /var/www/html/pwnymarket/current
  fi
  systemctl restart pwnymarket.service || true
  exit 4
fi

for _ in 1 2 3 4 5; do
  if curl --fail --silent --show-error --unix-socket /run/pwnymarket/pwnymarket.sock http://localhost/healthz >/dev/null; then
    printf '%s\n' "${source_sha}" > /var/www/html/pwnymarket/DEPLOYED_SHA
    chmod 0644 /var/www/html/pwnymarket/DEPLOYED_SHA
    echo "RUNTIME_OK ${source_sha}"
    exit 0
  fi
  sleep 1
done

if [[ -n ${previous_target} ]]; then
  ln -sfn "${previous_target}" /var/www/html/pwnymarket/current
  systemctl restart pwnymarket.service || true
else
  rm -f /var/www/html/pwnymarket/current
fi
echo "Health check failed; previous release restored." >&2
exit 5

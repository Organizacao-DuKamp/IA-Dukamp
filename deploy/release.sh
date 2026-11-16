#!/usr/bin/env bash
# Run as the server administrator. Builds use PUBLIC values only.
set -euo pipefail
revision=${1:?Usage: release.sh FULL_COMMIT_SHA}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Use a full reviewed commit SHA'; exit 1; }
root=/opt/tpecia
release="$root/releases/$revision"
[[ ! -e "$release" ]] || { echo 'Release already exists; use another SHA or rollback'; exit 1; }
mkdir -p "$root/releases"
git clone https://github.com/Organizacao-DuKamp/IA-Dukamp.git "$release"
git -C "$release" checkout --detach "$revision"
cd "$release"
npm ci --include=dev
node --env-file=/etc/tpecia/build.env scripts/build-node.mjs
node --env-file=/etc/tpecia/tpecia.env scripts/check-config.mjs
previous=$(readlink -f "$root/current" || true)
# Stop consumer first; web remains available during drain. Then stop web.
systemctl stop tpecia-worker
systemctl stop tpecia-web
ln -s "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
systemctl start tpecia-web
systemctl start tpecia-worker
ready=false
for attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:3000/readyz > /dev/null; then ready=true; break; fi
  sleep 2
done
if [ "$ready" = true ]; then
  printf 'Release active: %s\nPrevious: %s\n' "$revision" "$previous"
else
  echo 'Readiness failed. Inspect journal; restoring previous release when available.'
  systemctl stop tpecia-worker tpecia-web
  if [ -n "$previous" ]; then
    ln -s "$previous" "$root/current.rollback"
    mv -Tf "$root/current.rollback" "$root/current"
    systemctl start tpecia-web tpecia-worker
  fi
  exit 1
fi

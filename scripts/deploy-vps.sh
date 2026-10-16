#!/usr/bin/env bash
# Build dan rilis Rukun di VPS tanpa Docker (berdampingan dengan situs lain di nginx).
# Struktur:
#   /srv/rukun/repo                 clone repo
#   /srv/rukun/releases/<waktu>     hasil build standalone
#   /srv/rukun/current              symlink ke rilis aktif (dipakai rukun.service)
#   /srv/rukun/data                 file upload (tetap ada antar rilis)
#   /srv/rukun/.env.production.local rahasia, tidak ada di repo
# Pemakaian: bash /srv/rukun/repo/scripts/deploy-vps.sh
set -euo pipefail

ROOT=/srv/rukun
REPO=$ROOT/repo
BRANCH=${BRANCH:-main}
STAMP=$(date +%Y%m%d%H%M%S)
REL=$ROOT/releases/$STAMP

cd "$REPO"
git fetch --quiet origin "$BRANCH"
git reset --quiet --hard "origin/$BRANCH"
echo "Commit: $(git log -1 --format='%h %s')"

npm ci --no-audit --no-fund --loglevel=error
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm run build

mkdir -p "$REL"
cp -a .next/standalone/. "$REL/"
mkdir -p "$REL/.next"
cp -a .next/static "$REL/.next/static"
cp -a public "$REL/public"
cp -a drizzle "$REL/drizzle"
mkdir -p "$ROOT/data"
ln -sfn "$ROOT/data" "$REL/.data"

ln -sfn "$REL" "$ROOT/current.new"
mv -T "$ROOT/current.new" "$ROOT/current"
sudo systemctl restart rukun.service

# Simpan 3 rilis terakhir.
ls -1dt "$ROOT"/releases/*/ | tail -n +4 | xargs -r rm -rf

for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3100/masuk"; then
    echo "Rilis $STAMP aktif."
    exit 0
  fi
  sleep 2
done
echo "Aplikasi belum merespons. Cek: journalctl -u rukun -n 100" >&2
exit 1

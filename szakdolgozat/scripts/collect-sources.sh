#!/usr/bin/env bash
# Cellauto három részének (admin, api, www) egy mappába gyűjtése a szakdolgozathoz.
# Használat: ./collect-sources.sh   vagy   CELLAUTO_ROOT=/egy/ut ./collect-sources.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SZAKDOLGOZAT_DIR="$(dirname "$SCRIPT_DIR")"
ADMIN_REPO="$(dirname "$SZAKDOLGOZAT_DIR")"
DEFAULT_ROOT="$(dirname "$ADMIN_REPO")"

CELLAUTO_ROOT="${CELLAUTO_ROOT:-$DEFAULT_ROOT}"
# Alapértelmezett kimenet a cellauto gyökérben (NEM az admin/szakdolgozat alatt — elkerüljük az rsync rekurziót)
OUT_DIR="${OUT_DIR:-$CELLAUTO_ROOT/gyujtett_forras_szakdolgozathoz}"
EXCLUDES="${EXCLUDES:-$SCRIPT_DIR/rsync-excludes.txt}"

for d in admin api www; do
  if [[ ! -d "$CELLAUTO_ROOT/$d" ]]; then
    echo "Hiányzó mappa: $CELLAUTO_ROOT/$d" >&2
    echo "Állítsd a CELLAUTO_ROOT környezeti változót (pl. export CELLAUTO_ROOT=/var/www/cellauto)" >&2
    exit 1
  fi
done

if [[ ! -f "$EXCLUDES" ]]; then
  echo "Nem találom az exclude fájlt: $EXCLUDES" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "CELLAUTO_ROOT=$CELLAUTO_ROOT"
echo "Cél: $OUT_DIR"
echo

copy_tree() {
  local name="$1"
  local src="$CELLAUTO_ROOT/$name"
  local dst="$OUT_DIR/$name"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --human-readable \
      --exclude-from="$EXCLUDES" \
      "$src/" "$dst/"
  else
    echo "rsync nincs a PATH-on — tar másolás ($name)…" >&2
    rm -rf "$dst"
    mkdir -p "$dst"
    tar -C "$src" --exclude-from="$EXCLUDES" -cf - . | tar -C "$dst" -xf -
  fi
}

copy_tree admin
copy_tree api
copy_tree www

MANIFEST="$OUT_DIR/MANIFEST.txt"
{
  echo "Cellauto forrás másolat — $(date -Iseconds)"
  echo "CELLAUTO_ROOT=$CELLAUTO_ROOT"
  echo
  du -sh "$OUT_DIR/admin" "$OUT_DIR/api" "$OUT_DIR/www" 2>/dev/null || true
} > "$MANIFEST"

echo "Kész. Összefoglaló: $MANIFEST"
echo "A szakdolgozat LaTeX fájljai továbbra is itt maradnak: $SZAKDOLGOZAT_DIR"

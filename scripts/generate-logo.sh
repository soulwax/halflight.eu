#!/usr/bin/env bash
# Rebuild the Halflight icon family from one editable SVG. The dark tile matches
# the listening-room surface; transparent corners adapt to the surrounding page.
# The maskable icon has an opaque background and keeps the entire mark inside
# the central 80% safe circle so launcher masks cannot crop the portrait or note.
#
# Usage: scripts/generate-logo.sh [SRC_SVG] [OUT_DIR]
# Requires: Python 3 and ffmpeg with its librsvg decoder.

set -euo pipefail

SRC="${1:-static/icons/halflight.svg}"
OUT_DIR="${2:-static/icons}"

[ -f "$SRC" ] || { echo "source svg not found: $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
mkdir -p "$OUT_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

python3 - "$SRC" "$WORK" <<'PY'
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ET.register_namespace('', 'http://www.w3.org/2000/svg')
source = Path(sys.argv[1])
work = Path(sys.argv[2])
root = ET.parse(source).getroot()
assert root.attrib['viewBox'] == '0 0 512 512', 'Expected the canonical 512px icon'
root.set('width', '2048')
root.set('height', '2048')
ET.ElementTree(root).write(work / 'icon.svg', encoding='unicode')

tile = root.find(".//*[@id='tile']")
art = root.find(".//*[@id='art']")
assert tile is not None and art is not None, 'Missing icon tile or artwork'
tile.set('rx', '0')
art.set('x', '92')
art.set('y', '95.5')
art.set('width', '328')
art.set('height', '321')
ET.ElementTree(root).write(work / 'maskable.svg', encoding='unicode')
PY

ffmpeg -y -v error -i "$WORK/icon.svg" -frames:v 1 "$WORK/master.png"
for size in 32 64 128 180 192 256 512; do
  ffmpeg -y -v error -i "$WORK/master.png" \
    -vf "scale=${size}:${size}:flags=lanczos" -frames:v 1 -pix_fmt rgba \
    "$OUT_DIR/halflight-${size}.png"
done
ffmpeg -y -v error -i "$WORK/master.png" \
  -vf 'scale=1024:1024:flags=lanczos' -frames:v 1 -pix_fmt rgba \
  "$OUT_DIR/halflight-logo.png"
ffmpeg -y -v error -i "$WORK/maskable.svg" \
  -vf 'scale=512:512:flags=lanczos' -frames:v 1 -pix_fmt rgba \
  "$OUT_DIR/halflight-maskable-512.png"

# Keep existing public icon URLs consistent with the canonical family.
cp "$OUT_DIR/halflight-512.png" "$OUT_DIR/halflight.png"
for size in 180 192 512; do
  cp "$OUT_DIR/halflight-${size}.png" "$OUT_DIR/halflight-now-${size}.png"
done
cp "$OUT_DIR/halflight-maskable-512.png" "$OUT_DIR/halflight-now-maskable-512.png"
if [ "$SRC" != "$OUT_DIR/halflight-now.svg" ]; then
  cp "$SRC" "$OUT_DIR/halflight-now.svg"
fi
echo "Rebuilt the Halflight icon family from $SRC"

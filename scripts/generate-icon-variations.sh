#!/usr/bin/env bash
#
# Colour variations of the Emily music mark.
#
# Rasterises a monochrome SVG (black paths on transparent) with ffmpeg's
# librsvg decoder, lifts its shape into an alpha mask, then paints that shape
# with a family of ffmpeg `gradients` fills — linear, radial, spiral — plus one
# composited "halo" treatment on a dark plate.
#
# Usage:
#   scripts/generate-icon-variations.sh [SRC_SVG] [OUT_DIR] [SIZE]
#
# Defaults: the many-paths raw mark, static/icons, 512px square PNGs.
# Requires: ffmpeg built with librsvg (the `svg` demuxer) — the same binary the
# repo already uses for screenshots.

set -euo pipefail

SRC="${1:-static/icons/emily-the-strange-music-with-many-paths-raw.svg}"
OUT_DIR="${2:-static/icons}"
SIZE="${3:-512}"
STEM="emily-the-strange-music"
RENDER=2048 # librsvg render + mask resolution; downscaled to $SIZE at the end

[ -f "$SRC" ] || { echo "source svg not found: $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
mkdir -p "$OUT_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1. Force a large intrinsic size on the SVG so librsvg rasterises crisply,
#    then square + pad to a transparent RENDER canvas and extract the alpha.
sed -E 's/width="[0-9]+(\.[0-9]+)?pt" height="[0-9]+(\.[0-9]+)?pt"/width="'"$RENDER"'" height="'"$RENDER"'"/' \
	"$SRC" >"$WORK/mark.svg"
ffmpeg -y -v error -i "$WORK/mark.svg" \
	-vf "scale=${RENDER}:${RENDER}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${RENDER}:${RENDER}:-1:-1:color=#00000000" \
	"$WORK/mark.png"
ffmpeg -y -v error -i "$WORK/mark.png" -vf "alphaextract" "$WORK/mask.png"

# 2. One gradient-filled variant: paint [gradient] with the mark's alpha.
paint() {
	local name="$1" grad="$2"
	ffmpeg -y -v error -i "$WORK/mask.png" \
		-f lavfi -i "gradients=s=${RENDER}x${RENDER}:d=1:speed=0.00001:${grad}" \
		-filter_complex "[1:v][0:v]alphamerge,scale=${SIZE}:${SIZE}:flags=lanczos[out]" \
		-map "[out]" -frames:v 1 -pred mixed -pix_fmt rgba \
		"$OUT_DIR/${STEM}-${name}-${SIZE}.png"
	echo "  ${STEM}-${name}-${SIZE}.png"
}

R=$RENDER
HALF=$((RENDER / 2))

paint ink       "c0=0x16337a:c1=0x1b3a8f:n=2:x0=0:y0=0:x1=0:y1=${R}"
paint editorial "c0=0x9cc3ee:c1=0xf1bcd6:n=2:x0=64:y0=64:x1=$((R-64)):y1=$((R-64))"
paint nocturne  "c0=0x312e81:c1=0x7c3aed:c2=0xbe185d:n=3:x0=0:y0=0:x1=0:y1=${R}"
paint neon      "c0=0x22d3ee:c1=0xd946ef:n=2:x0=0:y0=0:x1=${R}:y1=${R}"
paint ember     "c0=0xfbbf24:c1=0xef4444:c2=0x7c3aed:n=3:x0=0:y0=0:x1=0:y1=${R}"
paint aurora    "c0=0x0ea5a4:c1=0x4ade80:c2=0x3b82f6:n=3:x0=0:y0=${HALF}:x1=${R}:y1=${HALF}"
paint gold      "type=radial:c0=0xfdf1c4:c1=0xf5c542:c2=0x7c4a12:n=3:x0=${HALF}:y0=$((R*43/100)):x1=${HALF}:y1=${R}"
paint spectrum  "c0=0x2563eb:c1=0x06b6d4:c2=0x84cc16:c3=0xfacc15:c4=0xfb7185:c5=0xa855f7:n=6:x0=0:y0=0:x1=${R}:y1=$((R*40/100))"
paint vortex    "type=spiral:c0=0x1e3a8a:c1=0x38bdf8:c2=0xf472b6:n=3:x0=${HALF}:y0=$((R*45/100)):x1=${R}:y1=${R}"

# 3. Halo: a crisp cyan mark over its own blurred glow on a deep-navy plate.
ffmpeg -y -v error \
	-i "$WORK/mask.png" \
	-f lavfi -i "gradients=s=${R}x${R}:d=1:speed=0.00001:c0=0x38bdf8:c1=0x818cf8:n=2:x0=0:y0=0:x1=0:y1=${R}" \
	-f lavfi -i "color=c=0x0b1020:s=${R}x${R}" \
	-filter_complex "\
[1:v][0:v]alphamerge,split[mk][gl]; \
[gl]gblur=sigma=$((R/48)),eq=brightness=0.06:saturation=1.6[glow]; \
[2:v][glow]overlay[plate]; \
[plate][mk]overlay,scale=${SIZE}:${SIZE}:flags=lanczos[out]" \
	-map "[out]" -frames:v 1 -pred mixed -pix_fmt rgb24 \
	"$OUT_DIR/${STEM}-halo-${SIZE}.png"
echo "  ${STEM}-halo-${SIZE}.png"

echo "done — 10 variations in $OUT_DIR/"

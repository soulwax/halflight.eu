#!/usr/bin/env bash
#
# The canonical Halflight logo: the Emily music mark painted with an aurora
# gradient, seated on a white rounded plate with a soft coloured glow and a
# grounding drop shadow.
#
# Rebuilds the whole app-icon ladder (static/icons/halflight-*.png) plus the
# 1024px master, and a few aurora alternates for comparison. Everything is
# derived here so the logo is reproducible from one script + one source SVG.
#
# Usage:  scripts/generate-logo.sh [SRC_SVG] [OUT_DIR]
# Requires: ffmpeg built with librsvg (the `svg` demuxer).

set -euo pipefail

SRC="${1:-static/icons/emily-the-strange-music-raw.svg}"
OUT_DIR="${2:-static/icons}"
R=1024 # master / working resolution

# The canonical aurora sweep — teal → emerald → sky → indigo, low to high.
AURORA="c0=0x0d9488:c1=0x22c55e:c2=0x0ea5e9:c3=0x6366f1:n=4:x0=140:y0=210:x1=900:y1=880"

[ -f "$SRC" ] || { echo "source svg not found: $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
mkdir -p "$OUT_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1. Rasterise the mark crisply and lift its alpha.
sed -E 's/width="[0-9]+(\.[0-9]+)?pt" height="[0-9]+(\.[0-9]+)?pt"/width="2048" height="2001"/' \
	"$SRC" >"$WORK/mark.svg"
ffmpeg -y -v error -i "$WORK/mark.svg" \
	-vf "scale=${R}:${R}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${R}:${R}:-1:-1:color=#00000000" \
	"$WORK/mark.png"
ffmpeg -y -v error -i "$WORK/mark.png" -vf alphaextract "$WORK/mask.png"

# 2. White plate + a tinted silhouette for the drop shadow (same geometry).
cat >"$WORK/plate.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}" viewBox="0 0 ${R} ${R}">
<rect x="36" y="36" width="$((R - 72))" height="$((R - 72))" rx="224" fill="#ffffff"/>
</svg>
EOF
sed 's/#ffffff/#1f6f8b/' "$WORK/plate.svg" >"$WORK/sil.svg"
ffmpeg -y -v error -i "$WORK/plate.svg" "$WORK/plate.png"
ffmpeg -y -v error -i "$WORK/sil.svg" "$WORK/sil.png"

# 3. Compose one logo at $R, then downscale to $size.
#    layers: drop shadow · white plate · aurora glow · aurora mark
#    `compact` (small favicons) drops the glow and lets the mark fill the plate
#    so 32/48px stay legible; the full treatment keeps the soft glow + shadow.
build() {
	local name="$1" size="$2" grad="$3" mode="${4:-full}"
	local out="$OUT_DIR/${name}.png"
	local mark_px=836 glow="gblur=sigma=11,eq=saturation=1.25,colorchannelmixer=aa=0.42" \
		shadow_a=0.24 plate_shift=-18
	if [ "$mode" = compact ]; then
		mark_px=936
		glow="gblur=sigma=4,colorchannelmixer=aa=0.18"
		shadow_a=0.16
		plate_shift=-6
	fi
	ffmpeg -y -v error \
		-i "$WORK/sil.png" -i "$WORK/plate.png" -i "$WORK/mask.png" \
		-f lavfi -i "gradients=s=${R}x${R}:d=1:speed=0.00001:${grad}" \
		-filter_complex "\
color=c=0x00000000:s=${R}x${R},format=rgba[base]; \
[0:v]format=rgba,gblur=sigma=24,colorchannelmixer=aa=${shadow_a}[sh]; \
[2:v]scale=${mark_px}:${mark_px}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${R}:${R}:-1:-1:color=#00000000[amask]; \
[3:v][amask]alphamerge,split[mk][mg]; \
[mg]${glow}[glow]; \
[base][sh]overlay=0:14[b1]; \
[b1][1:v]overlay=0:0[b2]; \
[b2][glow]overlay=0:${plate_shift}[b3]; \
[b3][mk]overlay=0:${plate_shift},scale=${size}:${size}:flags=lanczos[out]" \
		-map "[out]" -frames:v 1 -pred mixed -pix_fmt rgba "$out"
	echo "  ${out#"$OUT_DIR"/}"
}

echo "canonical app-icon ladder:"
for s in 512 256 192 128; do
	build "halflight-${s}" "$s" "$AURORA"
done
for s in 64 32; do
	build "halflight-${s}" "$s" "$AURORA" compact
done
cp "$OUT_DIR/halflight-512.png" "$OUT_DIR/halflight.png"
echo "  halflight.png (= 512)"

echo "aurora alternates (comparison only, not wired in):"
build "halflight-aurora-horizon" 512 "c0=0x0d9488:c1=0x22c55e:c2=0x0ea5e9:c3=0x6366f1:n=4:x0=90:y0=512:x1=934:y1=512"
build "halflight-aurora-dawn" 512 "c0=0x0e7490:c1=0x2dd4bf:c2=0x86efac:c3=0xfde68a:n=4:x0=140:y0=880:x1=900:y1=210"
build "halflight-aurora-deep" 512 "c0=0x134e4a:c1=0x059669:c2=0x1d4ed8:c3=0x4c1d95:n=4:x0=140:y0=210:x1=900:y1=880"

echo "done — canonical logo + 3 alternates in $OUT_DIR/"

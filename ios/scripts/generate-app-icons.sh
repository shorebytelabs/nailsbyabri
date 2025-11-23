#!/bin/bash
# Generate all iOS app icon sizes from a source 1024x1024 image
# Usage: ./scripts/generate-app-icons.sh <source-icon.png>
set -e
SOURCE_IMAGE="$1"
OUTPUT_DIR="ios/nailsbyabri/Images.xcassets/AppIcon.appiconset"
if [ -z "$SOURCE_IMAGE" ]; then
  echo "❌ Error: Please provide a source icon image"
  echo "Usage: ./scripts/generate-app-icons.sh <source-icon.png>"
  exit 1
fi
if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "❌ Error: Source image not found: $SOURCE_IMAGE"
  exit 1
fi
if command -v sips &> /dev/null; then
  echo "✅ Using macOS sips"
else
  echo "❌ Error: sips not found (should be on macOS)"
  exit 1
fi
echo "📦 Generating iOS app icons from: $SOURCE_IMAGE"
mkdir -p "$OUTPUT_DIR"
declare -A ICONS=(
  ["icon-20@2x.png"]="40"
  ["icon-20@3x.png"]="60"
  ["icon-29@2x.png"]="58"
  ["icon-29@3x.png"]="87"
  ["icon-40@2x.png"]="80"
  ["icon-40@3x.png"]="120"
  ["icon-60@2x.png"]="120"
  ["icon-60@3x.png"]="180"
  ["icon-1024.png"]="1024"
)
for filename in "${!ICONS[@]}"; do
  size="${ICONS[$filename]}"
  output_path="$OUTPUT_DIR/$filename"
  echo "  Generating $filename (${size}x${size})..."
  sips -z "$size" "$size" "$SOURCE_IMAGE" --out "$output_path" > /dev/null 2>&1
done
echo ""
echo "✅ All icons generated successfully!"
echo "📝 Next step: Run ./scripts/update-appicon-contents.sh"

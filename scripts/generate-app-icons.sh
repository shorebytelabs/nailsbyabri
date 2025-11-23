#!/bin/bash

# Generate all iOS app icon sizes from a source 1024x1024 image
# Usage: ./scripts/generate-app-icons.sh <source-icon.png>

set -e

SOURCE_IMAGE="$1"
OUTPUT_DIR="ios/nailsbyabri/Images.xcassets/AppIcon.appiconset"

if [ -z "$SOURCE_IMAGE" ]; then
  echo "❌ Error: Please provide a source icon image"
  echo "Usage: ./scripts/generate-app-icons.sh <source-icon.png>"
  echo ""
  echo "The source image should be 1024x1024 pixels (PNG format)"
  exit 1
fi

if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "❌ Error: Source image not found: $SOURCE_IMAGE"
  exit 1
fi

# Check if we have a resize tool (ImageMagick or macOS sips)
HAS_IMAGEMAGICK=false
HAS_SIPS=false

if command -v convert &> /dev/null; then
  HAS_IMAGEMAGICK=true
  echo "✅ Using ImageMagick"
elif command -v sips &> /dev/null; then
  HAS_SIPS=true
  echo "✅ Using macOS sips"
else
  echo "❌ Error: No image resize tool found"
  echo "Install ImageMagick: brew install imagemagick"
  echo "Or use macOS built-in sips (should be available)"
  exit 1
fi

echo "📦 Generating iOS app icons from: $SOURCE_IMAGE"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Generate each icon size (using simple array instead of associative array)
generate_icon() {
  local filename="$1"
  local size="$2"
  local output_path="$OUTPUT_DIR/$filename"
  
  echo "  Generating $filename (${size}x${size})..."
  
  if [ "$HAS_IMAGEMAGICK" = true ]; then
    convert "$SOURCE_IMAGE" -resize "${size}x${size}" -unsharp 0x0.5+0.5+0.008 "$output_path"
  elif [ "$HAS_SIPS" = true ]; then
    sips -z "$size" "$size" "$SOURCE_IMAGE" --out "$output_path" > /dev/null 2>&1
  fi
}

# Generate all icon sizes
generate_icon "icon-20@2x.png" "40"
generate_icon "icon-20@3x.png" "60"
generate_icon "icon-29@2x.png" "58"
generate_icon "icon-29@3x.png" "87"
generate_icon "icon-40@2x.png" "80"
generate_icon "icon-40@3x.png" "120"
generate_icon "icon-60@2x.png" "120"
generate_icon "icon-60@3x.png" "180"
generate_icon "icon-1024.png" "1024"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "📝 Next step: Run bash scripts/update-appicon-contents.sh"
echo "   Or drag and drop them into Xcode's AppIcon editor"

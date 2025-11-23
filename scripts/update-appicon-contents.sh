#!/bin/bash

# Update AppIcon.appiconset/Contents.json with generated icon filenames
# This script assumes icons were generated with generate-app-icons.sh

set -e

CONTENTS_FILE="ios/nailsbyabri/Images.xcassets/AppIcon.appiconset/Contents.json"
ICON_DIR="ios/nailsbyabri/Images.xcassets/AppIcon.appiconset"

# Check if icon files exist
if [ ! -f "$ICON_DIR/icon-1024.png" ]; then
  echo "❌ Error: Icon files not found. Run generate-app-icons.sh first."
  exit 1
fi

echo "📝 Updating Contents.json with icon filenames..."

# Create updated Contents.json
cat > "$CONTENTS_FILE" << 'EOF'
{
  "images" : [
    {
      "filename" : "icon-20@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-20@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-29@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-29@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-40@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-40@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-60@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "60x60"
    },
    {
      "filename" : "icon-60@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "60x60"
    },
    {
      "filename" : "icon-1024.png",
      "idiom" : "ios-marketing",
      "scale" : "1x",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

echo "✅ Contents.json updated successfully!"
echo ""
echo "📋 Generated icons:"
ls -lh "$ICON_DIR"/icon-*.png 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'


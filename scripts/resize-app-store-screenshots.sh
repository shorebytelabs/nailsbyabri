#!/bin/bash

# Script to resize screenshots for App Store Connect
# Usage: ./resize-app-store-screenshots.sh <input-image> [output-directory]

set -e

INPUT_IMAGE="$1"
OUTPUT_DIR="${2:-./app-store-screenshots}"

if [ -z "$INPUT_IMAGE" ]; then
    echo "Usage: $0 <input-image> [output-directory]"
    echo "Example: $0 screenshot.png ./screenshots"
    exit 1
fi

if [ ! -f "$INPUT_IMAGE" ]; then
    echo "Error: Input image '$INPUT_IMAGE' not found"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if sips (macOS) or ImageMagick is available
if command -v sips &> /dev/null; then
    RESIZE_CMD="sips"
    RESIZE_TOOL="sips"
elif command -v convert &> /dev/null; then
    RESIZE_CMD="convert"
    RESIZE_TOOL="imagemagick"
elif command -v magick &> /dev/null; then
    RESIZE_CMD="magick"
    RESIZE_TOOL="imagemagick"
else
    echo "Error: Neither 'sips' (macOS) nor ImageMagick ('convert' or 'magick') found"
    echo "Please install ImageMagick: brew install imagemagick"
    exit 1
fi

echo "Using $RESIZE_TOOL to resize images..."
echo "Input: $INPUT_IMAGE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Function to resize with sips
resize_sips() {
    local input="$1"
    local output="$2"
    local width="$3"
    local height="$4"
    
    sips -z "$height" "$width" "$input" --out "$output" > /dev/null 2>&1
}

# Function to resize with ImageMagick
resize_imagemagick() {
    local input="$1"
    local output="$2"
    local width="$3"
    local height="$4"
    
    $RESIZE_CMD "$input" -resize "${width}x${height}!" "$output" > /dev/null 2>&1
}

# Function to resize based on available tool
resize_image() {
    local input="$1"
    local output="$2"
    local width="$3"
    local height="$4"
    
    if [ "$RESIZE_TOOL" = "sips" ]; then
        resize_sips "$input" "$output" "$width" "$height"
    else
        resize_imagemagick "$input" "$output" "$width" "$height"
    fi
}

# iPhone Screenshots
echo "Creating iPhone screenshots..."

# iPhone 6.5" (iPhone 11 Pro Max, XS Max) - 1242 × 2688px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPhone-1242x2688.png" 1242 2688
echo "  ✓ iPhone-1242x2688.png"

# iPhone 6.5" Landscape - 2688 × 1242px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPhone-2688x1242.png" 2688 1242
echo "  ✓ iPhone-2688x1242.png"

# iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max) - 1284 × 2778px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPhone-1284x2778.png" 1284 2778
echo "  ✓ iPhone-1284x2778.png"

# iPhone 6.7" Landscape - 2778 × 1284px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPhone-2778x1284.png" 2778 1284
echo "  ✓ iPhone-2778x1284.png"

# iPad Screenshots
echo ""
echo "Creating iPad screenshots..."

# iPad Pro 12.9" (4th gen) - 2064 × 2752px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPad-2064x2752.png" 2064 2752
echo "  ✓ iPad-2064x2752.png"

# iPad Pro 12.9" Landscape - 2752 × 2064px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPad-2752x2064.png" 2752 2064
echo "  ✓ iPad-2752x2064.png"

# iPad Pro 12.9" (3rd gen) - 2048 × 2732px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPad-2048x2732.png" 2048 2732
echo "  ✓ iPad-2048x2732.png"

# iPad Pro 12.9" Landscape - 2732 × 2048px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/iPad-2732x2048.png" 2732 2048
echo "  ✓ iPad-2732x2048.png"

# Apple Watch Screenshots
echo ""
echo "Creating Apple Watch screenshots..."

# Apple Watch Series 7 (45mm) - 422 × 514px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-422x514.png" 422 514
echo "  ✓ Apple-Watch-422x514.png"

# Apple Watch Series 6 (44mm) - 410 × 502px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-410x502.png" 410 502
echo "  ✓ Apple-Watch-410x502.png"

# Apple Watch Series 5 (44mm) - 416 × 496px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-416x496.png" 416 496
echo "  ✓ Apple-Watch-416x496.png"

# Apple Watch Series 4 (44mm) - 396 × 484px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-396x484.png" 396 484
echo "  ✓ Apple-Watch-396x484.png"

# Apple Watch Series 3 (42mm) - 368 × 448px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-368x448.png" 368 448
echo "  ✓ Apple-Watch-368x448.png"

# Apple Watch Series 2 (38mm) - 312 × 390px
resize_image "$INPUT_IMAGE" "$OUTPUT_DIR/Apple-Watch-312x390.png" 312 390
echo "  ✓ Apple-Watch-312x390.png"

echo ""
echo "✅ All screenshots created successfully!"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""
echo "Note: App Store Connect may require specific sizes based on your app's target devices."
echo "Upload the appropriate screenshots for the devices you support."


#!/bin/bash
# Script to prepare for production Archive build
# This generates codegen files using Release configuration (production)

set -e

echo "🔧 Preparing for Production Archive Build"
echo ""

cd "$(dirname "$0")/../ios"

echo "📦 Step 1: Cleaning build directory..."
rm -rf build
echo "✅ Cleaned"

echo ""
echo "📦 Step 2: Clearing environment override files..."
rm -f /tmp/envfile /tmp/envfile-override
echo "✅ Cleared"

echo ""
echo "📦 Step 3: Clearing cached GeneratedDotEnv.m files..."
find ../node_modules/react-native-config -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
find Pods -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
echo "✅ Cleared"

echo ""
echo "📦 Step 4: Generating codegen files with Release build (production)..."
echo "   This will use .env.production"
echo ""

xcodebuild \
  -workspace nailsbyabri.xcworkspace \
  -scheme nailsbyabri \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  clean build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  2>&1 | grep -E "(error|warning|Generated|codegen|SUPABASE|APP_ENV)" | tail -30 || true

echo ""
echo "✅ Codegen files generated"
echo ""
echo "📦 Step 5: Verifying codegen files..."
if [ -f "build/generated/ios/rnreanimated/rnreanimated-generated.mm" ]; then
  echo "✅ rnreanimated codegen file exists"
else
  echo "⚠️  rnreanimated codegen file not found"
fi

if [ -f "build/generated/ios/rnscreens/rnscreens-generated.mm" ]; then
  echo "✅ rnscreens codegen file exists"
else
  echo "⚠️  rnscreens codegen file not found"
fi

echo ""
echo "✅ Preparation complete!"
echo ""
echo "📱 Next steps:"
echo "   1. Open Xcode"
echo "   2. Select 'Any iOS Device (arm64)' or your device"
echo "   3. Product → Clean Build Folder (Shift+Cmd+K)"
echo "   4. Product → Archive"
echo ""
echo "   The Archive will use production environment (.env.production)"


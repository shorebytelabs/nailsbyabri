#!/bin/bash
# Comprehensive cleanup script for react-native-config cache files
# Run this BEFORE archiving to ensure production environment is used

set -e

echo "🧹 Cleaning ALL react-native-config cache files..."
echo ""

cd "$(dirname "$0")/.."

echo "📦 Step 1: Cleaning build directory..."
rm -rf ios/build
echo "✅ Cleaned"

echo ""
echo "📦 Step 2: Clearing environment override files..."
rm -f /tmp/envfile /tmp/envfile-override
echo "✅ Cleared"

echo ""
echo "📦 Step 3: Clearing ALL GeneratedDotEnv.m files in node_modules..."
find node_modules/react-native-config -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
echo "✅ Cleared node_modules cache"

echo ""
echo "📦 Step 4: Clearing ALL GeneratedDotEnv.m files in Pods..."
if [ -d "ios/Pods" ]; then
  find ios/Pods -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
  echo "✅ Cleared Pods cache"
else
  echo "⚠️  Pods directory not found (run 'cd ios && pod install' first)"
fi

echo ""
echo "📦 Step 5: Clearing Xcode DerivedData..."
# Clear derived data for this specific project
if [ -d ~/Library/Developer/Xcode/DerivedData ]; then
  rm -rf ~/Library/Developer/Xcode/DerivedData/nailsbyabri-* 2>/dev/null || true
  echo "✅ Cleared DerivedData"
else
  echo "⚠️  DerivedData directory not found"
fi

echo ""
echo "📦 Step 6: Clearing ReactNativeConfig.xcconfig..."
rm -f ios/ReactNativeConfig.xcconfig
echo "✅ Cleared xcconfig file"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📱 Next steps:"
echo "   1. Open Xcode"
echo "   2. Product → Clean Build Folder (Shift+Cmd+K)"
echo "   3. Product → Archive"
echo ""
echo "   The Archive build will regenerate all config files using .env.production"


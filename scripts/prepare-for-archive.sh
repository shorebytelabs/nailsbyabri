#!/bin/bash
# Quick script to prepare for a clean production Archive build
# This ensures no cached dev files interfere with the Archive

set -e

echo "🧹 Preparing for Production Archive Build"
echo ""

cd "$(dirname "$0")/.."

echo "📦 Step 1: Cleaning iOS build directory..."
rm -rf ios/build
echo "✅ Cleaned build directory"

echo ""
echo "📦 Step 2: Clearing DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/nailsbyabri-* 2>/dev/null || true
echo "✅ Cleared DerivedData"

echo ""
echo "📦 Step 3: Clearing environment override files..."
rm -f /tmp/envfile /tmp/envfile-override
echo "✅ Cleared override files"

echo ""
echo "📦 Step 4: Clearing cached GeneratedDotEnv.m files..."
find node_modules/react-native-config -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
find ios/Pods -name "GeneratedDotEnv.m" -delete 2>/dev/null || true
echo "✅ Cleared cached config files"

echo ""
echo "✅ Preparation complete!"
echo ""
echo "📱 Next steps in Xcode:"
echo "   1. Open Xcode"
echo "   2. Select 'Any iOS Device (arm64)' (NOT a simulator)"
echo "   3. Product → Clean Build Folder (Shift+Cmd+K)"
echo "   4. Product → Archive"
echo ""
echo "   The Archive will use .env.production automatically (Release config)"


#!/bin/bash

# Force clean all generated config files and DerivedData cache
# Use this before archiving to ensure fresh production config

echo "🧹 Force cleaning Archive config files..."
echo ""

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SOURCE_ROOT"

# 1. Clean generated config files
echo "1️⃣  Cleaning generated config files..."
rm -f ios/ReactNativeConfig.xcconfig
rm -f ios/node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m
rm -f ios/Pods/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m 2>/dev/null
echo "✅ Removed generated config files"
echo ""

# 2. Clean DerivedData (where Xcode caches build artifacts)
echo "2️⃣  Cleaning DerivedData (this may take a moment)..."
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_DATA" ]; then
  # Find and remove project-specific DerivedData
  PROJECT_DERIVED=$(find "$DERIVED_DATA" -name "*nailsbyabri*" -type d 2>/dev/null | head -1)
  if [ -n "$PROJECT_DERIVED" ] && [ -d "$PROJECT_DERIVED" ]; then
    echo "   Found project DerivedData: $(basename "$PROJECT_DERIVED")"
    rm -rf "$PROJECT_DERIVED"
    echo "✅ Removed project DerivedData"
  else
    echo "   No project-specific DerivedData found (may have been cleaned already)"
  fi
else
  echo "   DerivedData directory not found"
fi
echo ""

# 3. Verify .env.production exists
echo "3️⃣  Verifying .env.production..."
if [ -f ".env.production" ]; then
  echo "✅ .env.production exists"
  if grep -q "SUPABASE_URL.*mldeyvbhavwntvlllrxu" .env.production; then
    echo "✅ .env.production contains production Supabase URL"
  else
    echo "⚠️  WARNING: .env.production might not contain production URL!"
    echo "   Check: grep SUPABASE_URL .env.production"
  fi
else
  echo "❌ ERROR: .env.production not found!"
  echo "   Create it from .env.development and update to production values"
  exit 1
fi
echo ""

# 4. Test config generation
echo "4️⃣  Testing config generation (dry run)..."
cd ios
if [ -f "generate-config.sh" ]; then
  echo "   Script exists: generate-config.sh"
  # Don't actually run it, just verify it exists and is executable
  if [ -x "generate-config.sh" ]; then
    echo "✅ Script is executable"
  else
    chmod +x generate-config.sh
    echo "✅ Made script executable"
  fi
else
  echo "❌ ERROR: generate-config.sh not found in ios/"
  exit 1
fi
cd ..
echo ""

echo "✅ Cleanup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Open Xcode"
echo "2. Product → Clean Build Folder (Shift+Cmd+K)"
echo "3. Product → Archive"
echo "4. Watch build log for 'Generate ReactNativeConfig' phase"
echo "5. Should see: 'Archive: Using ENVFILE from Xcode build setting: .env.production'"
echo ""
echo "If it still doesn't work, check the build log for errors in 'Generate ReactNativeConfig' phase"


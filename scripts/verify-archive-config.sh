#!/bin/bash

# Verify that Archive build will use production config
# Run this BEFORE archiving to ensure everything is correct

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SOURCE_ROOT"

echo "🔍 Verifying Archive configuration..."
echo ""

# 1. Check .env.production exists and has correct values
echo "1️⃣  Checking .env.production..."
if [ ! -f ".env.production" ]; then
  echo "❌ ERROR: .env.production not found!"
  exit 1
fi

PROD_URL=$(grep "^SUPABASE_URL=" .env.production | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DEV_URL=$(grep "^SUPABASE_URL=" .env.development | cut -d '=' -f2- | tr -d '"' | tr -d "'" 2>/dev/null || echo "")

echo "   Production URL: ${PROD_URL:0:50}..."
echo "   Dev URL: ${DEV_URL:0:50}..."

if [[ "$PROD_URL" == *"mldeyvbhavwntvlllrxu"* ]]; then
  echo "✅ Production URL is correct (mldeyvbhavwntvlllrxu)"
else
  echo "❌ WARNING: Production URL doesn't look like production!"
  echo "   Expected: *mldeyvbhavwntvlllrxu*"
  echo "   Got: ${PROD_URL:0:50}..."
fi

if [[ "$PROD_URL" == "$DEV_URL" ]]; then
  echo "❌ ERROR: Production and Dev URLs are the same!"
  exit 1
fi

echo ""

# 2. Clean all generated files
echo "2️⃣  Cleaning generated config files..."
rm -f ios/ReactNativeConfig.xcconfig
rm -f ios/node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m 2>/dev/null
rm -f ios/Pods/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m 2>/dev/null
echo "✅ Cleaned"

echo ""

# 3. Manually generate config files with production values (simulating Archive)
echo "3️⃣  Generating config files with .env.production (simulating Archive)..."
cd ios

ENVFILE="../.env.production"
CONFIG_OUTPUT="ReactNativeConfig.xcconfig"

# Source the env file and generate manually
if [ -f "$ENVFILE" ]; then
  SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENVFILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENVFILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  APP_ENV=$(grep "^APP_ENV=" "$ENVFILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "production")
  
  # Create xcconfig
  cat > "$CONFIG_OUTPUT" << EOF
// Auto-generated - do not edit manually
SUPABASE_URL = $SUPABASE_URL
SUPABASE_ANON_KEY = $SUPABASE_ANON_KEY
APP_ENV = $APP_ENV
EOF
  
  echo "✅ Generated $CONFIG_OUTPUT"
  echo "   First line: $(head -1 "$CONFIG_OUTPUT")"
  
  # Create GeneratedDotEnv.m in node_modules (primary location)
  RNC_NODE_MODULES="node_modules/react-native-config/ios/ReactNativeConfig"
  if [ -d "$RNC_NODE_MODULES" ]; then
    cat > "${RNC_NODE_MODULES}/GeneratedDotEnv.m" << EOF
#import <Foundation/Foundation.h>

// Auto-generated - do not edit manually
#define DOT_ENV @{
  @"SUPABASE_URL" : @"$SUPABASE_URL",
  @"SUPABASE_ANON_KEY" : @"$SUPABASE_ANON_KEY",
  @"APP_ENV" : @"$APP_ENV"
};
EOF
    echo "✅ Generated ${RNC_NODE_MODULES}/GeneratedDotEnv.m"
    echo "   Contains: SUPABASE_URL = ${SUPABASE_URL:0:50}..."
  fi
  
  # Also create in Pods location if it exists
  RNC_PODS_DIR=$(find Pods -path "*/react-native-config/ios/ReactNativeConfig" -type d 2>/dev/null | head -1)
  if [ -n "$RNC_PODS_DIR" ] && [ -d "$RNC_PODS_DIR" ]; then
    cat > "${RNC_PODS_DIR}/GeneratedDotEnv.m" << EOF
#import <Foundation/Foundation.h>

// Auto-generated - do not edit manually
#define DOT_ENV @{
  @"SUPABASE_URL" : @"$SUPABASE_URL",
  @"SUPABASE_ANON_KEY" : @"$SUPABASE_ANON_KEY",
  @"APP_ENV" : @"$APP_ENV"
};
EOF
    echo "✅ Generated ${RNC_PODS_DIR}/GeneratedDotEnv.m"
  fi
else
  echo "❌ ERROR: $ENVFILE not found!"
  exit 1
fi

cd ..

echo ""

# 4. Verify generated files
echo "4️⃣  Verifying generated files..."
if grep -q "mldeyvbhavwntvlllrxu" ios/ReactNativeConfig.xcconfig 2>/dev/null; then
  echo "✅ ReactNativeConfig.xcconfig contains production URL"
else
  echo "❌ WARNING: ReactNativeConfig.xcconfig might not have production URL"
fi

if grep -q "mldeyvbhavwntvlllrxu" ios/node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m 2>/dev/null; then
  echo "✅ GeneratedDotEnv.m (node_modules) contains production URL"
else
  echo "❌ WARNING: GeneratedDotEnv.m (node_modules) might not have production URL"
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "📋 Next steps:"
echo "1. In Xcode: Product → Clean Build Folder (Shift+Cmd+K)"
echo "2. In Xcode: Product → Archive"
echo "3. After Archive completes, check the build log for 'Generate ReactNativeConfig' phase"
echo "4. Distribute to TestFlight"
echo ""
echo "💡 The generated files should now have production values and will be used by the Archive build."


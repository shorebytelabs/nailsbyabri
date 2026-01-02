#!/bin/bash

# Verify production config generation
# This script manually generates config files with production settings to verify they work

echo "🔍 Verifying production config generation..."
echo ""

# Set up paths
SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVFILE=".env.production"
ENV_FILE_PATH="${SOURCE_ROOT}/${ENVFILE}"
CONFIG_OUTPUT="${SOURCE_ROOT}/ios/ReactNativeConfig.xcconfig"
RNC_NODE_MODULES="${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig"

echo "📁 Source root: $SOURCE_ROOT"
echo "📄 Env file: $ENVFILE"
echo ""

if [ ! -f "$ENV_FILE_PATH" ]; then
  echo "❌ ERROR: .env.production not found at: $ENV_FILE_PATH"
  exit 1
fi

echo "✅ Found .env.production"
echo ""

# Check what's in .env.production
echo "📋 Contents of .env.production (first 3 lines with SUPABASE_URL):"
grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY|^APP_ENV" "$ENV_FILE_PATH" | head -3 | sed 's/=.*/=***/' || echo "⚠️  Could not find expected keys"
echo ""

# Test manual generation
echo "🧪 Testing manual config generation..."
echo ""

# Generate xcconfig manually
echo "📝 Generating ReactNativeConfig.xcconfig..."
{
  echo "// Auto-generated - do not edit manually (TEST GENERATION)"
  while IFS='=' read -r key value || [ -n "$key" ]; do
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    value=$(echo "$value" | sed "s/^['\"]//; s/['\"]$//")
    value=$(echo "$value" | sed 's/\\/\\\\/g')
    echo "${key} = ${value}"
  done < "$ENV_FILE_PATH"
} > "${CONFIG_OUTPUT}.test"

echo "✅ Generated test xcconfig"
echo ""

# Check test file
if [ -f "${CONFIG_OUTPUT}.test" ]; then
  echo "📋 Test xcconfig contents (first 5 lines):"
  head -5 "${CONFIG_OUTPUT}.test"
  echo ""
  
  if grep -q "SUPABASE_URL.*production\|SUPABASE_URL.*prod" "${CONFIG_OUTPUT}.test"; then
    echo "✅ Test xcconfig contains production Supabase URL"
  elif grep -q "SUPABASE_URL.*dev" "${CONFIG_OUTPUT}.test"; then
    echo "❌ WARNING: Test xcconfig contains DEV Supabase URL!"
  else
    echo "⚠️  Could not verify Supabase URL in test xcconfig"
  fi
  echo ""
  
  # Clean up test file
  rm "${CONFIG_OUTPUT}.test"
fi

# Generate GeneratedDotEnv.m manually
if [ -d "$RNC_NODE_MODULES" ]; then
  echo "📝 Generating GeneratedDotEnv.m (test)..."
  TEST_DOTENV="${RNC_NODE_MODULES}/GeneratedDotEnv.m.test"
  {
    echo "#import <Foundation/Foundation.h>"
    echo ""
    echo "// Auto-generated - do not edit manually (TEST GENERATION)"
    echo "#define DOT_ENV @{"
    first=true
    while IFS='=' read -r key value || [ -n "$key" ]; do
      [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
      value=$(echo "$value" | sed "s/^['\"]//; s/['\"]$//")
      value=$(echo "$value" | sed "s/\"/\\\\\"/g")
      if [ "$first" = true ]; then
        echo -n "  @\"${key}\" : @\"${value}\""
        first=false
      else
        echo ","
        echo -n "  @\"${key}\" : @\"${value}\""
      fi
    done < "$ENV_FILE_PATH"
    echo ""
    echo "};"
  } > "$TEST_DOTENV"
  
  echo "✅ Generated test GeneratedDotEnv.m"
  echo ""
  
  # Check test file
  if [ -f "$TEST_DOTENV" ]; then
    echo "📋 Test GeneratedDotEnv.m contents (showing SUPABASE_URL line):"
    grep "SUPABASE_URL" "$TEST_DOTENV" | head -1 | sed 's/@".*" : @"\([^"]*\)".*/@*** : @***/' || echo "⚠️  SUPABASE_URL not found"
    echo ""
    
    if grep -q "SUPABASE_URL.*production\|SUPABASE_URL.*prod" "$TEST_DOTENV"; then
      echo "✅ Test GeneratedDotEnv.m contains production Supabase URL"
    elif grep -q "SUPABASE_URL.*dev" "$TEST_DOTENV"; then
      echo "❌ WARNING: Test GeneratedDotEnv.m contains DEV Supabase URL!"
      echo ""
      echo "🔍 Check your .env.production file - it might contain dev values!"
    else
      echo "⚠️  Could not verify Supabase URL in test GeneratedDotEnv.m"
    fi
    echo ""
    
    # Clean up test file
    rm "$TEST_DOTENV"
  fi
else
  echo "⚠️  react-native-config node_modules directory not found"
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "📋 Next steps:"
echo "1. Check the test output above to verify production values"
echo "2. If values look correct, clean and rebuild:"
echo "   bash scripts/clean-config-files.sh"
echo "   (Then Archive in Xcode)"
echo "3. If values look wrong, check your .env.production file"


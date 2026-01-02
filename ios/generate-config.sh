#!/bin/bash

# Generate ReactNativeConfig for iOS
# Priority logic:
# 1. Archive builds (ACTION=install): ALWAYS use Xcode build setting (Release = .env.production)
# 2. Regular builds: Use Xcode build setting (Debug = .env.development, Release = .env.production)
# 3. npm script override: Only used if explicitly set and not an Archive build

# Check if this is an Archive build
IS_ARCHIVE_BUILD=false
if [ "$ACTION" = "install" ]; then
  IS_ARCHIVE_BUILD=true
  echo "📦 Archive build detected (ACTION=install) - will use Xcode build setting ENVFILE"
fi

# For Archive builds, ALWAYS use Xcode build setting (ignore override)
if [ "$IS_ARCHIVE_BUILD" = true ]; then
  if [ -n "$ENVFILE" ]; then
    export ENVFILE="$ENVFILE"
    echo "📝 Archive: Using ENVFILE from Xcode build setting: $ENVFILE"
    echo "📝 Archive: CONFIGURATION=$CONFIGURATION"
  else
    echo "⚠️  Archive build but ENVFILE not set in Xcode build settings!"
    export ENVFILE=".env.production"
    echo "📝 Archive: Falling back to .env.production"
  fi
# For regular builds, check Xcode build setting first
elif [ -n "$ENVFILE" ]; then
  # Xcode sets ENVFILE in build settings
  # Debug config: .env.development
  # Release config: .env.production
  export ENVFILE="$ENVFILE"
  echo "📝 Regular build: Using ENVFILE from Xcode build setting: $ENVFILE"
  echo "📝 Regular build: CONFIGURATION=$CONFIGURATION"
  
  # If override exists and is different, warn but use Xcode setting
  if [ -f /tmp/envfile-override ]; then
    OVERRIDE_ENVFILE="$(cat /tmp/envfile-override | tr -d '\n' | tr -d '\r')"
    if [ "$OVERRIDE_ENVFILE" != "$ENVFILE" ]; then
      echo "⚠️  Warning: /tmp/envfile-override has '$OVERRIDE_ENVFILE' but using Xcode setting '$ENVFILE'"
      echo "⚠️  To use override, run: npm run ios:dev (or ios:stage, ios:production)"
    fi
  fi
# Check override file (only for manual npm script runs)
elif [ -f /tmp/envfile-override ]; then
  export ENVFILE="$(cat /tmp/envfile-override | tr -d '\n' | tr -d '\r')"
  echo "📝 Using ENVFILE from /tmp/envfile-override: $ENVFILE"
# Environment variable fallback
elif [ -n "$ENVFILE" ]; then
  export ENVFILE="$ENVFILE"
  echo "📝 Using ENVFILE from environment variable: $ENVFILE"
# Final fallback
else
  # Default based on configuration if available
  if [ "$CONFIGURATION" = "Release" ]; then
    export ENVFILE=".env.production"
  else
    export ENVFILE=".env.development"
  fi
  echo "📝 Using default ENVFILE based on CONFIGURATION: $ENVFILE"
fi

# Calculate source root - SRCROOT is set by Xcode to the ios/ directory
# If SRCROOT is not set (manual run), use current directory's parent
if [ -z "$SRCROOT" ]; then
  # Manual run - assume we're in project root
  export SOURCE_ROOT="$(pwd)"
else
  # Xcode run - SRCROOT is ios/, so go up one level
  export SOURCE_ROOT="${SRCROOT}/.."
fi

export CONFIG_OUTPUT="${SRCROOT:-ios}/ReactNativeConfig.xcconfig"
export GENERATED_DOTENV="${SRCROOT:-ios}/ReactNativeConfig/GeneratedDotEnv.m"

# Write ENVFILE to /tmp/envfile so react-native-config's podspec script can read it
# This ensures the podspec script uses the correct .env file
# For Archive builds, don't write to override (to prevent contamination)
echo "$ENVFILE" > /tmp/envfile
if [ "$IS_ARCHIVE_BUILD" != true ]; then
  echo "$ENVFILE" > /tmp/envfile-override
  echo "📝 Wrote ENVFILE to /tmp/envfile-override: $ENVFILE"
fi
echo "📝 Wrote ENVFILE to /tmp/envfile: $ENVFILE"

echo "📦 Generating ReactNativeConfig"
echo "   ENVFILE: $ENVFILE"
echo "   SOURCE_ROOT: $SOURCE_ROOT"

# Convert to absolute path for the env file
ENV_FILE_PATH="${SOURCE_ROOT}/${ENVFILE}"
if [ ! -f "$ENV_FILE_PATH" ]; then
  # Try relative to current directory if absolute doesn't work
  ENV_FILE_PATH="$(cd "$SOURCE_ROOT" && pwd)/${ENVFILE}"
fi

if [ -f "$ENV_FILE_PATH" ]; then
  echo "✅ Found env file: $ENV_FILE_PATH"
  
  # Convert to absolute path
  ENV_FILE_ABS="$(cd "$(dirname "$ENV_FILE_PATH")" && pwd)/$(basename "$ENV_FILE_PATH")"
  CONFIG_OUTPUT_ABS="$(cd "$(dirname "$CONFIG_OUTPUT")" && pwd)/$(basename "$CONFIG_OUTPUT")"
  
  # Generate xcconfig file (for build settings) - use absolute paths
  "${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" "$ENV_FILE_ABS" "$CONFIG_OUTPUT_ABS" 2>&1 | grep -v "Missing .env file" || true
  
  # Check if xcconfig was generated and has content
  if [ -f "$CONFIG_OUTPUT" ] && [ -s "$CONFIG_OUTPUT" ] && grep -q "SUPABASE_URL\|APP_ENV" "$CONFIG_OUTPUT" 2>/dev/null; then
    echo "✅ xcconfig generated: $CONFIG_OUTPUT"
    # Fix URL escaping: /$()/ should be // in xcconfig files
    if grep -q '/\$()/' "$CONFIG_OUTPUT"; then
      echo "🔧 Fixing URL escaping in xcconfig..."
      sed -i '' 's|/\$()/|//|g' "$CONFIG_OUTPUT"
      echo "✅ Fixed URL escaping in xcconfig"
    fi
  else
    echo "⚠️  Ruby script failed or generated empty file, creating xcconfig manually..."
    # Manually create xcconfig from .env file
    {
      echo "// Auto-generated - do not edit manually"
      while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Remove quotes from value if present
        value=$(echo "$value" | sed "s/^['\"]//; s/['\"]$//")
        # Escape special characters for xcconfig
        value=$(echo "$value" | sed 's/\\/\\\\/g')
        echo "${key} = ${value}"
      done < "$ENV_FILE_PATH"
    } > "$CONFIG_OUTPUT"
    echo "✅ Manually created xcconfig: $CONFIG_OUTPUT"
  fi
  
  # Generate GeneratedDotEnv.m file (this is what the native module actually reads!)
  # react-native-config's podspec script phase also generates this, but we need to ensure
  # it uses the correct ENVFILE. We write to /tmp/envfile above so the podspec script reads it.
  # However, we also generate it here to ensure it's created before compilation.
  
  # The podspec expects: ${PODS_TARGET_SRCROOT}/ios/ReactNativeConfig/GeneratedDotEnv.m
  # But PODS_TARGET_SRCROOT might not be set when our script runs.
  # Generate in node_modules first (which gets copied to Pods), and also try Pods location
  RNC_NODE_MODULES="${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig"
  RNC_PODS_DIR=""
  
  # Try to find react-native-config in Pods
  if [ -n "$PODS_ROOT" ]; then
    RNC_PODS_DIR=$(find "${PODS_ROOT}" -path "*/react-native-config/ios/ReactNativeConfig" -type d 2>/dev/null | head -1)
  fi
  
  # BUILD_DIR is set by Xcode during builds, but set a fallback for manual runs
  export BUILD_DIR="${BUILD_DIR:-${TARGET_BUILD_DIR:-${CONFIGURATION_BUILD_DIR:-${SRCROOT}/build}}}"
  
  # Generate in node_modules (primary location)
  if [ -d "$RNC_NODE_MODULES" ]; then
    echo "📁 Generating GeneratedDotEnv.m in node_modules: $RNC_NODE_MODULES"
    # Set ENVFILE environment variable so ReadDotEnv.rb uses the correct file
    ENVFILE="$ENVFILE" "${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildDotenvConfig.rb" "$SOURCE_ROOT/$ENVFILE" "$RNC_NODE_MODULES" 2>&1 | grep -v "Missing .env file" || true
    
    # Check if GeneratedDotEnv.m was created and has valid content (not empty dictionary)
    if [ -f "${RNC_NODE_MODULES}/GeneratedDotEnv.m" ] && grep -q "DOT_ENV" "${RNC_NODE_MODULES}/GeneratedDotEnv.m" 2>/dev/null && ! grep -q "@{[[:space:]]*}" "${RNC_NODE_MODULES}/GeneratedDotEnv.m" 2>/dev/null && grep -q ":@" "${RNC_NODE_MODULES}/GeneratedDotEnv.m" 2>/dev/null; then
      echo "✅ GeneratedDotEnv.m created in node_modules"
      # Fix URL escaping: /$()/ should be // in .m files (xcconfig escaping doesn't apply here)
      if grep -q '/\$()/' "${RNC_NODE_MODULES}/GeneratedDotEnv.m"; then
        echo "🔧 Fixing URL escaping in GeneratedDotEnv.m..."
        sed -i '' 's|/\$()/|//|g' "${RNC_NODE_MODULES}/GeneratedDotEnv.m"
        echo "✅ Fixed URL escaping"
      fi
      echo "   First line:"
      head -1 "${RNC_NODE_MODULES}/GeneratedDotEnv.m" || true
    else
      echo "⚠️  Ruby script failed or generated empty file, creating GeneratedDotEnv.m manually..."
      # Manually create GeneratedDotEnv.m from .env file
      {
        echo "#import <Foundation/Foundation.h>"
        echo ""
        echo "// Auto-generated - do not edit manually"
        echo "#define DOT_ENV @{"
        first=true
        while IFS='=' read -r key value || [ -n "$key" ]; do
          # Skip empty lines and comments
          [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
          # Remove quotes from value if present
          value=$(echo "$value" | sed "s/^['\"]//; s/['\"]$//")
          # Escape quotes in value for Objective-C string
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
      } > "${RNC_NODE_MODULES}/GeneratedDotEnv.m"
      echo "✅ Manually created GeneratedDotEnv.m: ${RNC_NODE_MODULES}/GeneratedDotEnv.m"
    fi
  fi
  
  # CRITICAL: Also generate in Pods location - this is what react-native-config actually uses!
  # Even though we write to /tmp/envfile, we need to ensure the Pods location file is correct
  # because the podspec script phase might run before our script or use cached values.
  RNC_PODS_DIR_FALLBACK=""
  if [ -d "${SRCROOT:-ios}/Pods" ]; then
    RNC_PODS_DIR_FALLBACK=$(find "${SRCROOT:-ios}/Pods" -path "*/react-native-config/ios/ReactNativeConfig" -type d 2>/dev/null | head -1)
  fi
  
  # Try PODS_ROOT first (set by Xcode), then fallback to manual find
  if [ -n "$RNC_PODS_DIR" ] && [ -d "$RNC_PODS_DIR" ]; then
    echo "📁 Updating GeneratedDotEnv.m in Pods location: $RNC_PODS_DIR"
  elif [ -n "$RNC_PODS_DIR_FALLBACK" ] && [ -d "$RNC_PODS_DIR_FALLBACK" ]; then
    RNC_PODS_DIR="$RNC_PODS_DIR_FALLBACK"
    echo "📁 Updating GeneratedDotEnv.m in Pods location (found): $RNC_PODS_DIR"
  fi
  
  if [ -n "$RNC_PODS_DIR" ] && [ -d "$RNC_PODS_DIR" ]; then
    # Always manually create/overwrite the Pods file to ensure correct values
    # Don't rely on the podspec script - we control it here
    echo "🔧 Forcing update of Pods GeneratedDotEnv.m with $ENVFILE values..."
    {
      echo "#import <Foundation/Foundation.h>"
      echo ""
      echo "// Auto-generated - do not edit manually"
      echo "// Generated by generate-config.sh during build"
      echo "#define DOT_ENV @{"
      first=true
      while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Remove quotes from value if present
        value=$(echo "$value" | sed "s/^['\"]//; s/['\"]$//")
        # Escape quotes in value for Objective-C string
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
    } > "${RNC_PODS_DIR}/GeneratedDotEnv.m"
    
    # Fix URL escaping if needed
    if grep -q '/\$()/' "${RNC_PODS_DIR}/GeneratedDotEnv.m"; then
      echo "🔧 Fixing URL escaping in Pods GeneratedDotEnv.m..."
      sed -i '' 's|/\$()/|//|g' "${RNC_PODS_DIR}/GeneratedDotEnv.m"
    fi
    
    # Verify it was created correctly
    if grep -q "mldeyvbhavwntvlllrxu" "${RNC_PODS_DIR}/GeneratedDotEnv.m" 2>/dev/null && [ "$ENVFILE" = ".env.production" ]; then
      echo "✅ Pods GeneratedDotEnv.m updated with PRODUCTION values"
    elif [ "$ENVFILE" != ".env.production" ]; then
      echo "✅ Pods GeneratedDotEnv.m updated with $ENVFILE values"
    else
      echo "⚠️  WARNING: Pods GeneratedDotEnv.m might not have production values!"
    fi
  else
    echo "⚠️  Pods location not found - will be generated by podspec script phase"
    echo "   (This is OK if pods haven't been installed yet)"
  fi
  
  # Verify at least one file was created
  if [ ! -f "${RNC_NODE_MODULES}/GeneratedDotEnv.m" ] && [ -z "$RNC_PODS_DIR" ] && [ ! -f "${RNC_PODS_DIR}/GeneratedDotEnv.m" ]; then
    echo "⚠️  GeneratedDotEnv.m was not created in either location"
    echo "   node_modules: ${RNC_NODE_MODULES}"
    echo "   Pods: ${RNC_PODS_DIR:-not found}"
  fi
  
  # FINAL STEP: For Archive/Release builds with .env.production, force update Pods file one more time
  # This ensures the file is correct even if podspec script runs after us
  if [ "$ENVFILE" = ".env.production" ] && [ -n "$RNC_PODS_DIR" ] && [ -d "$RNC_PODS_DIR" ]; then
    echo "🔧 FINAL CHECK: Force updating Pods GeneratedDotEnv.m one more time for Archive build..."
    # Use a simple approach - just overwrite with production values
    SUPABASE_URL_VAL=$(grep "^SUPABASE_URL=" "$ENV_FILE_PATH" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    SUPABASE_ANON_KEY_VAL=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE_PATH" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    APP_ENV_VAL=$(grep "^APP_ENV=" "$ENV_FILE_PATH" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || echo "production")
    
    # Escape quotes for Objective-C
    SUPABASE_URL_ESC=$(echo "$SUPABASE_URL_VAL" | sed "s/\"/\\\\\"/g")
    SUPABASE_ANON_KEY_ESC=$(echo "$SUPABASE_ANON_KEY_VAL" | sed "s/\"/\\\\\"/g")
    APP_ENV_ESC=$(echo "$APP_ENV_VAL" | sed "s/\"/\\\\\"/g")
    
    cat > "${RNC_PODS_DIR}/GeneratedDotEnv.m" << FORCE_EOF
#import <Foundation/Foundation.h>

// Auto-generated - FORCED to production values by generate-config.sh
// This ensures Archive builds always use production Supabase
#define DOT_ENV @{
  @"SUPABASE_URL" : @"${SUPABASE_URL_ESC}",
  @"SUPABASE_ANON_KEY" : @"${SUPABASE_ANON_KEY_ESC}",
  @"APP_ENV" : @"${APP_ENV_ESC}"
};
FORCE_EOF
    
    if grep -q "mldeyvbhavwntvlllrxu" "${RNC_PODS_DIR}/GeneratedDotEnv.m" 2>/dev/null; then
      echo "✅ FINAL: Pods GeneratedDotEnv.m confirmed to have PRODUCTION values"
    else
      echo "❌ ERROR: Pods GeneratedDotEnv.m does NOT have production values!"
    fi
  fi
else
  echo "⚠️  Warning: $ENVFILE not found at $SOURCE_ROOT/$ENVFILE"
  echo "⚠️  Available .env files:"
  ls -la "$SOURCE_ROOT"/.env* 2>/dev/null || echo "  (none found)"
fi

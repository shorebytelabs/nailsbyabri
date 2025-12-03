#!/bin/bash

# Generate ReactNativeConfig for iOS
# Priority: 1) /tmp/envfile-override (set by npm script), 2) Environment variable ENVFILE, 3) Xcode build setting ENVFILE, 4) default .env
if [ -f /tmp/envfile-override ]; then
  # Highest priority: file written by npm script before build
  export ENVFILE="$(cat /tmp/envfile-override | tr -d '\n' | tr -d '\r')"
  echo "📝 Using ENVFILE from /tmp/envfile-override: $ENVFILE"
elif [ -n "$ENVFILE" ]; then
  # Environment variable (if set in shell)
  export ENVFILE="$ENVFILE"
  echo "📝 Using ENVFILE from environment variable: $ENVFILE"
else
  # Use Xcode build setting (this is set in project.pbxproj)
  # This will be .env.development for Debug, .env.production for Release
  export ENVFILE="${ENVFILE:-.env}"
  echo "📝 Using ENVFILE from Xcode build setting: $ENVFILE"
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
# Also write to envfile-override so it persists across builds
echo "$ENVFILE" > /tmp/envfile
echo "$ENVFILE" > /tmp/envfile-override
echo "📝 Wrote ENVFILE to /tmp/envfile: $ENVFILE"
echo "📝 Wrote ENVFILE to /tmp/envfile-override: $ENVFILE"

echo "📦 Generating ReactNativeConfig"
echo "   ENVFILE: $ENVFILE"
echo "   SOURCE_ROOT: $SOURCE_ROOT"

if [ -f "$SOURCE_ROOT/$ENVFILE" ]; then
  echo "✅ Found env file: $SOURCE_ROOT/$ENVFILE"
  
  # Generate xcconfig file (for build settings)
  "${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" "$SOURCE_ROOT/$ENVFILE" "$CONFIG_OUTPUT"
  if [ -f "$CONFIG_OUTPUT" ]; then
    echo "✅ xcconfig generated: $CONFIG_OUTPUT"
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
    ENVFILE="$ENVFILE" "${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildDotenvConfig.rb" "$SOURCE_ROOT/$ENVFILE" "$RNC_NODE_MODULES"
    
    if [ -f "${RNC_NODE_MODULES}/GeneratedDotEnv.m" ]; then
      echo "✅ GeneratedDotEnv.m created in node_modules"
      # Fix URL escaping: /$()/ should be // in .m files (xcconfig escaping doesn't apply here)
      if grep -q '/\$()/' "${RNC_NODE_MODULES}/GeneratedDotEnv.m"; then
        echo "🔧 Fixing URL escaping in GeneratedDotEnv.m..."
        sed -i '' 's|/\$()/|//|g' "${RNC_NODE_MODULES}/GeneratedDotEnv.m"
        echo "✅ Fixed URL escaping"
      fi
      echo "   First line:"
      head -1 "${RNC_NODE_MODULES}/GeneratedDotEnv.m" || true
    fi
  fi
  
  # Also generate in Pods location if found (for immediate use)
  if [ -n "$RNC_PODS_DIR" ] && [ -d "$RNC_PODS_DIR" ]; then
    echo "📁 Also generating in Pods location: $RNC_PODS_DIR"
    "${SOURCE_ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildDotenvConfig.rb" "$SOURCE_ROOT/$ENVFILE" "$RNC_PODS_DIR"
    
    if [ -f "${RNC_PODS_DIR}/GeneratedDotEnv.m" ]; then
      echo "✅ GeneratedDotEnv.m created in Pods"
      # Fix URL escaping: /$()/ should be // in .m files
      if grep -q '/\$()/' "${RNC_PODS_DIR}/GeneratedDotEnv.m"; then
        echo "🔧 Fixing URL escaping in Pods GeneratedDotEnv.m..."
        sed -i '' 's|/\$()/|//|g' "${RNC_PODS_DIR}/GeneratedDotEnv.m"
        echo "✅ Fixed URL escaping"
      fi
      echo "   First few lines:"
      head -3 "${RNC_PODS_DIR}/GeneratedDotEnv.m" || true
    fi
  fi
  
  # Verify at least one file was created
  if [ ! -f "${RNC_NODE_MODULES}/GeneratedDotEnv.m" ] && [ -z "$RNC_PODS_DIR" ] && [ ! -f "${RNC_PODS_DIR}/GeneratedDotEnv.m" ]; then
    echo "⚠️  GeneratedDotEnv.m was not created in either location"
    echo "   node_modules: ${RNC_NODE_MODULES}"
    echo "   Pods: ${RNC_PODS_DIR:-not found}"
  fi
else
  echo "⚠️  Warning: $ENVFILE not found at $SOURCE_ROOT/$ENVFILE"
  echo "⚠️  Available .env files:"
  ls -la "$SOURCE_ROOT"/.env* 2>/dev/null || echo "  (none found)"
fi

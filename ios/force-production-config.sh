#!/bin/bash

# Force update Pods GeneratedDotEnv.m with production values
# This script runs AFTER all pod-related scripts to ensure production values are used
# Run this as a build phase AFTER "Embed Pods Frameworks"

set -e

# Get source root - SRCROOT is set by Xcode to the ios/ directory
SOURCE_ROOT="${SRCROOT}/.."
ENV_FILE="${SOURCE_ROOT}/.env.production"

# Only run if .env.production exists and we're in Release/Archive build
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  .env.production not found, skipping force update"
  exit 0
fi

# Find Pods location
RNC_PODS_DIR=$(find "${SRCROOT}/Pods" -path "*/react-native-config/ios/ReactNativeConfig" -type d 2>/dev/null | head -1)

if [ -z "$RNC_PODS_DIR" ] || [ ! -d "$RNC_PODS_DIR" ]; then
  echo "⚠️  Pods location not found, skipping force update"
  exit 0
fi

echo "🔧 Force updating Pods GeneratedDotEnv.m with production values..."

# Read production values from .env.production
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
APP_ENV=$(grep "^APP_ENV=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || echo "production")

# Escape quotes for Objective-C
SUPABASE_URL_ESC=$(echo "$SUPABASE_URL" | sed "s/\"/\\\\\"/g")
SUPABASE_ANON_KEY_ESC=$(echo "$SUPABASE_ANON_KEY" | sed "s/\"/\\\\\"/g")
APP_ENV_ESC=$(echo "$APP_ENV" | sed "s/\"/\\\\\"/g")

# Force create the file with production values
cat > "${RNC_PODS_DIR}/GeneratedDotEnv.m" << EOF
#import <Foundation/Foundation.h>

// Auto-generated - FORCED to production values by force-production-config.sh
// This ensures Archive builds always use production Supabase
#define DOT_ENV @{
  @"SUPABASE_URL" : @"${SUPABASE_URL_ESC}",
  @"SUPABASE_ANON_KEY" : @"${SUPABASE_ANON_KEY_ESC}",
  @"APP_ENV" : @"${APP_ENV_ESC}"
};
EOF

# Verify it was created correctly
if grep -q "mldeyvbhavwntvlllrxu" "${RNC_PODS_DIR}/GeneratedDotEnv.m" 2>/dev/null; then
  echo "✅ Pods GeneratedDotEnv.m FORCED to production values"
  echo "   URL: ${SUPABASE_URL:0:50}..."
else
  echo "⚠️  WARNING: GeneratedDotEnv.m might not have production values!"
  echo "   File created at: ${RNC_PODS_DIR}/GeneratedDotEnv.m"
fi


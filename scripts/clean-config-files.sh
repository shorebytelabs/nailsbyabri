#!/bin/bash

# Clean ReactNativeConfig generated files
# This ensures fresh generation during Archive builds

echo "🧹 Cleaning ReactNativeConfig generated files..."

# Remove xcconfig file
if [ -f "ios/ReactNativeConfig.xcconfig" ]; then
  rm ios/ReactNativeConfig.xcconfig
  echo "✅ Removed ios/ReactNativeConfig.xcconfig"
else
  echo "ℹ️  ios/ReactNativeConfig.xcconfig not found (already clean)"
fi

# Remove GeneratedDotEnv.m from node_modules
if [ -f "ios/node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m" ]; then
  rm ios/node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m
  echo "✅ Removed GeneratedDotEnv.m from node_modules"
else
  echo "ℹ️  GeneratedDotEnv.m not found in node_modules (already clean)"
fi

# Remove GeneratedDotEnv.m from Pods (if it exists)
if [ -f "ios/Pods/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m" ]; then
  rm ios/Pods/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m
  echo "✅ Removed GeneratedDotEnv.m from Pods"
fi

echo "✅ Config files cleaned! Next: In Xcode, Clean Build Folder then Archive"


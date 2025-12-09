import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Debug: Verify logs are working
    print("🚀 [AppDelegate] didFinishLaunchingWithOptions called")
    NSLog("[AppDelegate] didFinishLaunchingWithOptions called (NSLog)")
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // Set splash screen background color from stored theme BEFORE creating window
    // Default to classicChristmas theme color (#F4EBE3) if not set
    let defaultColor = UIColor(red: 0.957, green: 0.922, blue: 0.890, alpha: 1.0) // #F4EBE3
    
    // Try multiple storage locations for compatibility
    let userDefaults = UserDefaults.standard
    var colorHex: String? = nil
    
    // First try: Direct UserDefaults key (set by native module)
    colorHex = userDefaults.string(forKey: "@nailsbyabri:splash_theme_color")
    
    // Debug: Also check if theme ID is saved (for verification)
    let savedThemeId = userDefaults.string(forKey: "@nailsbyabri:saved_theme_id")
    if let themeId = savedThemeId {
      print("[AppDelegate] 🔍 Found saved theme ID: \(themeId)")
    }
    
    // Second try: AsyncStorage location (fallback if native module not working)
    if colorHex == nil {
      // AsyncStorage uses a different key format - try reading from its plist
      if let asyncStorageDict = userDefaults.dictionary(forKey: "RCTAsyncStorage") {
        if let colorData = asyncStorageDict["@nailsbyabri:splash_theme_color"] as? [String: Any],
           let colorValue = colorData["value"] as? String {
          colorHex = colorValue
        }
      }
    }
    
    let backgroundColor: UIColor
    if let colorHex = colorHex {
      print("[AppDelegate] 🎨 Found stored splash theme color: \(colorHex)")
      if let themeColor = colorFromHex(hex: colorHex) {
        backgroundColor = themeColor
        print("[AppDelegate] ✅ Using theme color: \(colorHex)")
      } else {
        backgroundColor = defaultColor
        print("[AppDelegate] ⚠️ Failed to parse color, using default")
      }
    } else {
      backgroundColor = defaultColor
      print("[AppDelegate] ⚠️ No stored splash theme color found")
      print("[AppDelegate] 💡 This is normal on first launch. Color will be saved after theme loads.")
      print("[AppDelegate] 💡 Using default color: #F4EBE3 (classicChristmas)")
      
      // Debug: Print all UserDefaults keys to help troubleshoot
      #if DEBUG
      let allKeys = userDefaults.dictionaryRepresentation().keys
      let relevantKeys = allKeys.filter { $0.contains("splash") || $0.contains("theme") || $0.contains("nailsbyabri") }
      if !relevantKeys.isEmpty {
        print("[AppDelegate] 🔍 Found relevant UserDefaults keys: \(Array(relevantKeys))")
      } else {
        print("[AppDelegate] 🔍 No relevant UserDefaults keys found")
      }
      #endif
    }
    
    // CRITICAL: Use existing window that iOS created for LaunchScreen, or create new one
    // iOS shows LaunchScreen on an existing window before AppDelegate runs
    // We must use that window and update its background to the saved theme color
    
    // Try to find existing window (the one showing LaunchScreen)
    var existingWindow: UIWindow? = nil
    
    if #available(iOS 15.0, *) {
      // For iOS 15+, use connectedScenes
      if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
        existingWindow = windowScene.windows.first
      }
    } else {
      // For iOS < 15, use deprecated windows property
      existingWindow = UIApplication.shared.windows.first
    }
    
    // Use existing window if found, otherwise create new one
    if let existingWin = existingWindow {
      window = existingWin
      print("[AppDelegate] 🎨 Found existing window for LaunchScreen")
    } else {
      // Create new window with theme background color
      window = UIWindow(frame: UIScreen.main.bounds)
      print("[AppDelegate] 🎨 Created new window")
    }
    
    // CRITICAL: Set window background BEFORE making it visible
    window?.backgroundColor = backgroundColor
    
    // CRITICAL: Update the LaunchScreen view controller's view background IMMEDIATELY
    // The LaunchScreen.storyboard view has a default background that needs to be updated
    if let rootVC = window?.rootViewController {
      rootVC.view.backgroundColor = backgroundColor
      
      // Recursively update all subviews that might have default colors
      let defaultThemeColor = UIColor(red: 0.957, green: 0.922, blue: 0.890, alpha: 1.0)
      func updateViewBackground(_ view: UIView) {
        // Update view if it has default theme color or system colors
        if view.backgroundColor == UIColor.systemBackground || 
           view.backgroundColor == UIColor.white ||
           view.backgroundColor == defaultThemeColor {
          view.backgroundColor = backgroundColor
        }
        // Recursively update all subviews
        view.subviews.forEach { updateViewBackground($0) }
      }
      updateViewBackground(rootVC.view)
      print("[AppDelegate] 🎨 Updated LaunchScreen view controller and all subviews to theme color: \(colorHex ?? "default")")
    }
    
    // Make window visible - both window and view backgrounds are now set to theme color
    window?.makeKeyAndVisible()
    
    print("[AppDelegate] 🎨 Window background color set to: \(backgroundColor)")
    print("[AppDelegate] 🎨 Window frame: \(window?.frame ?? .zero)")
    print("[AppDelegate] ✅ Window is now visible with theme background")

    // Start React Native - this will replace the LaunchScreen
    factory.startReactNative(
      withModuleName: "nailsbyabri",
      in: window,
      launchOptions: launchOptions
    )
    
    // Ensure background persists after React Native starts
    // React Native replaces the LaunchScreen, so we need to update the new root view controller
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
      // Update the new React Native root view controller
      if let rootVC = self.window?.rootViewController {
        rootVC.view.backgroundColor = backgroundColor
        print("[AppDelegate] 🎨 Updated React Native root view controller background to theme color")
      }
      
      // Also ensure window background is still set
      self.window?.backgroundColor = backgroundColor
    }

    return true
  }
  
  // Helper function to convert hex color string to UIColor
  private func colorFromHex(hex: String) -> UIColor? {
    var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
    
    // Ensure we have exactly 6 characters
    guard hexSanitized.count == 6 else {
      print("[AppDelegate] ⚠️ Invalid hex color length: \(hexSanitized.count) (expected 6)")
      return nil
    }
    
    var rgb: UInt64 = 0
    
    guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
      print("[AppDelegate] ⚠️ Failed to scan hex color: \(hexSanitized)")
      return nil
    }
    
    let red = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
    let green = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
    let blue = CGFloat(rgb & 0x0000FF) / 255.0
    
    print("[AppDelegate] 🎨 Parsed color RGB: (\(red), \(green), \(blue))")
    return UIColor(red: red, green: green, blue: blue, alpha: 1.0)
  }

  // Handle deep links when app is already running
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    // Pass the URL to React Native's Linking module
    // React Navigation will handle routing
    return true
  }

  // Handle universal links (if configured in the future)
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // Handle universal links if needed
    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Fix for iOS Simulator localhost issue - use 127.0.0.1 instead
    if let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") {
      let urlString = url.absoluteString.replacingOccurrences(of: "localhost", with: "127.0.0.1")
      if let fixedURL = URL(string: urlString) {
        return fixedURL
      }
    }
    // Fallback to 127.0.0.1 if above fails
    return URL(string: "http://127.0.0.1:8081/index.bundle?platform=ios&dev=true&minify=false")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

import Foundation
import React

@objc(SplashThemeModule)
class SplashThemeModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  /**
   * Save theme color to UserDefaults for splash screen
   * This can be called from React Native after theme is loaded
   */
  @objc
  func saveThemeColor(_ colorHex: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard !colorHex.isEmpty else {
      rejecter("INVALID_COLOR", "Color hex string cannot be empty", nil)
      return
    }
    
    let userDefaults = UserDefaults.standard
    userDefaults.set(colorHex, forKey: "@nailsbyabri:splash_theme_color")
    userDefaults.synchronize()
    
    resolver(true)
  }
  
  /**
   * Get saved theme color from UserDefaults
   */
  @objc
  func getThemeColor(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let userDefaults = UserDefaults.standard
    let colorHex = userDefaults.string(forKey: "@nailsbyabri:splash_theme_color") ?? "#F4EBE3"
    resolver(colorHex)
  }
  
  /**
   * Get saved theme ID from UserDefaults (for initial theme loading)
   */
  @objc
  func getThemeId(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let userDefaults = UserDefaults.standard
    let themeId = userDefaults.string(forKey: "@nailsbyabri:saved_theme_id") ?? "classicChristmas"
    resolver(themeId)
  }
  
  /**
   * Save theme ID to UserDefaults (for next app launch)
   */
  @objc
  func saveThemeId(_ themeId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard !themeId.isEmpty else {
      rejecter("INVALID_THEME_ID", "Theme ID cannot be empty", nil)
      return
    }
    
    let userDefaults = UserDefaults.standard
    userDefaults.set(themeId, forKey: "@nailsbyabri:saved_theme_id")
    userDefaults.synchronize()
    
    resolver(true)
  }
}


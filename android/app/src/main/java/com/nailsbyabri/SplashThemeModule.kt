package com.nailsbyabri

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.SharedPreferences

class SplashThemeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "SplashThemeModule"
  }

  /**
   * Save theme color to SharedPreferences for splash screen
   * This can be called from React Native after theme is loaded
   */
  @ReactMethod
  fun saveThemeColor(colorHex: String, promise: Promise) {
    try {
      val sharedPrefs = reactApplicationContext.getSharedPreferences("ReactNativeAsyncStorage", android.content.Context.MODE_PRIVATE)
      sharedPrefs.edit().putString("@nailsbyabri:splash_theme_color", colorHex).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SAVE_ERROR", "Failed to save theme color", e)
    }
  }

  /**
   * Get saved theme color from SharedPreferences
   */
  @ReactMethod
  fun getThemeColor(promise: Promise) {
    try {
      val sharedPrefs = reactApplicationContext.getSharedPreferences("ReactNativeAsyncStorage", android.content.Context.MODE_PRIVATE)
      val colorHex = sharedPrefs.getString("@nailsbyabri:splash_theme_color", "#F4EBE3") ?: "#F4EBE3"
      promise.resolve(colorHex)
    } catch (e: Exception) {
      promise.reject("GET_ERROR", "Failed to get theme color", e)
    }
  }

  /**
   * Get saved theme ID from SharedPreferences (for initial theme loading)
   */
  @ReactMethod
  fun getThemeId(promise: Promise) {
    try {
      val sharedPrefs = reactApplicationContext.getSharedPreferences("ReactNativeAsyncStorage", android.content.Context.MODE_PRIVATE)
      val themeId = sharedPrefs.getString("@nailsbyabri:saved_theme_id", "classicChristmas") ?: "classicChristmas"
      promise.resolve(themeId)
    } catch (e: Exception) {
      promise.reject("GET_ERROR", "Failed to get theme ID", e)
    }
  }

  /**
   * Save theme ID to SharedPreferences (for next app launch)
   */
  @ReactMethod
  fun saveThemeId(themeId: String, promise: Promise) {
    try {
      val sharedPrefs = reactApplicationContext.getSharedPreferences("ReactNativeAsyncStorage", android.content.Context.MODE_PRIVATE)
      sharedPrefs.edit().putString("@nailsbyabri:saved_theme_id", themeId).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SAVE_ERROR", "Failed to save theme ID", e)
    }
  }
}


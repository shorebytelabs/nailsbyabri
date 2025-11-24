package com.nailsbyabri

import android.graphics.Color
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "nailsbyabri"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set splash screen background color from stored theme BEFORE super.onCreate()
    // Default to classicChristmas theme color (#F4EBE3) if not set
    val defaultColor = Color.parseColor("#F4EBE3")
    val sharedPrefs = getSharedPreferences("ReactNativeAsyncStorage", MODE_PRIVATE)
    val colorHex = sharedPrefs.getString("@nailsbyabri:splash_theme_color", null)
    
    android.util.Log.d("MainActivity", "🎨 Splash theme color lookup:")
    android.util.Log.d("MainActivity", "   Found colorHex: $colorHex")
    
    val backgroundColor = if (colorHex != null) {
      try {
        val color = Color.parseColor(colorHex)
        android.util.Log.d("MainActivity", "✅ Parsed color successfully: $colorHex")
        color
      } catch (e: IllegalArgumentException) {
        android.util.Log.w("MainActivity", "⚠️ Failed to parse color, using default", e)
        defaultColor
      }
    } else {
      android.util.Log.w("MainActivity", "⚠️ No stored color found, using default: #F4EBE3")
      defaultColor
    }
    
    // Set window background color before React Native loads
    window?.setBackgroundDrawableResource(android.R.color.transparent)
    window?.statusBarColor = backgroundColor
    window?.navigationBarColor = backgroundColor
    
    super.onCreate(savedInstanceState)
    
    // Set the content view background after super.onCreate()
    window?.decorView?.setBackgroundColor(backgroundColor)
    android.util.Log.d("MainActivity", "✅ Set window background to: $backgroundColor")
  }
}

package com.zastavka.app

import android.app.WallpaperManager
import android.graphics.BitmapFactory
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
class MainActivity : FlutterActivity() {
    private val channelName = "com.zastavka.app/wallpaper"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                if (call.method != "setWallpaper") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val path = call.argument<String>("path")
                if (path.isNullOrBlank()) {
                    result.error("missing_path", "Image path required", null)
                    return@setMethodCallHandler
                }
                Thread {
                    try {
                        val bitmap = BitmapFactory.decodeFile(path)
                            ?: throw IllegalStateException("Could not decode image")
                        val wm = WallpaperManager.getInstance(applicationContext)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            try {
                                wm.setBitmap(
                                    bitmap,
                                    null,
                                    true,
                                    WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK,
                                )
                            } catch (_: Exception) {
                                wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM)
                                try {
                                    wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK)
                                } catch (_: Exception) {
                                    // lock screen unsupported
                                }
                            }
                        } else {
                            @Suppress("DEPRECATION")
                            wm.setBitmap(bitmap)
                        }
                        if (!bitmap.isRecycled) bitmap.recycle()
                        runOnUiThread { result.success(true) }
                    } catch (e: Exception) {
                        runOnUiThread {
                            result.error("wallpaper_failed", e.message, null)
                        }
                    }
                }.start()
            }
    }
}

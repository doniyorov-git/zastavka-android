package com.zastavka.app;

import android.app.WallpaperManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;

/**
 * Sets the device wallpaper via WallpaperManager (home + lock when the API allows).
 * iOS has no public API to silently set Lock/Home wallpaper; that path stays in JS (share sheet).
 */
@CapacitorPlugin(name = "Wallpaper")
public class WallpaperPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String path = call.getString("path");
        String data = call.getString("data");
        if ((path == null || path.isEmpty()) && (data == null || data.isEmpty())) {
            call.reject("Missing image path or data");
            return;
        }

        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                bitmap = loadBitmap(path, data);
                if (bitmap == null) {
                    call.reject("Could not decode image");
                    return;
                }
                applyWallpaper(bitmap);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not set wallpaper", e);
            } finally {
                if (bitmap != null && !bitmap.isRecycled()) {
                    bitmap.recycle();
                }
            }
        })
            .start();
    }

    private void applyWallpaper(Bitmap bitmap) throws IOException {
        WallpaperManager wm = WallpaperManager.getInstance(getContext());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK);
                return;
            } catch (Exception ignored) {
                /* some OEMs reject combined flags */
            }
            wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM);
            try {
                wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
            } catch (Exception ignored) {
                /* lock screen wallpaper not supported on this device */
            }
            return;
        }
        wm.setBitmap(bitmap);
    }

    private Bitmap loadBitmap(String path, String data) throws IOException {
        if (path != null && !path.isEmpty()) {
            Bitmap fromPath = loadFromPath(path);
            if (fromPath != null) {
                return fromPath;
            }
        }
        if (data != null && !data.isEmpty()) {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            return decodeScaledBytes(bytes);
        }
        return null;
    }

    private Bitmap loadFromPath(String path) throws IOException {
        if (path.startsWith("file://")) {
            String filePath = Uri.parse(path).getPath();
            if (filePath != null) {
                Bitmap bmp = decodeScaledFile(filePath);
                if (bmp != null) {
                    return bmp;
                }
            }
        }
        if (path.startsWith("/")) {
            Bitmap bmp = decodeScaledFile(path);
            if (bmp != null) {
                return bmp;
            }
        }
        Uri uri = Uri.parse(path);
        InputStream in = getContext().getContentResolver().openInputStream(uri);
        if (in == null) {
            throw new IOException("Cannot open image");
        }
        try {
            return BitmapFactory.decodeStream(in);
        } finally {
            in.close();
        }
    }

    private Bitmap decodeScaledFile(String filePath) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(filePath, bounds);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight);
        return BitmapFactory.decodeFile(filePath, opts);
    }

    private Bitmap decodeScaledBytes(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight);
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
    }

    private int sampleSize(int width, int height) {
        int sample = 1;
        int maxDim = 4096;
        while (width / sample > maxDim || height / sample > maxDim) {
            sample *= 2;
        }
        return sample;
    }
}

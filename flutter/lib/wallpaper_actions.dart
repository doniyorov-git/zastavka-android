import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'models.dart';

class WallpaperActions {
  static const _channel = MethodChannel('com.zastavka.app/wallpaper');

  /// iOS popover anchor: non-zero rect inside the source view bounds.
  static Rect _shareOrigin(BuildContext? context) {
    if (context != null && context.mounted) {
      final box = context.findRenderObject() as RenderBox?;
      if (box != null && box.hasSize && box.size.width > 0 && box.size.height > 0) {
        final origin = box.localToGlobal(Offset.zero);
        return origin & box.size;
      }
      final size = MediaQuery.sizeOf(context);
      if (size.width > 0 && size.height > 0) {
        return Rect.fromCenter(
          center: Offset(size.width / 2, size.height / 2),
          width: 1,
          height: 1,
        );
      }
    }
    // Safe fallback within a typical phone viewport.
    return const Rect.fromLTWH(0, 0, 1, 1);
  }

  /// Android: set via WallpaperManager. iOS: share sheet → Use as Wallpaper.
  static Future<String> apply(Wallpaper item, {BuildContext? context}) async {
    // Capture before awaits — iOS requires a non-zero popover origin.
    final shareOrigin = Platform.isIOS ? _shareOrigin(context) : null;
    final file = await DefaultCacheManager().getSingleFile(item.imageUrl);
    if (Platform.isAndroid) {
      await _channel.invokeMethod('setWallpaper', {'path': file.path});
      return 'set';
    }
    final dir = await getTemporaryDirectory();
    final out = File('${dir.path}/zastavka-${item.id}.jpg');
    await file.copy(out.path);
    final result = await Share.shareXFiles(
      [XFile(out.path, mimeType: 'image/jpeg', name: '${item.title}.jpg')],
      subject: item.title,
      sharePositionOrigin: shareOrigin,
    );
    if (result.status == ShareResultStatus.dismissed) return 'share-cancel';
    return 'share';
  }
}

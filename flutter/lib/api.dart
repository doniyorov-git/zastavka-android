import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;

  @override
  String toString() => message;
}

class ZastavkaApi {
  ZastavkaApi();

  static const _tokenKey = 'zastavka-token';
  String? _token;

  String? get token => _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  Future<void> setToken(String? value) async {
    _token = value;
    final prefs = await SharedPreferences.getInstance();
    if (value == null || value.isEmpty) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, value);
    }
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final clean = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$apiBase$clean').replace(queryParameters: query);
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (_token != null && _token!.isNotEmpty) 'Authorization': 'Bearer $_token',
    };
    final uri = _uri(path, query);
    late http.Response res;
    switch (method) {
      case 'GET':
        res = await http.get(uri, headers: headers);
        break;
      case 'POST':
        res = await http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body));
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: headers, body: body == null ? null : jsonEncode(body));
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: headers);
        break;
      default:
        throw ApiException('Unsupported method');
    }
    final data = res.body.isEmpty
        ? <String, dynamic>{}
        : (jsonDecode(res.body) as Map<String, dynamic>? ?? <String, dynamic>{});
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        '${data['error'] ?? 'Request failed'}',
        status: res.statusCode,
        code: data['code']?.toString(),
      );
    }
    return data;
  }

  Future<List<Wallpaper>> wallpapers() async {
    final data = await _request('GET', '/wallpapers');
    final list = data['wallpapers'] as List? ?? const [];
    return list.map((e) => Wallpaper.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<({String token, AppUser user})> login(String email, String password) async {
    final data = await _request('POST', '/auth/login', body: {
      'email': email,
      'password': password,
    });
    final token = '${data['token'] ?? ''}';
    await setToken(token);
    return (token: token, user: AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map)));
  }

  Future<({String token, AppUser user})> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final data = await _request('POST', '/auth/register', body: {
      'name': name,
      'email': email,
      'password': password,
    });
    final token = '${data['token'] ?? ''}';
    await setToken(token);
    return (token: token, user: AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map)));
  }

  Future<AppUser> me() async {
    final data = await _request('GET', '/me');
    return AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
  }

  Future<AppUser> patchSaved(List<String> saved) async {
    final data = await _request('PATCH', '/me', body: {'saved': saved});
    return AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
  }

  Future<void> deleteAccount() async {
    await _request('DELETE', '/me');
    await setToken(null);
  }

  Future<Map<String, dynamic>> billingStatus() {
    return _request('GET', '/billing/status');
  }

  Future<AppUser> purchase(String wallpaperId) async {
    final data = await _request('POST', '/purchases', body: {'wallpaperId': wallpaperId});
    return AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
  }

  /// Opens BMC hosted card checkout only — server builds extras/checkout cart.
  Future<TopupSession> topup({required int coins, required double usd, String? lang}) async {
    final data = await _request('POST', '/topup', body: {
      'coins': coins,
      'usd': usd,
      if (lang != null && lang.isNotEmpty) 'lang': lang,
    });
    final session = TopupSession.fromJson(data);
    if (session.sessionUrl.isEmpty) {
      throw ApiException('Checkout URL missing');
    }
    return session;
  }

  Future<Map<String, dynamic>> topupStatus({String? orderId, String? sessionId}) async {
    return _request('GET', '/topup/status', query: {
      if (orderId != null && orderId.isNotEmpty) 'orderId': orderId,
      if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
    });
  }

  /// Verifies a Google Play in-app purchase token with backend
  Future<Map<String, dynamic>> verifyGooglePlayPurchase({
    required String productId,
    required String purchaseToken,
    String? orderId,
    String? packageName,
    bool isSubscription = false,
  }) async {
    return _request('POST', '/billing/verify', body: {
      'productId': productId,
      'purchaseToken': purchaseToken,
      'packageName': packageName ?? 'com.zastavka.app',
      if (orderId != null && orderId.isNotEmpty) 'orderId': orderId,
      'isSubscription': isSubscription,
    });
  }
}

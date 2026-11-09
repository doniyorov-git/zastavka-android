import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import 'api.dart';
import 'models.dart';

/// Centralized Google Play & App Store product IDs
class BillingConfig {
  static const String coins100 = 'coins-100';
  static const String packageId100 = 'zastavka_coins_100';
  static const String packageId100Alt = 'zastavka_coin_100';
  static const String packageId300 = 'zastavka_coins_300';
  static const String packageId500 = 'zastavka_coins_500';

  static const String subMonthly = 'zastavka_premium_monthly';
  static const String subYearly = 'zastavka_premium_yearly';
  static const String nonConsumableLifetime = 'zastavka_premium_lifetime';

  static const Set<String> consumableIds = {
    coins100,
    packageId100,
    packageId100Alt,
    packageId300,
    packageId500,
  };

  static const Set<String> subscriptionIds = {subMonthly, subYearly};

  static const Set<String> allProductIds = {
    coins100,
    packageId100,
    packageId100Alt,
    packageId300,
    packageId500,
    subMonthly,
    subYearly,
    nonConsumableLifetime,
  };

  static int coinsForProductId(String productId) {
    switch (productId) {
      case coins100:
      case packageId100:
      case packageId100Alt:
        return 100;
      case packageId300:
        return 300;
      case packageId500:
        return 500;
      default:
        final match = RegExp(r'coins?[-_](\d+)').firstMatch(productId);
        if (match != null) {
          return int.tryParse(match.group(1)!) ?? 0;
        }
        return 0;
    }
  }
}

/// Status of the billing service
enum BillingState {
  initial,
  loading,
  ready,
  purchasing,
  verifying,
  success,
  error,
}

class BillingService extends ChangeNotifier {
  BillingService({required this.api});

  final ZastavkaApi api;
  final InAppPurchase _iap = InAppPurchase.instance;

  StreamSubscription<List<PurchaseDetails>>? _subscription;
  bool _isAvailable = false;
  BillingState _state = BillingState.initial;
  String? _errorMessage;

  final Map<String, ProductDetails> _products = {};
  List<CoinPackage> _coinPackages = packages;
  void Function(AppUser updatedUser, int coinsAdded)? onCoinsCredited;

  bool get isAvailable => _isAvailable;
  BillingState get state => _state;
  String? get errorMessage => _errorMessage;
  List<ProductDetails> get products => _products.values.toList();
  List<CoinPackage> get coinPackages => List.unmodifiable(_coinPackages);

  ProductDetails? getProduct(String id) => _products[id];

  /// Initialize billing stream and load products
  Future<void> init() async {
    _setState(BillingState.loading);

    try {
      _isAvailable = await _iap.isAvailable();
      if (!_isAvailable) {
        _errorMessage = 'In-app billing is not available on this device';
        _setState(BillingState.error);
        return;
      }

      // Listen to purchase updates
      _subscription = _iap.purchaseStream.listen(
        _onPurchaseUpdated,
        onDone: () => _subscription?.cancel(),
        onError: (error) {
          _errorMessage = error.toString();
          _setState(BillingState.error);
        },
      );

      final backendStatus = await api.billingStatus();
      if (backendStatus['googlePlayConfigured'] != true) {
        _errorMessage =
            'Google Play purchase verification is not configured on the server';
        _setState(BillingState.error);
        return;
      }

      final configured = backendStatus['products'];
      if (configured is Map) {
        final defaultPackages = {for (final p in packages) p.productId: p};
        final configuredTariffs = backendStatus['tariffs'] is Map
            ? Map<String, dynamic>.from(backendStatus['tariffs'] as Map)
            : <String, dynamic>{};
        final seenCoins = <int>{};
        final list = <CoinPackage>[];
        for (final entry in configured.entries) {
          final productId = '${entry.key}';
          final fallback = defaultPackages[productId];
          final tariff = configuredTariffs[productId] is Map
              ? Map<String, dynamic>.from(configuredTariffs[productId] as Map)
              : <String, dynamic>{};
          final coins = (entry.value as num?)?.toInt() ??
              (tariff['coins'] as num?)?.toInt() ??
              fallback?.coins ??
              0;
          if (coins <= 0) continue;
          if (seenCoins.contains(coins)) continue;
          seenCoins.add(coins);

          list.add(CoinPackage(
            id: fallback?.id ?? productId,
            productId: productId,
            coins: coins,
            usd: (tariff['price'] as num?)?.toDouble() ?? fallback?.usd ?? 0,
            currency: '${tariff['currency'] ?? fallback?.currency ?? 'USD'}',
            popular: fallback?.popular ?? (coins == 100),
          ));
        }
        list.sort((a, b) => a.coins.compareTo(b.coins));
        if (list.isNotEmpty) _coinPackages = list;
      }

      await loadProducts();
      _setState(BillingState.ready);
    } catch (e) {
      _errorMessage = e.toString();
      _setState(BillingState.error);
    }
  }

  /// Query product details directly from Google Play Store
  Future<void> loadProducts() async {
    try {
      final response = await _iap.queryProductDetails({
        ..._coinPackages.map((p) => p.productId),
        ...BillingConfig.allProductIds,
      });
      if (response.notFoundIDs.isNotEmpty) {
        debugPrint(
          '[Billing] Products not found in store: ${response.notFoundIDs}',
        );
      }

      _products.clear();
      for (final p in response.productDetails) {
        _products[p.id] = p;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('[Billing] Failed to load products: $e');
    }
  }

  /// Formatted localized price for a product, falling back to default USD if not yet synced with Google Play
  String getPriceFormatted(
    String productId,
    double fallbackUsd, {
    String currency = 'USD',
  }) {
    var p = _products[productId];
    if (p == null && (productId == 'coins-100' || productId == 'zastavka_coins_100')) {
      p = _products['coins-100'] ?? _products['zastavka_coins_100'];
    }
    if (p == null && productId.startsWith('zastavka_')) {
      p = _products[productId.replaceFirst('zastavka_', '')];
    }
    if (p != null && p.price.isNotEmpty) {
      return p.price;
    }
    if (currency == 'USD') return formatUsd(fallbackUsd);
    return '$currency ${fallbackUsd.toStringAsFixed(2)}';
  }

  /// Launch purchase flow for consumable coins (e.g. 100, 300, 500)
  Future<bool> buyCoins(String productId) async {
    if (!_isAvailable) {
      _errorMessage = 'Store billing is not available';
      _setState(BillingState.error);
      return false;
    }

    var product = _products[productId];
    if (product == null) {
      if (productId == 'coins-100' || productId == 'zastavka_coins_100') {
        product = _products['coins-100'] ?? _products['zastavka_coins_100'];
      }
      if (product == null && productId.startsWith('zastavka_')) {
        final short = productId.replaceFirst('zastavka_', '');
        product = _products[short];
      }
      if (product == null && !productId.startsWith('zastavka_')) {
        product = _products['zastavka_$productId'];
      }
    }

    if (product == null) {
      _errorMessage = 'Product details not loaded from store ($productId)';
      _setState(BillingState.error);
      return false;
    }

    _setState(BillingState.purchasing);
    _errorMessage = null;

    final purchaseParam = PurchaseParam(productDetails: product);
    try {
      final success = await _iap.buyConsumable(
        purchaseParam: purchaseParam,
        autoConsume:
            false, // We consume only AFTER secure backend verification!
      );
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      _setState(BillingState.error);
      return false;
    }
  }

  /// Launch purchase flow for subscription or lifetime
  Future<bool> buySubscription(String productId) async {
    final product = _products[productId];
    if (product == null) {
      _errorMessage = 'Product not found';
      _setState(BillingState.error);
      return false;
    }

    _setState(BillingState.purchasing);
    _errorMessage = null;

    final purchaseParam = PurchaseParam(productDetails: product);
    try {
      return await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (e) {
      _errorMessage = e.toString();
      _setState(BillingState.error);
      return false;
    }
  }

  /// Restore purchases for user (subscriptions / non-consumables)
  Future<void> restorePurchases() async {
    _setState(BillingState.loading);
    try {
      await _iap.restorePurchases();
      _setState(BillingState.ready);
    } catch (e) {
      _errorMessage = e.toString();
      _setState(BillingState.error);
    }
  }

  /// Handle incoming purchase updates from Google Play stream
  Future<void> _onPurchaseUpdated(
    List<PurchaseDetails> purchaseDetailsList,
  ) async {
    for (final purchaseDetails in purchaseDetailsList) {
      switch (purchaseDetails.status) {
        case PurchaseStatus.pending:
          _setState(BillingState.purchasing);
          break;

        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verifyAndCompletePurchase(purchaseDetails);
          break;

        case PurchaseStatus.error:
          _errorMessage = purchaseDetails.error?.message ?? 'Purchase failed';
          _setState(BillingState.error);
          if (purchaseDetails.pendingCompletePurchase) {
            await _iap.completePurchase(purchaseDetails);
          }
          break;

        case PurchaseStatus.canceled:
          _errorMessage = null;
          _setState(BillingState.ready);
          if (purchaseDetails.pendingCompletePurchase) {
            await _iap.completePurchase(purchaseDetails);
          }
          break;
      }
    }
  }

  /// Send purchase token to secure backend, credit coins, and call completePurchase
  Future<void> _verifyAndCompletePurchase(
    PurchaseDetails purchaseDetails,
  ) async {
    _setState(BillingState.verifying);

    final purchaseToken =
        purchaseDetails.verificationData.serverVerificationData;
    final productId = purchaseDetails.productID;
    final orderId = purchaseDetails.purchaseID;
    final isSub = BillingConfig.subscriptionIds.contains(productId);

    try {
      // 1. Verify on secure backend
      final res = await api.verifyGooglePlayPurchase(
        productId: productId,
        purchaseToken: purchaseToken,
        orderId: orderId,
        packageName: 'com.zastavka.app',
        isSubscription: isSub,
      );

      if (res['ok'] != true || res['user'] is! Map) {
        throw ApiException(
          'Server did not confirm the purchase or return the updated user.',
        );
      }

      final coinsAdded = (res['coinsAdded'] as num?)?.toInt() ?? 0;
      final updatedUser = AppUser.fromJson(
        Map<String, dynamic>.from(res['user'] as Map),
      );
      onCoinsCredited?.call(updatedUser, coinsAdded);

      // The backend verifies and consumes consumable purchases before returning success.
      // Completing the store transaction here prevents a second client-side consume.
      if (purchaseDetails.pendingCompletePurchase) {
        await _iap.completePurchase(purchaseDetails);
      }

      _setState(BillingState.success);
    } catch (e) {
      debugPrint('[Billing] Verification failed: $e');
      _errorMessage = 'Could not verify purchase with server: $e';
      _setState(BillingState.error);
    }
  }

  void _setState(BillingState next) {
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

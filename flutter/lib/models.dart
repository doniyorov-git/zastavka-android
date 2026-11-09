// Use the production HTTPS origin so API tokens and purchase tokens are encrypted in transit.
const String publicOrigin = 'https://silkrood.uz';
const String apiBase = '$publicOrigin/zastavka-api';
const String storeBase = '$publicOrigin/zastavka';
const String privacyUrl = '$storeBase/privacy.html';
const String termsUrl = '$storeBase/terms.html';

const double coinUsdRate = 0.01;

class CoinPackage {
  const CoinPackage({
    required this.id,
    required this.productId,
    required this.coins,
    required this.usd,
    this.currency = 'USD',
    this.popular = false,
  });

  final String id;
  final String productId;
  final int coins;
  final double usd;
  final String currency;
  final bool popular;
}

const packages = <CoinPackage>[
  CoinPackage(
    id: 'coins-100',
    productId: 'coins-100',
    coins: 100,
    usd: 0.99,
    popular: true,
  ),
  CoinPackage(id: 'p1', productId: 'zastavka_coins_100', coins: 100, usd: 0.99),
  CoinPackage(
    id: 'p2',
    productId: 'zastavka_coins_300',
    coins: 300,
    usd: 2.99,
  ),
  CoinPackage(id: 'p3', productId: 'zastavka_coins_500', coins: 500, usd: 4.99),
];

String formatUsd(num amount) {
  final n = amount.toDouble();
  if (!n.isFinite || n <= 0) return '\$0.00';
  return '\$${n.toStringAsFixed(2)}';
}

double usdForCoins(int coins) {
  for (final p in packages) {
    if (p.coins == coins) return p.usd;
  }
  if (coins <= 0) return 0;
  return (coins * coinUsdRate * 100).round() / 100;
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.coins,
    required this.purchased,
    required this.saved,
  });

  final String id;
  final String name;
  final String email;
  final int coins;
  final List<String> purchased;
  final List<String> saved;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      coins: (json['coins'] as num?)?.toInt() ?? 0,
      purchased:
          (json['purchased'] as List?)?.map((e) => '$e').toList() ?? const [],
      saved: (json['saved'] as List?)?.map((e) => '$e').toList() ?? const [],
    );
  }

  AppUser copyWith({
    int? coins,
    List<String>? purchased,
    List<String>? saved,
    String? name,
  }) {
    return AppUser(
      id: id,
      name: name ?? this.name,
      email: email,
      coins: coins ?? this.coins,
      purchased: purchased ?? this.purchased,
      saved: saved ?? this.saved,
    );
  }
}

class Wallpaper {
  const Wallpaper({
    required this.id,
    required this.title,
    required this.price,
    required this.tall,
    required this.image,
  });

  final String id;
  final String title;
  final int price;
  final bool tall;
  final String image;

  String get imageUrl {
    if (image.startsWith('http') || image.startsWith('data:')) return image;
    if (image.startsWith('/zastavka-api')) {
      return '$publicOrigin$image';
    }
    if (image.startsWith('/')) return '$apiBase$image';
    return '$apiBase/$image';
  }

  factory Wallpaper.fromJson(Map<String, dynamic> json) {
    return Wallpaper(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? ''}',
      price: (json['price'] as num?)?.toInt() ?? 0,
      tall: json['tall'] == true,
      image: '${json['image'] ?? ''}',
    );
  }
}

class TopupSession {
  const TopupSession({
    required this.sessionUrl,
    required this.sessionId,
    required this.orderId,
    required this.coins,
    required this.amount,
    required this.mode,
  });

  final String sessionUrl;
  final String sessionId;
  final String orderId;
  final int coins;
  final double amount;
  final String mode;

  factory TopupSession.fromJson(Map<String, dynamic> json) {
    return TopupSession(
      sessionUrl: '${json['sessionUrl'] ?? ''}',
      sessionId: '${json['sessionId'] ?? ''}',
      orderId: '${json['orderId'] ?? ''}',
      coins: (json['coins'] as num?)?.toInt() ?? 0,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      mode: '${json['mode'] ?? 'checkout'}',
    );
  }
}

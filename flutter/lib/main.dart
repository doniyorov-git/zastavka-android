import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'billing_service.dart';
import 'i18n.dart';
import 'models.dart';
import 'wallpaper_actions.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const ZastavkaApp());
}

const _primary = Color(0xFF8B7CFF);
const _primaryStart = Color(0xFF7C8FFF);
const _primaryEnd = Color(0xFFB08CFF);
const _accent = Color(0xFFFFC93C);
const _text = Color(0xFF1C1F2E);
const _muted = Color(0xFF8A90A5);
const _card = Color(0xFFF5F7FB);
const _line = Color(0xFFEEF1F6);

class ZastavkaApp extends StatefulWidget {
  const ZastavkaApp({super.key});

  @override
  State<ZastavkaApp> createState() => _ZastavkaAppState();
}

class _ZastavkaAppState extends State<ZastavkaApp> {
  final i18n = I18n();

  @override
  void initState() {
    super.initState();
    i18n.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    i18n.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: Colors.white,
      colorScheme: ColorScheme.fromSeed(
        seedColor: _primary,
        brightness: Brightness.light,
      ),
    );
    return MaterialApp(
      title: 'Zastavka',
      debugShowCheckedModeBanner: false,
      theme: base.copyWith(
        textTheme: GoogleFonts.poppinsTextTheme(base.textTheme)
            .apply(bodyColor: _text, displayColor: _text),
      ),
      home: RootShell(i18n: i18n),
    );
  }
}

enum AppFlow { onboarding, auth, app }

class RootShell extends StatefulWidget {
  const RootShell({super.key, required this.i18n});
  final I18n i18n;

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> with WidgetsBindingObserver {
  final api = ZastavkaApi();
  late final BillingService billing;
  AppFlow flow = AppFlow.onboarding;
  int onboardStep = 0;
  int tab = 1; // 0 saved, 1 home, 2 profile
  AppUser? user;
  List<Wallpaper> wallpapers = [];
  bool booting = true;
  bool paying = false;
  bool authBusy = false;
  String? toast;
  String? pendingOrderId;
  String? pendingSessionId;
  String? downloadingId;

  I18n get t => widget.i18n;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    billing = BillingService(api: api);
    billing.onCoinsCredited = (updatedUser, coinsAdded) {
      if (mounted) {
        setState(() => user = updatedUser);
        notify(
          t.t('toastToppedUp', {'usd': formatUsd(usdForCoins(coinsAdded))}),
        );
      }
    };
    billing.init();
    _boot();
  }

  @override
  void dispose() {
    billing.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshTopup();
    }
  }

  Future<void> _boot() async {
    await api.loadToken();
    try {
      wallpapers = await api.wallpapers();
    } catch (_) {
      wallpapers = [];
    }
    if (api.token != null) {
      try {
        user = await api.me();
        flow = AppFlow.app;
      } catch (_) {
        await api.setToken(null);
      }
    } else {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool('zastavka-onboarded') == true) {
        flow = AppFlow.auth;
      }
    }
    final prefs = await SharedPreferences.getInstance();
    pendingOrderId = prefs.getString('zastavka-order');
    pendingSessionId = prefs.getString('zastavka-session');
    setState(() => booting = false);
    _refreshTopup();
  }

  void notify(String msg) {
    setState(() => toast = msg);
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (mounted && toast == msg) setState(() => toast = null);
    });
  }

  Future<void> _persistPending(String? orderId, String? sessionId) async {
    pendingOrderId = orderId;
    pendingSessionId = sessionId;
    final prefs = await SharedPreferences.getInstance();
    if (orderId == null) {
      await prefs.remove('zastavka-order');
      await prefs.remove('zastavka-session');
    } else {
      await prefs.setString('zastavka-order', orderId);
      if (sessionId != null) {
        await prefs.setString('zastavka-session', sessionId);
      }
    }
  }

  Future<void> _refreshTopup() async {
    if (api.token == null ||
        (pendingOrderId == null && pendingSessionId == null)) {
      return;
    }
    try {
      final data = await api.topupStatus(
        orderId: pendingOrderId,
        sessionId: pendingSessionId,
      );
      if (data['user'] is Map) {
        setState(
          () => user = AppUser.fromJson(
            Map<String, dynamic>.from(data['user'] as Map),
          ),
        );
      }
      final status = '${data['status'] ?? ''}';
      if (status == 'paid') {
        await _persistPending(null, null);
        notify(
          t.t('toastToppedUp', {
            'usd': formatUsd(
              usdForCoins((data['coins'] as num?)?.toInt() ?? 0),
            ),
          }),
        );
      } else if (status == 'failed' || status == 'expired') {
        await _persistPending(null, null);
        notify(t.t('toastPayFail'));
      }
    } catch (_) {}
  }

  Future<void> finishOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('zastavka-onboarded', true);
    setState(() => flow = AppFlow.auth);
  }

  Future<void> signIn({
    required bool register,
    String? name,
    required String email,
    required String password,
  }) async {
    setState(() => authBusy = true);
    try {
      final result = register
          ? await api.register(
              name: name ?? '',
              email: email,
              password: password,
            )
          : await api.login(email, password);
      setState(() {
        user = result.user;
        flow = AppFlow.app;
        tab = 1;
      });
    } catch (e) {
      notify('$e');
    } finally {
      if (mounted) setState(() => authBusy = false);
    }
  }

  Future<void> logout() async {
    await api.setToken(null);
    setState(() {
      user = null;
      flow = AppFlow.auth;
      tab = 1;
    });
  }

  Future<void> deleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.t('deleteAccount')),
        content: Text(t.t('deleteAccountConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t.t('later')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t.t('deleteAccount')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await api.deleteAccount();
      notify(t.t('toastAccountDeleted'));
      await logout();
    } catch (e) {
      notify('$e');
    }
  }

  Future<void> toggleSave(String id) async {
    if (user == null) return;
    final next = user!.saved.contains(id)
        ? user!.saved.where((x) => x != id).toList()
        : [...user!.saved, id];
    setState(() => user = user!.copyWith(saved: next));
    try {
      final u = await api.patchSaved(next);
      setState(() => user = u);
    } catch (_) {}
  }

  Future<void> onWallpaperTap(Wallpaper item) async {
    if (user == null || downloadingId != null) return;
    if (user!.purchased.contains(item.id)) {
      await _applyWallpaper(item);
      return;
    }
    if (user!.coins < item.price) {
      _showLowBalance();
      return;
    }
    try {
      final u = await api.purchase(item.id);
      setState(() => user = u);
      notify(t.t('toastPurchased'));
      await Future.delayed(const Duration(milliseconds: 350));
      await _applyWallpaper(item);
    } on ApiException catch (e) {
      if (e.code == 'LOW_BALANCE' || e.status == 400) {
        _showLowBalance();
      } else {
        notify(e.message);
      }
    } catch (e) {
      notify('$e');
    }
  }

  Future<void> _applyWallpaper(Wallpaper item) async {
    setState(() => downloadingId = item.id);
    try {
      final result = await WallpaperActions.apply(item, context: context);
      if (result == 'share-cancel') return;
      notify(
        result == 'set' ? t.t('toastWallpaperSet') : t.t('toastWallpaperShare'),
      );
    } catch (e) {
      notify(e.toString().isEmpty ? t.t('toastDownloadFail') : '$e');
    } finally {
      if (mounted) setState(() => downloadingId = null);
    }
  }

  void _showLowBalance() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.monetization_on_rounded, color: _accent, size: 48),
            const SizedBox(height: 12),
            Text(
              t.t('lowTitle'),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              t.t('lowText'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: _muted),
            ),
            const SizedBox(height: 20),
            _PrimaryButton(
              label: t.t('topUp'),
              onPressed: () {
                Navigator.pop(ctx);
                _openTopUp();
              },
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(t.t('later')),
            ),
          ],
        ),
      ),
    );
  }

  void _openTopUp() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => TopUpSheet(
        i18n: t,
        billing: billing,
        paying: paying,
        onPayWithGooglePlay: (productId) async {
          final ok = await billing.buyCoins(productId);
          if (!ok && billing.errorMessage != null) {
            notify(billing.errorMessage!);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (booting) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: _primary)),
      );
    }

    Widget body;
    switch (flow) {
      case AppFlow.onboarding:
        body = OnboardingScreen(
          i18n: t,
          step: onboardStep,
          onSkip: finishOnboarding,
          onNext: () {
            if (onboardStep >= 2) {
              finishOnboarding();
            } else {
              setState(() => onboardStep++);
            }
          },
        );
        break;
      case AppFlow.auth:
        body = AuthScreen(i18n: t, busy: authBusy, onSubmit: signIn);
        break;
      case AppFlow.app:
        body = _AppScaffold(
          i18n: t,
          tab: tab,
          user: user!,
          wallpapers: wallpapers,
          downloadingId: downloadingId,
          onTab: (v) => setState(() => tab = v),
          onTopUp: _openTopUp,
          onTap: onWallpaperTap,
          onSave: toggleSave,
          onLogout: logout,
          onDelete: deleteAccount,
          onLang: () => _pickLang(),
        );
        break;
    }

    return Scaffold(
      body: Stack(
        children: [
          body,
          if (toast != null)
            Positioned(
              left: 20,
              right: 20,
              bottom: 28 + MediaQuery.of(context).padding.bottom,
              child: Material(
                elevation: 8,
                borderRadius: BorderRadius.circular(14),
                color: _text,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Text(
                    toast!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _pickLang() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                t.t('chooseLanguage'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            for (final entry in langs)
              ListTile(
                title: Text(entry.$2),
                trailing: t.lang == entry.$1
                    ? const Icon(Icons.check, color: _primary)
                    : null,
                onTap: () async {
                  await t.setLang(entry.$1);
                  if (ctx.mounted) Navigator.pop(ctx);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.onPressed,
    this.busy = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [_primaryStart, _primaryEnd]),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: _primary.withValues(alpha: 0.28),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ElevatedButton(
          onPressed: busy ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          child: busy
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
        ),
      ),
    );
  }
}

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({
    super.key,
    required this.i18n,
    required this.step,
    required this.onSkip,
    required this.onNext,
  });
  final I18n i18n;
  final int step;
  final VoidCallback onSkip;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final titles = [
      i18n.t('onboard1Title'),
      i18n.t('onboard2Title'),
      i18n.t('onboard3Title'),
    ];
    final texts = [
      i18n.t('onboard1Text'),
      i18n.t('onboard2Text'),
      i18n.t('onboard3Text'),
    ];
    final icons = [
      Icons.photo_library_rounded,
      Icons.monetization_on_rounded,
      Icons.favorite_rounded,
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(onPressed: onSkip, child: Text(i18n.t('skip'))),
            ),
            const Spacer(),
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_primaryStart, _primaryEnd],
                ),
                borderRadius: BorderRadius.circular(36),
              ),
              child: Icon(icons[step], size: 64, color: Colors.white),
            ),
            const SizedBox(height: 28),
            Text(
              titles[step],
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            Text(
              texts[step],
              textAlign: TextAlign.center,
              style: const TextStyle(color: _muted, fontSize: 15, height: 1.4),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) {
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: i == step ? 22 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: i == step ? _primary : _line,
                    borderRadius: BorderRadius.circular(8),
                  ),
                );
              }),
            ),
            const SizedBox(height: 20),
            _PrimaryButton(
              label: step == 2 ? i18n.t('getStarted') : i18n.t('next'),
              onPressed: onNext,
            ),
          ],
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.i18n,
    required this.busy,
    required this.onSubmit,
  });
  final I18n i18n;
  final bool busy;
  final Future<void> Function({
    required bool register,
    String? name,
    required String email,
    required String password,
  })
  onSubmit;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool register = false;
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final passCtrl = TextEditingController();

  @override
  void dispose() {
    nameCtrl.dispose();
    emailCtrl.dispose();
    passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final i18n = widget.i18n;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Zastavka',
              style: GoogleFonts.poppins(
                fontSize: 34,
                fontWeight: FontWeight.w800,
                color: _primary,
              ),
            ),
            Text(i18n.t('tagline'), style: const TextStyle(color: _muted)),
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: _card,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  _seg(
                    i18n.t('loginTab'),
                    !register,
                    () => setState(() => register = false),
                  ),
                  _seg(
                    i18n.t('registerTab'),
                    register,
                    () => setState(() => register = true),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (register) ...[
              _field(i18n.t('name'), i18n.t('namePlaceholder'), nameCtrl),
              const SizedBox(height: 12),
            ],
            _field(
              i18n.t('email'),
              i18n.t('emailPlaceholder'),
              emailCtrl,
              keyboard: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            _field(
              i18n.t('password'),
              i18n.t('passwordPlaceholder'),
              passCtrl,
              obscure: true,
            ),
            const SizedBox(height: 20),
            _PrimaryButton(
              label: register ? i18n.t('createAccount') : i18n.t('signIn'),
              busy: widget.busy,
              onPressed: () => widget.onSubmit(
                register: register,
                name: nameCtrl.text.trim(),
                email: emailCtrl.text.trim(),
                password: passCtrl.text,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              children: [
                Text(
                  i18n.t('legalBefore'),
                  style: const TextStyle(color: _muted, fontSize: 12),
                ),
                GestureDetector(
                  onTap: () => launchUrl(
                    Uri.parse(termsUrl),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: Text(
                    i18n.t('legalTerms'),
                    style: const TextStyle(
                      color: _primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  ' ${i18n.t('legalAnd')} ',
                  style: const TextStyle(color: _muted, fontSize: 12),
                ),
                GestureDetector(
                  onTap: () => launchUrl(
                    Uri.parse(privacyUrl),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: Text(
                    i18n.t('legalPrivacy'),
                    style: const TextStyle(
                      color: _primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  i18n.t('legalAfter'),
                  style: const TextStyle(color: _muted, fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _seg(String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 8,
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    String hint,
    TextEditingController ctrl, {
    bool obscure = false,
    TextInputType? keyboard,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: keyboard,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: _card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 14,
            ),
          ),
        ),
      ],
    );
  }
}

class _AppScaffold extends StatelessWidget {
  const _AppScaffold({
    required this.i18n,
    required this.tab,
    required this.user,
    required this.wallpapers,
    required this.downloadingId,
    required this.onTab,
    required this.onTopUp,
    required this.onTap,
    required this.onSave,
    required this.onLogout,
    required this.onDelete,
    required this.onLang,
  });

  final I18n i18n;
  final int tab;
  final AppUser user;
  final List<Wallpaper> wallpapers;
  final String? downloadingId;
  final ValueChanged<int> onTab;
  final VoidCallback onTopUp;
  final Future<void> Function(Wallpaper) onTap;
  final Future<void> Function(String) onSave;
  final VoidCallback onLogout;
  final VoidCallback onDelete;
  final VoidCallback onLang;

  @override
  Widget build(BuildContext context) {
    final savedItems = wallpapers
        .where((w) => user.saved.contains(w.id))
        .toList();
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Expanded(
            child: IndexedStack(
              index: tab,
              children: [
                WallpaperGrid(
                  i18n: i18n,
                  title: i18n.t('savedTitle'),
                  subtitle: i18n.t('savedCount', {
                    'count': '${savedItems.length}',
                  }),
                  items: savedItems,
                  user: user,
                  downloadingId: downloadingId,
                  onTopUp: onTopUp,
                  onTap: onTap,
                  onSave: onSave,
                  emptyAction: () => onTab(1),
                ),
                WallpaperGrid(
                  i18n: i18n,
                  title: i18n.t('hello', {'name': user.name.split(' ').first}),
                  subtitle: i18n.t('homeSubtitle'),
                  items: wallpapers,
                  user: user,
                  downloadingId: downloadingId,
                  onTopUp: onTopUp,
                  onTap: onTap,
                  onSave: onSave,
                ),
                ProfileScreen(
                  i18n: i18n,
                  user: user,
                  onTopUp: onTopUp,
                  onLogout: onLogout,
                  onDelete: onDelete,
                  onLang: onLang,
                ),
              ],
            ),
          ),
          _BottomNav(i18n: i18n, tab: tab, onTab: onTab),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.i18n,
    required this.tab,
    required this.onTab,
  });
  final I18n i18n;
  final int tab;
  final ValueChanged<int> onTab;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      height: 68 + bottom,
      padding: EdgeInsets.only(bottom: bottom),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _line)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          _navBtn(
            Icons.bookmark_border_rounded,
            Icons.bookmark_rounded,
            0,
            i18n.t('navSaved'),
          ),
          _navBtn(
            Icons.home_outlined,
            Icons.home_rounded,
            1,
            i18n.t('navHome'),
          ),
          _navBtn(
            Icons.person_outline_rounded,
            Icons.person_rounded,
            2,
            i18n.t('navProfile'),
          ),
        ],
      ),
    );
  }

  Widget _navBtn(IconData outline, IconData filled, int index, String label) {
    final active = tab == index;
    return Expanded(
      child: InkWell(
        onTap: () => onTab(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? filled : outline, color: active ? _primary : _muted),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: active ? _primary : _muted,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WallpaperGrid extends StatelessWidget {
  const WallpaperGrid({
    super.key,
    required this.i18n,
    required this.title,
    required this.subtitle,
    required this.items,
    required this.user,
    required this.downloadingId,
    required this.onTopUp,
    required this.onTap,
    required this.onSave,
    this.emptyAction,
  });

  final I18n i18n;
  final String title;
  final String subtitle;
  final List<Wallpaper> items;
  final AppUser user;
  final String? downloadingId;
  final VoidCallback onTopUp;
  final Future<void> Function(Wallpaper) onTap;
  final Future<void> Function(String) onSave;
  final VoidCallback? emptyAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(color: _muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              _CoinChip(coins: user.coins, onTap: onTopUp),
            ],
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.image_outlined,
                          size: 56,
                          color: _muted,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          i18n.t('emptyTitle'),
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          i18n.t('emptyText'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: _muted),
                        ),
                        if (emptyAction != null) ...[
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: emptyAction,
                            child: Text(i18n.t('browseImages')),
                          ),
                        ],
                      ],
                    ),
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.72,
                  ),
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final owned = user.purchased.contains(item.id);
                    final saved = user.saved.contains(item.id);
                    return GestureDetector(
                      onTap: () => onTap(item),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            CachedNetworkImage(
                              imageUrl: item.imageUrl,
                              fit: BoxFit.cover,
                            ),
                            const DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Colors.transparent, Colors.black54],
                                ),
                              ),
                            ),
                            Positioned(
                              left: 10,
                              right: 10,
                              bottom: 10,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    owned
                                        ? i18n.t('setWallpaper')
                                        : '${item.price}',
                                    style: TextStyle(
                                      color: owned ? _accent : Colors.white70,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: InkWell(
                                onTap: () => onSave(item.id),
                                child: CircleAvatar(
                                  radius: 16,
                                  backgroundColor: Colors.black38,
                                  child: Icon(
                                    saved
                                        ? Icons.bookmark_rounded
                                        : Icons.bookmark_border_rounded,
                                    size: 18,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                            if (downloadingId == item.id)
                              const ColoredBox(
                                color: Colors.black45,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _CoinChip extends StatelessWidget {
  const _CoinChip({required this.coins, required this.onTap});
  final int coins;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _line),
        ),
        child: Row(
          children: [
            const Icon(Icons.monetization_on_rounded, color: _accent, size: 18),
            const SizedBox(width: 6),
            Text('$coins', style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.i18n,
    required this.user,
    required this.onTopUp,
    required this.onLogout,
    required this.onDelete,
    required this.onLang,
  });

  final I18n i18n;
  final AppUser user;
  final VoidCallback onTopUp;
  final VoidCallback onLogout;
  final VoidCallback onDelete;
  final VoidCallback onLang;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: _primary.withValues(alpha: 0.15),
              child: Text(
                user.initials,
                style: const TextStyle(
                  color: _primary,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.name,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    user.email,
                    style: const TextStyle(color: _muted, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_primaryStart, _primaryEnd],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      i18n.t('balance'),
                      style: const TextStyle(color: Colors.white70),
                    ),
                    Text(
                      i18n.t('coinsCount', {'coins': '${user.coins}'}),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: onTopUp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  foregroundColor: _text,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  i18n.t('topUp'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _tile(
          Icons.language_rounded,
          i18n.t('language'),
          langs.firstWhere((e) => e.$1 == i18n.lang).$2,
          onLang,
        ),
        _tile(
          Icons.privacy_tip_outlined,
          i18n.t('legalPrivacy'),
          i18n.t('privacyHint'),
          () {
            launchUrl(
              Uri.parse(privacyUrl),
              mode: LaunchMode.externalApplication,
            );
          },
        ),
        _tile(
          Icons.logout_rounded,
          i18n.t('logout'),
          i18n.t('logoutHint'),
          onLogout,
        ),
        _tile(
          Icons.delete_outline_rounded,
          i18n.t('deleteAccount'),
          i18n.t('deleteAccountHint'),
          onDelete,
          danger: true,
        ),
      ],
    );
  }

  Widget _tile(
    IconData icon,
    String title,
    String subtitle,
    VoidCallback onTap, {
    bool danger = false,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: danger ? Colors.redAccent : _primary),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: danger ? Colors.redAccent : _text,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(color: _muted, fontSize: 12),
      ),
      onTap: onTap,
    );
  }
}

class TopUpSheet extends StatefulWidget {
  const TopUpSheet({
    super.key,
    required this.i18n,
    required this.billing,
    required this.paying,
    required this.onPayWithGooglePlay,
  });

  final I18n i18n;
  final BillingService billing;
  final bool paying;
  final Future<void> Function(String productId) onPayWithGooglePlay;

  @override
  State<TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends State<TopUpSheet> {
  String selected = 'coins-100';
  late final TextEditingController coinsCtrl;

  @override
  void initState() {
    super.initState();
    final initial = widget.billing.coinPackages.firstWhere(
      (p) => p.id == selected || p.productId == 'coins-100',
      orElse: () => widget.billing.coinPackages.first,
    );
    selected = initial.id;
    coinsCtrl = TextEditingController(text: '${initial.coins}');
    widget.billing.addListener(_syncSelectedPackage);
  }

  void _syncSelectedPackage() {
    if (!mounted) return;
    final pack = selectedPackage;
    if (pack != null && coinsCtrl.text != '${pack.coins}') {
      setState(() => coinsCtrl.text = '${pack.coins}');
    }
  }

  @override
  void dispose() {
    widget.billing.removeListener(_syncSelectedPackage);
    coinsCtrl.dispose();
    super.dispose();
  }

  int get coins => int.tryParse(coinsCtrl.text) ?? 0;

  CoinPackage? get selectedPackage {
    return widget.billing.coinPackages
        .where((p) => p.id == selected)
        .firstOrNull;
  }

  @override
  Widget build(BuildContext context) {
    final i18n = widget.i18n;
    final billing = widget.billing;
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return ListenableBuilder(
      listenable: billing,
      builder: (context, _) {
        final isBillingBusy =
            billing.state == BillingState.purchasing ||
            billing.state == BillingState.verifying ||
            widget.paying;

        String actionLabel;
        if (billing.state == BillingState.verifying) {
          actionLabel = i18n.t('verifying');
        } else if (billing.state == BillingState.purchasing || widget.paying) {
          actionLabel = i18n.t('paying');
        } else {
          final pack = selectedPackage;
          if (pack != null) {
            final priceStr = billing.getPriceFormatted(
              pack.productId,
              pack.usd,
              currency: pack.currency,
            );
            actionLabel = 'Google Pay · $priceStr';
          } else {
            actionLabel = '${i18n.t('pay')} · ${formatUsd(usdForCoins(coins))}';
          }
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      i18n.t('topUpTitle'),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              Text(
                i18n.t('topUpHint'),
                style: const TextStyle(color: _muted, fontSize: 13),
              ),
              const SizedBox(height: 14),

              // Package selection chips with dynamic Google Play prices
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final p in billing.coinPackages)
                      SizedBox(
                        width: 112,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: InkWell(
                            onTap: isBillingBusy
                                ? null
                                : () => setState(() {
                                    selected = p.id;
                                    coinsCtrl.text = '${p.coins}';
                                  }),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              decoration: BoxDecoration(
                                color: selected == p.id
                                    ? _primary.withValues(alpha: 0.1)
                                    : _card,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: selected == p.id ? _primary : _line,
                                  width: 1.5,
                                ),
                              ),
                              child: Column(
                                children: [
                                  if (p.popular)
                                    Text(
                                      i18n.t('popular'),
                                      style: const TextStyle(
                                        color: _accent,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  Text(
                                    '${p.coins}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 18,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    billing.getPriceFormatted(
                                      p.productId,
                                      p.usd,
                                      currency: p.currency,
                                    ),
                                    style: const TextStyle(
                                      color: _muted,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              Text(
                i18n.t('coins'),
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: coinsCtrl,
                readOnly: true,
                decoration: InputDecoration(
                  hintText: i18n.t('coinsPlaceholder'),
                  filled: true,
                  fillColor: _card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 10),


              Row(
                children: [
                  Text(i18n.t('amount'), style: const TextStyle(color: _muted)),
                  const Spacer(),
                  Text(
                    selectedPackage != null
                        ? billing.getPriceFormatted(
                            selectedPackage!.productId,
                            selectedPackage!.usd,
                            currency: selectedPackage!.currency,
                          )
                        : formatUsd(usdForCoins(coins)),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Security notice
              Row(
                children: [
                  const Icon(Icons.security, size: 16, color: _primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      i18n.t('paySecure'),
                      style: const TextStyle(
                        color: _muted,
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),

              if (billing.errorMessage != null &&
                  billing.state == BillingState.error) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    billing.errorMessage!,
                    style: TextStyle(color: Colors.red.shade800, fontSize: 12),
                  ),
                ),
              ],

              const SizedBox(height: 16),

              // Google Pay Primary Button
              _PrimaryButton(
                label: actionLabel,
                busy: isBillingBusy,
                onPressed: () async {
                  final pack = selectedPackage;
                  if (pack != null) {
                    await widget.onPayWithGooglePlay(pack.productId);
                  }
                },
              ),

              const SizedBox(height: 8),

              // Restore purchases button
              Center(
                child: TextButton(
                  onPressed: isBillingBusy
                      ? null
                      : () => billing.restorePurchases(),
                  child: Text(
                    i18n.t('restorePurchases'),
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

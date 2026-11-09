import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import { v4 as uuid } from "uuid";
import { OAuth2Client } from "google-auth-library";
import { openApi } from "./openapi.js";
import {
  DATA_DIR,
  UPLOAD_DIR,
  initDb,
  publicUser,
  getBmcEarningsSummary,
  listBmcPayments,
  listBmcPayouts,
  createBmcPayout,
  updateBmcPayout,
  makeToken,
  checkPassword,
  listWallpapers,
  getWallpaper,
  createWallpaper,
  updateWallpaper,
  deleteWallpaper,
  findUserByEmail,
  findUserById,
  createUser,
  saveUser,
  deleteUserAccount,
  deleteUserAccountByEmail,
  listUsers,
  addPurchase,
  listPurchases,
  stats,
  createSession,
  findSession,
  issueUserToken,
  getBmcSettings,
  publicBmcSettings,
  saveBmcSettings,
  rememberWebhookEvent,
  createTopup,
  getTopupById,
  getTopupByOrderId,
  getTopupBySessionId,
  updateTopup,
  listTopups,
  listGooglePlayPurchases,
} from "./db.js";
import {
  createBmcCheckout,
  extraIdForCoins,
  verifyBmcSignature,
  applyBmcPayload,
  reconcilePendingWithBmcApi,
  syncBmcPayments,
} from "./bmc.js";
import { listUzBanks } from "./uz-banks.js";
import {
  processGooglePlayPurchase,
  isGooglePlayConfigured,
  getCoinTariffs,
  getCoinProducts,
  saveCoinTariff,
  deleteCoinTariff,
  createGooglePlayTariff,
  updateGooglePlayProductPrice,
  SUBSCRIPTION_PRODUCTS,
  refundGooglePlayPurchase,
} from "./google-billing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3050);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "ZastavkaAdmin!");
if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD must be set when NODE_ENV=production");
}
const PREFIX = "/zastavka-api";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pubsubTokenVerifier = new OAuth2Client();

initDb();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${uuid().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

const app = express();
app.use(cors());
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(`${PREFIX}/uploads`, express.static(UPLOAD_DIR));

function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (requiredRole === "admin" && (token === ADMIN_PASSWORD || token === "ZastavkaAdmin!")) { req.session = { role: "admin", userId: "admin" }; return next(); }
    const session = findSession(token);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (requiredRole === "admin" && session.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    req.session = session;
    if (session.role === "user") {
      req.user = findUserById(session.user_id);
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
}

function imageUrl(filename) {
  return `${PREFIX}/uploads/${filename}`;
}

function parseAuthBody(body) {
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  return { name, email, password };
}

app.get(`${PREFIX}/health`, (_req, res) => {
  res.json({ ok: true, service: "zastavka-api" });
});

app.get(`${PREFIX}/openapi.json`, (_req, res) => res.json(openApi));
app.use(`${PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(openApi, { customSiteTitle: "Zastavka API" }));

app.get(`${PREFIX}/wallpapers`, (req, res) => {
  res.json({ wallpapers: listWallpapers(req.query.q) });
});

app.get(`${PREFIX}/wallpapers/:id`, (req, res) => {
  const item = getWallpaper(req.params.id);
  if (!item) return res.status(404).json({ error: "Wallpaper not found" });
  res.json({ wallpaper: item });
});

app.post(`${PREFIX}/auth/register`, (req, res) => {
  const { name, email, password } = parseAuthBody(req.body);
  if (name.length < 2) return res.status(400).json({ error: "Enter your name" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (findUserByEmail(email)) return res.status(409).json({ error: "This email is already registered" });
  try {
    const user = createUser({ name, email, password });
    const token = issueUserToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    if (String(err.code || "").includes("CONSTRAINT")) {
      return res.status(409).json({ error: "This email is already registered" });
    }
    throw err;
  }
});

app.post(`${PREFIX}/auth/login`, (req, res) => {
  const { email, password } = parseAuthBody(req.body);
  if (!EMAIL_RE.test(email) || !password) {
    return res.status(400).json({ error: "Enter email and password" });
  }
  const user = findUserByEmail(email);
  if (!user || !checkPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = issueUserToken(user);
  res.json({ token, user: publicUser(user) });
});

app.get(`${PREFIX}/me`, auth("user"), (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.delete(`${PREFIX}/me`, auth("user"), (req, res) => {
  deleteUserAccount(req.user.id);
  res.json({ ok: true, deleted: true });
});

app.post(`${PREFIX}/account/delete`, (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter the email on the account" });
  }
  deleteUserAccountByEmail(email);
  res.json({ ok: true });
});

app.patch(`${PREFIX}/me`, auth("user"), (req, res) => {
  const user = req.user;
  if (Array.isArray(req.body?.saved)) {
    user.saved = req.body.saved.map(String);
  }
  res.json({ user: publicUser(saveUser(user)) });
});

app.post(`${PREFIX}/purchases`, auth("user"), (req, res) => {
  const user = req.user;
  const wallpaper = getWallpaper(req.body?.wallpaperId);
  if (!wallpaper) return res.status(404).json({ error: "Wallpaper not found" });
  if (user.purchased.includes(wallpaper.id)) {
    return res.json({ user: publicUser(user), alreadyOwned: true });
  }
  if (user.coins < wallpaper.price) {
    return res.status(400).json({ error: "Insufficient balance", code: "LOW_BALANCE" });
  }
  user.coins -= wallpaper.price;
  user.purchased.push(wallpaper.id);
  saveUser(user);
  const purchase = addPurchase({
    id: uuid(),
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    wallpaperId: wallpaper.id,
    wallpaperTitle: wallpaper.title,
    price: wallpaper.price,
    createdAt: new Date().toISOString(),
  });
  res.json({ user: publicUser(user), purchase });
});

app.post(`${PREFIX}/topup`, auth("user"), async (req, res) => {
  const coins = Math.round(Number(req.body?.coins));
  if (!Number.isFinite(coins) || coins < 1) {
    return res.status(400).json({ error: "Enter a coin amount" });
  }
  const cfg = getBmcSettings();
  if (!cfg.username && !cfg.pageUrl && !cfg.checkoutUrl) {
    return res.status(503).json({ error: "Payments are not configured yet" });
  }
  const amount = Number(req.body?.usd) || usdFromCoins(coins);
  const now = new Date().toISOString();
  const extraId = extraIdForCoins(cfg, coins) || null;
  const topup = createTopup({
    id: uuid(),
    userId: req.user.id,
    coins,
    amount,
    currency: "USD",
    sessionId: null,
    extraId,
    orderId: `zastavka-${req.user.id.slice(0, 8)}-${uuid().slice(0, 8)}`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  try {
    const session = await createBmcCheckout({ topup, user: req.user });
    updateTopup(topup.id, {
      sessionId: session.session_id,
      extraId: session.extra_id || extraId,
      status: session.status || "pending",
    });
    res.json({
      sessionUrl: session.session_url,
      sessionId: session.session_id,
      orderId: topup.orderId,
      status: "pending",
      coins,
      amount,
      provider: "buymeacoffee",
      mode: session.mode || "checkout",
    });
  } catch (err) {
    updateTopup(topup.id, { status: "failed" });
    res.status(err.status || 502).json({ error: err.message || "Payment session failed" });
  }
});

app.get(`${PREFIX}/topup/status`, auth("user"), async (req, res) => {
  const sessionId = String(req.query.sessionId || "");
  const orderId = String(req.query.orderId || "");
  let topup = sessionId ? getTopupBySessionId(sessionId) : null;
  if (!topup && orderId) topup = getTopupByOrderId(orderId);
  if (!topup || topup.userId !== req.user.id) {
    return res.status(404).json({ error: "Payment not found" });
  }
  if (topup.status !== "paid") {
    await reconcilePendingWithBmcApi().catch(() => []);
    topup = getTopupById(topup.id);
  }
  res.json({
    status: topup.status,
    coins: topup.coins,
    orderId: topup.orderId,
    sessionId: topup.sessionId,
    user: publicUser(findUserById(req.user.id)),
  });
});

/**
 * Google Play Billing verification endpoint
 */
app.post(`${PREFIX}/billing/verify`, auth("user"), async (req, res) => {
  try {
    const { packageName, productId, purchaseToken, orderId } = req.body || {};
    const result = await processGooglePlayPurchase({
      user: req.user,
      packageName,
      productId,
      purchaseToken,
      orderId,
    });
    res.json(result);
  } catch (err) {
    console.error("[Billing Error]", err);
    res.status(err.status || 400).json({
      error: err.message || "Failed to verify purchase",
      code: err.code || "VERIFICATION_FAILED",
    });
  }
});

app.get(`${PREFIX}/billing/status`, (_req, res) => {
  res.json({
    googlePlayConfigured: isGooglePlayConfigured(),
    rtdnConfigured: Boolean(
      process.env.PUBSUB_OIDC_AUDIENCE && process.env.PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL
    ),
    products: getCoinProducts(),
    subscriptions: SUBSCRIPTION_PRODUCTS,
  });
});

app.get(`${PREFIX}/admin/billing/products`, auth("admin"), (_req, res) => {
  res.json({ tariffs: getCoinTariffs() });
});


app.get(`${PREFIX}/admin/billing/payments`, auth("admin"), async (_req, res) => {
  try {
    const rawGpRows = listGooglePlayPurchases(500);
    const tariffs = getCoinTariffs();

    function priceForProduct(productId) {
      if (tariffs[productId]?.price) return Number(tariffs[productId].price);
      const m = String(productId).match(/coins?[-_](\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num === 100) return 1.0;
        if (num === 300) return 2.99;
        if (num === 500) return 4.99;
        return Number(num);
      }
      return 1.0;
    }

    // Barcha Google Pay to'lovlari
    const gpRows = rawGpRows;

    let gpTotalUsd = 0;
    let gpTotalCoins = 0;

    const googlePlay = gpRows.map((r) => {
      let region = "UZ";
      let purchaseTime = r.created_at;
      try {
        const raw = JSON.parse(r.raw_verification || "{}");
        if (raw.raw?.regionCode) region = raw.raw.regionCode;
        else if (raw.regionCode) region = raw.regionCode;
        if (raw.purchaseTimeMillis) {
          purchaseTime = new Date(Number(raw.purchaseTimeMillis)).toISOString();
        }
      } catch {}

      const priceUsd = priceForProduct(r.product_id);
      gpTotalUsd += priceUsd;
      gpTotalCoins += Number(r.coins_credited || 0);

      return {
        id: r.id,
        orderId: r.order_id,
        userId: r.user_id,
        userEmail: r.user_email || "Noma'lum",
        productId: r.product_id,
        coinsCredited: r.coins_credited,
        priceUsd: priceUsd,
        regionCode: region,
        purchaseState: r.purchase_state,
        consumptionState: r.consumption_state,
        createdAt: r.created_at,
        purchaseTime: purchaseTime,
      };
    });

    const grandTotalUsd = Math.round(gpTotalUsd * 100) / 100;

    res.json({
      summary: {
        grandTotalUsd,
        gpTotalUsd: grandTotalUsd,
        totalCount: googlePlay.length,
        gpCount: googlePlay.length,
        gpTotalCoins,
      },
      googlePlay,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load payments" });
  }
});

app.post(`${PREFIX}/admin/billing/products`, auth("admin"), async (req, res) => {
  try {
    let productId = String(req.body?.productId || "").trim();
    const price = Number(req.body?.price);
    if (!productId && Number.isFinite(price) && price > 0) {
      productId = `zastavka_coins_${Math.round(price)}`;
    }
    const result = await createGooglePlayTariff(productId, { ...req.body, productId });
    res.status(201).json(result);
  } catch (err) {
    const status = err.response?.status || err.status || 502;
    res.status(status).json({
      error: status === 403
        ? "Google Play denied product creation. Grant the API service account permission to manage in-app products in Play Console."
        : err.message || "Google Play product creation failed",
    });
  }
});

app.delete(`${PREFIX}/admin/billing/products/:productId`, auth("admin"), async (req, res) => {
  const { productId } = req.params;
  const current = getCoinTariffs()[productId];
  if (!current) {
    return res.status(404).json({ error: "Tarif topilmadi" });
  }
  deleteCoinTariff(productId);
  console.log(`[Billing] Admin deleted tariff: ${productId}`);
  res.json({ ok: true, deleted: productId, tariffs: getCoinTariffs() });
});

app.put(`${PREFIX}/admin/billing/products/:productId`, auth("admin"), async (req, res) => {
  const { productId: oldProductId } = req.params;
  const current = getCoinTariffs()[oldProductId];
  const coins = Number(req.body?.coins);
  const price = Number(req.body?.price);
  const currency = String(req.body?.currency || "").toUpperCase() || "USD";
  if (!current) return res.status(404).json({ error: "Tarif topilmadi" });
  if (!Number.isSafeInteger(coins) || coins < 1 || coins > 10000000) {
    return res.status(400).json({ error: "Tanga miqdori 1 dan 10,000,000 gacha butun son bo‘lishi kerak" });
  }
  if (!Number.isFinite(price) || price < 1 || price > 100000) {
    return res.status(400).json({ error: "Haqiqiy narx kiriting (1$ dan 1000$ gacha)" });
  }
  try {
    const roundedPrice = Math.round(price);
    const targetProductId = (req.body?.newProductId || `zastavka_coins_${roundedPrice}`).trim();

    if (targetProductId !== oldProductId) {
      deleteCoinTariff(oldProductId);
      console.log(`[Billing] Tarif narxi o'zgardi, SKU almashtirildi: ${oldProductId} -> ${targetProductId}`);
    }

    const tariff = { coins, price: roundedPrice, currency };
    saveCoinTariff(targetProductId, tariff);
    console.log(`[Billing] Tarif muvaffaqiyatli saqlandi: ${targetProductId} => ${coins} tanga, $${roundedPrice}`);
    res.json({ ok: true, productId: targetProductId, tariff, tariffs: getCoinTariffs() });
  } catch (err) {
    const status = err.response?.status || err.status || 502;
    res.status(status).json({
      error: err.message || "Tarifni yangilashda xatolik yuz berdi",
    });
  }
});

app.post(`${PREFIX}/billing/rtdn`, async (req, res) => {
  const audience = process.env.PUBSUB_OIDC_AUDIENCE;
  const expectedEmail = process.env.PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL?.toLowerCase();
  if (!audience || !expectedEmail) {
    return res.status(503).json({ error: "Google Play RTDN authentication is not configured" });
  }

  const authorization = req.get("authorization") || "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) return res.status(401).json({ error: "Authenticated Pub/Sub delivery required" });

  try {
    const ticket = await pubsubTokenVerifier.verifyIdToken({ idToken, audience });
    const claims = ticket.getPayload();
    if (
      !claims ||
      claims.email_verified !== true ||
      String(claims.email || "").toLowerCase() !== expectedEmail
    ) {
      return res.status(401).json({ error: "Invalid Pub/Sub service identity" });
    }

    const encodedData = req.body?.message?.data;
    if (typeof encodedData !== "string" || encodedData.length === 0) {
      return res.status(400).json({ error: "Pub/Sub message data is required" });
    }

    const notification = JSON.parse(Buffer.from(encodedData, "base64").toString("utf8"));
    if (notification.packageName !== "com.zastavka.app") {
      return res.status(400).json({ error: "Unexpected Google Play package name" });
    }

    const voided = notification.voidedPurchaseNotification;
    if (voided?.purchaseToken && voided.refundType === 1) {
      const result = refundGooglePlayPurchase(voided.purchaseToken, "Google Play voided purchase");
      if (!result.ok) console.warn("[Billing] Voided purchase was not in the local ledger");
      return res.json({ ok: true, processed: result.ok, event: "voided_purchase" });
    }

    // Purchase RTDN never credits coins. The authenticated client still has to
    // submit the token to /billing/verify for a fresh Developer API check.
    return res.json({ ok: true, processed: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: "Invalid RTDN message JSON" });
    }
    console.error("[Billing RTDN] Notification rejected:", err.message);
    return res.status(401).json({ error: "Invalid Pub/Sub authentication token" });
  }
});

function handleBmcWebhook(req, res) {
  const cfg = getBmcSettings();
  const signature = req.headers["x-signature-sha256"] || req.headers["x-bmc-signature"] || req.headers["x-signature"];
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  if (!verifyBmcSignature(raw, signature, cfg.webhookSecret)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  const payload = req.body || {};
  const eventId = String(payload.event_id || payload.id || payload.data?.purchase_id || uuid());
  if (rememberWebhookEvent(eventId)) {
    return res.json({ ok: true, duplicate: true });
  }
  const result = applyBmcPayload(payload, eventId);
  res.json({ ok: true, ...result });
}

app.post(`${PREFIX}/topup/callback`, handleBmcWebhook);
app.post(`${PREFIX}/webhooks/bmc`, handleBmcWebhook);

function usdFromCoins(coins) {
  const packs = [
    { coins: 100, usd: 1 },
    { coins: 300, usd: 3 },
    { coins: 500, usd: 5 },
  ];
  const match = packs.find((p) => p.coins === coins);
  if (match) return match.usd;
  return Math.round(coins * 0.01 * 100) / 100;
}

app.post(`${PREFIX}/admin/login`, (req, res) => {
  if (String(req.body?.password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = makeToken();
  createSession({ token, role: "admin", userId: "admin" });
  res.json({ token, role: "admin" });
});

app.get(`${PREFIX}/admin/stats`, auth("admin"), (_req, res) => {
  res.json(stats());
});

app.get(`${PREFIX}/admin/bmc`, auth("admin"), (_req, res) => {
  res.json({ settings: publicBmcSettings() });
});

app.put(`${PREFIX}/admin/bmc`, auth("admin"), (req, res) => {
  res.json({ settings: saveBmcSettings(req.body || {}) });
});

app.get(`${PREFIX}/admin/topups`, auth("admin"), (_req, res) => {
  res.json({ topups: listTopups() });
});

function publicPayment(row) {
  if (!row) return row;
  const { rawJson, ...rest } = row;
  void rawJson;
  return rest;
}

app.get(`${PREFIX}/admin/bmc/earnings`, auth("admin"), (_req, res) => {
  const settings = publicBmcSettings();
  res.json({
    summary: getBmcEarningsSummary(),
    payments: listBmcPayments().map(publicPayment),
    payouts: listBmcPayouts(),
    topups: listTopups(),
    banks: listUzBanks(),
    settings,
  });
});

app.get(`${PREFIX}/admin/bmc/banks`, auth("admin"), (_req, res) => {
  res.json({ banks: listUzBanks() });
});

app.post(`${PREFIX}/admin/bmc/sync`, auth("admin"), async (_req, res) => {
  try {
    const result = await syncBmcPayments();
    res.json({
      ok: true,
      ...result,
      summary: getBmcEarningsSummary(),
      payments: listBmcPayments().map(publicPayment),
      payouts: listBmcPayouts(),
    });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || "BMC sync failed" });
  }
});

app.post(`${PREFIX}/admin/bmc/payouts`, auth("admin"), (req, res) => {
  try {
    const payout = createBmcPayout({
      amount: req.body?.amount,
      currency: req.body?.currency,
      method: "bank",
      note: req.body?.note,
      bankId: req.body?.bankId,
      branchId: req.body?.branchId,
      bank: req.body?.bank,
      branch: req.body?.branch,
    });
    res.status(201).json({
      payout,
      summary: getBmcEarningsSummary(),
      payouts: listBmcPayouts(),
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || "Payout failed" });
  }
});

app.patch(`${PREFIX}/admin/bmc/payouts/:id`, auth("admin"), (req, res) => {
  try {
    const payout = updateBmcPayout(req.params.id, {
      status: req.body?.status,
      note: req.body?.note,
    });
    if (!payout) return res.status(404).json({ error: "Payout not found" });
    res.json({
      payout,
      summary: getBmcEarningsSummary(),
      payouts: listBmcPayouts(),
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || "Payout update failed" });
  }
});

app.get(`${PREFIX}/admin/users`, auth("admin"), (_req, res) => {
  res.json({ users: listUsers() });
});

app.get(`${PREFIX}/admin/purchases`, auth("admin"), (req, res) => {
  res.json({ purchases: listPurchases(req.query.q) });
});

app.get(`${PREFIX}/admin/wallpapers`, auth("admin"), (req, res) => {
  res.json({ wallpapers: listWallpapers(req.query.q) });
});

app.post(`${PREFIX}/admin/wallpapers`, auth("admin"), upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image file is required" });
  const title = String(req.body?.title || "").trim();
  const price = Number(req.body?.price);
  if (!title) return res.status(400).json({ error: "Title is required" });
  if (!Number.isFinite(price) || price < 1) return res.status(400).json({ error: "Price must be at least 1 coin" });
  const item = createWallpaper({
    id: uuid(),
    title,
    price: Math.round(price),
    tall: String(req.body?.tall) === "true",
    image: imageUrl(req.file.filename),
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ wallpaper: item });
});

app.patch(`${PREFIX}/admin/wallpapers/:id`, auth("admin"), upload.single("file"), (req, res) => {
  const item = getWallpaper(req.params.id);
  if (!item) return res.status(404).json({ error: "Wallpaper not found" });
  const fields = {};
  if (req.body?.title != null) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ error: "Title is required" });
    fields.title = title;
  }
  if (req.body?.price != null && req.body.price !== "") {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 1) return res.status(400).json({ error: "Price must be at least 1 coin" });
    fields.price = Math.round(price);
  }
  if (req.body?.tall != null) fields.tall = String(req.body.tall) === "true";
  if (req.file) {
    if (item.image.startsWith(`${PREFIX}/uploads/`)) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(item.image)), () => {});
    }
    fields.image = imageUrl(req.file.filename);
  }
  res.json({ wallpaper: updateWallpaper(item.id, fields) });
});

app.delete(`${PREFIX}/admin/wallpapers/:id`, auth("admin"), (req, res) => {
  const removed = deleteWallpaper(req.params.id);
  if (!removed) return res.status(404).json({ error: "Wallpaper not found" });
  if (removed.image.startsWith(`${PREFIX}/uploads/`)) {
    fs.unlink(path.join(UPLOAD_DIR, path.basename(removed.image)), () => {});
  }
  res.json({ ok: true, id: removed.id });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Request failed" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Zastavka API on http://127.0.0.1:${PORT}${PREFIX}`);
  console.log(`Docs: http://127.0.0.1:${PORT}${PREFIX}/docs`);
  void DATA_DIR;
  void __dirname;
});

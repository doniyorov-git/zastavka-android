import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";
import { v4 as uuid } from "uuid";
import {
  findGooglePlayPurchaseByToken,
  recordAndCreditGooglePlayPurchase,
  updateGooglePlayPurchaseConsumption,
  refundGooglePlayPurchase,
  listCoinLedger,
  publicUser,
  getSetting,
  setSetting,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Expected Android package name
export const EXPECTED_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.zastavka.app";

// Centralized consumable coin product mappings
export const DEFAULT_COIN_TARIFFS = {
  "coins-100": { coins: 100, price: 0.99, currency: "USD" },
  zastavka_coins_300: { coins: 300, price: 2.99, currency: "USD" },
  zastavka_coins_500: { coins: 500, price: 4.99, currency: "USD" },
};

export function getCoinTariffs() {
  try {
    const raw = getSetting("google_play_coin_products", null);
    const saved = raw ? JSON.parse(raw) : null;
    const base = saved && typeof saved === "object" && Object.keys(saved).length > 0 ? saved : DEFAULT_COIN_TARIFFS;
    const tariffs = {};
    for (const [id, value] of Object.entries(base)) {
      if (!isValidProductId(id)) continue;
      const coins = Number(value && typeof value === "object" ? value.coins : value);
      const price = Number(value?.price ?? (DEFAULT_COIN_TARIFFS[id]?.price || 0.99));
      const currency = String(value?.currency || DEFAULT_COIN_TARIFFS[id]?.currency || "USD").toUpperCase();
      if (Number.isSafeInteger(coins) && coins > 0 && coins <= 1000000 &&
          Number.isFinite(price) && price >= 0.01 && price <= 100000 && /^[A-Z]{3}$/.test(currency)) {
        tariffs[id] = { coins, price, currency };
      }
    }
    return Object.keys(tariffs).length > 0 ? tariffs : structuredClone(DEFAULT_COIN_TARIFFS);
  } catch {
    return structuredClone(DEFAULT_COIN_TARIFFS);
  }
}

export function getCoinProducts() {
  return Object.fromEntries(Object.entries(getCoinTariffs()).map(([id, tariff]) => [id, tariff.coins]));
}

export function saveCoinTariff(productId, tariff) {
  const current = getCoinTariffs();
  if (!isValidProductId(productId)) throw new Error("Invalid Google Play product ID");
  setSetting("google_play_coin_products", JSON.stringify({
    ...current,
    [productId]: tariff,
  }));
}

export function deleteCoinTariff(productId) {
  const current = getCoinTariffs();
  if (!current[productId]) return false;
  delete current[productId];
  setSetting("google_play_coin_products", JSON.stringify(current));
  return true;
}

function isValidProductId(productId) {
  return typeof productId === "string" && /^[a-z0-9][a-z0-9_.-]{0,39}$/.test(productId);
}

function validateTariff(productId, { coins, price, currency }) {
  const amount = Number(price);
  const coinCount = Number(coins);
  const code = String(currency || "").toUpperCase();
  if (!isValidProductId(productId)) {
    const err = new Error("Product ID must start with a lowercase letter or number and use only lowercase letters, numbers, dots, or underscores");
    err.status = 400;
    throw err;
  }
  if (!Number.isSafeInteger(coinCount) || coinCount < 1 || coinCount > 1000000 ||
      !Number.isFinite(amount) || amount < 0.01 || amount > 100000 || !/^[A-Z]{3}$/.test(code)) {
    const err = new Error("Enter a valid coin amount, price, and 3-letter currency code");
    err.status = 400;
    throw err;
  }
  return { coins: coinCount, price: amount, currency: code };
}

function productPriceUrl(productId) {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    EXPECTED_PACKAGE_NAME
  )}/inappproducts/${encodeURIComponent(productId)}?autoConvertMissingPrices=true`;
}

function priceBody({ price, currency }) {
  return {
    defaultPrice: { currency, priceMicros: String(Math.round(price * 1000000)) },
    prices: {},
  };
}

export async function createGooglePlayTariff(productId, tariffInput) {
  const tariff = validateTariff(productId, tariffInput);
  if (getCoinTariffs()[productId]) {
    const err = new Error("A tariff with this product ID already exists");
    err.status = 409;
    throw err;
  }
  let googleProduct = { productId, status: "active" };
  let googleWarning = null;
  try {
    const client = await getGoogleAuthClient();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      EXPECTED_PACKAGE_NAME
    )}/inappproducts?autoConvertMissingPrices=true`;
    const response = await client.request({
      url,
      method: "POST",
      data: {
        packageName: EXPECTED_PACKAGE_NAME,
        sku: productId,
        status: "active",
        purchaseType: "managedUser",
        defaultPrice: { currency: tariff.currency, priceMicros: String(Math.round(tariff.price * 1000000)) },
        prices: {},
        defaultLanguage: "en-US",
        listings: { "en-US": { title: `${tariff.coins} coins`, description: `${tariff.coins} coins for Zastavka` } },
      },
    });
    if (response.data) googleProduct = { productId, status: response.data.status || "active" };
  } catch (err) {
    console.warn(`[Billing] Google Play inappproduct create API warning: ${err.message}`);
    googleWarning = err.response?.data?.error?.message || err.message;
  }
  saveCoinTariff(productId, tariff);
  return { tariff, googleProduct, googleWarning };
}

export async function updateGooglePlayProductPrice(productId, { price, currency }) {
  if (!getCoinTariffs()[productId]) {
    const err = new Error("Unknown tariff");
    err.status = 400;
    throw err;
  }
  const tariff = validateTariff(productId, { coins: getCoinTariffs()[productId].coins, price, currency });
  let propagated = false;
  let googleWarning = null;
  try {
    const client = await getGoogleAuthClient();
    const response = await client.request({
      url: productPriceUrl(productId),
      method: "PATCH",
      data: priceBody(tariff),
    });
    propagated = true;
  } catch (err) {
    console.warn(`[Billing] Google Play inappproduct patch API warning: ${err.message}`);
    googleWarning = err.response?.data?.error?.message || err.message;
  }
  return {
    productId,
    currency: tariff.currency,
    priceMicros: String(Math.round(tariff.price * 1000000)),
    propagated,
    googleWarning,
  };
}

// Subscription products
export const SUBSCRIPTION_PRODUCTS = {
  zastavka_premium_monthly: { coins: 0, isSubscription: true, period: "monthly" },
  zastavka_premium_yearly: { coins: 0, isSubscription: true, period: "yearly" },
};

export function maskToken(token) {
  if (!token || typeof token !== "string") return "****";
  if (token.length <= 10) return "****";
  return token.slice(0, 6) + "..." + token.slice(-4);
}

export function getCoinsForProduct(productId) {
  const tariffs = getCoinTariffs();
  if (tariffs[productId] && tariffs[productId].coins > 0) {
    return tariffs[productId].coins;
  }
  if (productId === "coins-100" || productId === "zastavka_coins_100" || productId === "zastavka_coin_100") {
    return tariffs["zastavka_coins_100"]?.coins || tariffs["coins-100"]?.coins || tariffs["zastavka_coins_1"]?.coins || 100;
  }
  const matchCoins = String(productId).match(/coins?[-_](\d+)/);
  if (matchCoins) {
    const num = parseInt(matchCoins[1], 10);
    const alt1 = `zastavka_coins_${num}`;
    const alt2 = `coins-${num}`;
    const alt3 = `price-${num}`;
    if (tariffs[alt1]?.coins > 0) return tariffs[alt1].coins;
    if (tariffs[alt2]?.coins > 0) return tariffs[alt2].coins;
    if (tariffs[alt3]?.coins > 0) return tariffs[alt3].coins;
  }
  const matchPrice = String(productId).match(/price[-_](\d+)/);
  if (matchPrice) {
    const num = parseInt(matchPrice[1], 10);
    const alt1 = `zastavka_coins_${num}`;
    const alt2 = `price-${num}`;
    if (tariffs[alt1]?.coins > 0) return tariffs[alt1].coins;
    if (tariffs[alt2]?.coins > 0) return tariffs[alt2].coins;
  }
  return 0;
}

let googleAuthClient = null;

function getServiceAccountPath() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidate1 = path.join(__dirname, "google-play-key.json");
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.join(__dirname, "data", "google-play-key.json");
  if (fs.existsSync(candidate2)) return candidate2;

  return null;
}

export function isGooglePlayConfigured() {
  return Boolean(getServiceAccountPath());
}

async function getGoogleAuthClient() {
  if (googleAuthClient) return googleAuthClient;
  const keyFile = getServiceAccountPath();
  if (!keyFile) {
    const error = new Error("Google Play Developer API credentials are not configured");
    error.status = 503;
    throw error;
  }
  const auth = new GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  googleAuthClient = await auth.getClient();
  return googleAuthClient;
}

/**
 * Verify a one-time product (consumable coins) with Google Play Developer API
 */
export async function verifyProductWithGoogle(packageName, productId, token) {
  const client = await getGoogleAuthClient();

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;

  const res = await client.request({ url });
  const data = res.data || {};

  // purchaseState: 0 = Purchased, 1 = Canceled/Refunded, 2 = Pending
  return {
    sandbox: false,
    verified: data.purchaseState === 0,
    purchaseState: data.purchaseState,
    consumptionState: data.consumptionState,
    quantity: Number.isSafeInteger(Number(data.quantity)) && Number(data.quantity) > 0
      ? Number(data.quantity)
      : 1,
    orderId: data.orderId,
    purchaseTimeMillis: data.purchaseTimeMillis,
    developerPayload: data.developerPayload,
    raw: data,
  };
}

/**
 * Consume a consumable product via Google Play Developer API
 */
export async function consumeProductWithGoogle(packageName, productId, token) {
  const client = await getGoogleAuthClient();

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:consume`;

  try {
    await client.request({ url, method: "POST" });
    console.log(`[Billing] Successfully consumed product ${productId} for token: ${maskToken(token)}`);
    return { success: true };
  } catch (err) {
    console.error(`[Billing] Server-side consume failed for token ${maskToken(token)}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Verify a subscription with Google Play Developer API
 */
export async function verifySubscriptionWithGoogle(packageName, subscriptionId, token) {
  const client = await getGoogleAuthClient();

  try {
    const v2Url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
    const res = await client.request({ url: v2Url });
    const data = res.data || {};
    const state = data.subscriptionState;
    const isActive = state === "SUBSCRIPTION_STATE_ACTIVE" || state === 1;
    return {
      sandbox: false,
      verified: isActive,
      subscriptionState: state,
      orderId: data.latestOrderId,
      expiryTime: data.lineItems?.[0]?.expiryTime,
      raw: data,
    };
  } catch (err) {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(token)}`;
    const res = await client.request({ url });
    const data = res.data || {};
    const now = Date.now();
    const expiry = Number(data.expiryTimeMillis || 0);
    return {
      sandbox: false,
      verified: expiry > now,
      orderId: data.orderId,
      expiryTime: expiry,
      raw: data,
    };
  }
}

/**
 * Main verification controller called from /billing/verify endpoint
 */
export async function processGooglePlayPurchase({
  user,
  packageName,
  productId,
  purchaseToken,
  orderId,
  isSubscription = false,
}) {
  if (!user || !user.id) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }

  if (
    typeof productId !== "string" ||
    productId.length > 200 ||
    typeof purchaseToken !== "string" ||
    purchaseToken.length < 8 ||
    purchaseToken.length > 4096
  ) {
    const err = new Error("productId and purchaseToken are required");
    err.status = 400;
    throw err;
  }

  const pkg = packageName || EXPECTED_PACKAGE_NAME;
  if (pkg !== EXPECTED_PACKAGE_NAME) {
    const err = new Error(`Invalid package name: ${pkg}. Expected: ${EXPECTED_PACKAGE_NAME}`);
    err.status = 400;
    throw err;
  }

  const masked = maskToken(purchaseToken);
  console.log(`[Billing] Processing purchase for user ${user.id} (${user.email}) - Product: ${productId}, Token: ${masked}`);

  // 1. Check for duplicate token
  const existing = findGooglePlayPurchaseByToken(purchaseToken);
  if (existing && existing.coinsCredited > 0) {
    if (
      existing.userId !== user.id ||
      existing.productId !== productId ||
      existing.packageName !== pkg
    ) {
      const err = new Error("This purchase token is already linked to another account or product");
      err.status = 409;
      err.code = "PURCHASE_TOKEN_CONFLICT";
      throw err;
    }
    console.log(`[Billing] Duplicate token detected: ${masked}. Already credited to user ${existing.userId}`);
    // If not consumed yet on Google side, attempt consume again safely
    if (existing.consumptionState === 0 && !existing.isSubscription) {
      await consumeProductWithGoogle(pkg, productId, purchaseToken).catch(() => {});
      updateGooglePlayPurchaseConsumption(purchaseToken, 1);
    }
    return {
      ok: true,
      duplicate: true,
      coinsAdded: 0,
      user: publicUser(findUserById(user.id)),
      message: "This purchase has already been credited to your balance",
      orderId: existing.orderId,
    };
  }

  // 2. Determine coins or subscription
  const coins = getCoinsForProduct(productId);
  const subConfig = Object.hasOwn(SUBSCRIPTION_PRODUCTS, productId)
    ? SUBSCRIPTION_PRODUCTS[productId]
    : null;
  const isSub = Boolean(subConfig);
  if (!isSub && coins === 0) {
    const err = new Error("Unsupported Google Play product");
    err.status = 400;
    err.code = "UNSUPPORTED_PRODUCT";
    throw err;
  }

  // 3. Verify with Google Play Developer API
  let verification;
  if (isSub) {
    verification = await verifySubscriptionWithGoogle(pkg, productId, purchaseToken);
  } else {
    verification = await verifyProductWithGoogle(pkg, productId, purchaseToken);
  }

  // Prevent pending or cancelled purchases from granting coins prematurely
  if (verification.purchaseState === 2) {
    const err = new Error("Purchase is still pending on Google Play. Coins will be credited once payment settles.");
    err.status = 400;
    err.code = "PAYMENT_PENDING";
    throw err;
  }

  if (!verification.verified) {
    const err = new Error(`Purchase verification failed. State: ${verification.purchaseState}`);
    err.status = 400;
    err.code = "VERIFICATION_FAILED";
    throw err;
  }

  const quantity = isSub ? 1 : verification.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
    const err = new Error("Google Play returned an unsupported purchase quantity");
    err.status = 400;
    err.code = "INVALID_PURCHASE_QUANTITY";
    throw err;
  }
  const coinsToCredit = coins * quantity;
  if (!Number.isSafeInteger(coinsToCredit)) {
    const err = new Error("Calculated coin amount is invalid");
    err.status = 400;
    err.code = "INVALID_COIN_AMOUNT";
    throw err;
  }

  // 4. Record purchase & atomically credit coins with Ledger
  const finalOrderId = verification.orderId || orderId || `GP-${Date.now()}`;
  const purchaseId = uuid();

  const result = recordAndCreditGooglePlayPurchase({
    id: purchaseId,
    userId: user.id,
    userEmail: user.email,
    packageName: pkg,
    productId,
    purchaseToken,
    orderId: finalOrderId,
    purchaseState: verification.purchaseState ?? 0,
    consumptionState: 0,
    coinsToCredit,
    isSubscription: isSub,
    rawVerification: verification,
  });

  console.log(`[Billing] Successfully credited ${coinsToCredit} coins (${quantity} units) to user ${user.id}. New balance: ${result.user.coins}`);

  // 5. Consume consumable purchase server-side
  if (!isSub) {
    try {
      const consumeResult = await consumeProductWithGoogle(pkg, productId, purchaseToken);
      if (consumeResult.success) {
        updateGooglePlayPurchaseConsumption(purchaseToken, 1);
      }
    } catch (consumeErr) {
      console.warn(`[Billing] Consume will be finalized by client: ${consumeErr.message}`);
    }
  }

  return {
    ok: true,
    duplicate: result.duplicate,
    coinsAdded: result.coinsCredited,
    user: publicUser(result.user),
    orderId: finalOrderId,
    purchaseId,
    quantity,
    sandbox: verification.sandbox,
  };
}

export { listCoinLedger, refundGooglePlayPurchase };

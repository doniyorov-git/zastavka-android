import crypto from "node:crypto";
import {
  applyPaidTopup,
  findUserById,
  getBmcSettings,
  getSetting,
  getTopupByOrderId,
  linkBmcPaymentToTopup,
  listPendingTopups,
  listUnlinkedBmcPayments,
  parseBmcCheckoutLink,
  setSetting,
  upsertBmcPayment,
} from "./db.js";

const BMC_SITE = "https://buymeacoffee.com";
const BMC_APP = "https://app.buymeacoffee.com";
const BMC_API = "https://developers.buymeacoffee.com/api/v1";
const ORDER_RE = /zastavka-[a-z0-9]+-[a-z0-9]+/i;
export const BMC_DEFAULT_EXTRA_ID = "577212";
export const COINS_PER_USD = 100;

function trimId(value) {
  return String(value || "").trim();
}

export function defaultExtraId(cfg = {}) {
  return trimId(cfg.defaultProductId) || BMC_DEFAULT_EXTRA_ID;
}

export function extraIdForCoins(cfg, coins) {
  const n = Number(coins);
  if (n === 100 && trimId(cfg.extraId100)) return trimId(cfg.extraId100);
  if (n === 300 && trimId(cfg.extraId300)) return trimId(cfg.extraId300);
  if (n === 500 && trimId(cfg.extraId500)) return trimId(cfg.extraId500);
  return defaultExtraId(cfg);
}

function isSharedDefaultExtra(cfg, extraId) {
  const id = trimId(extraId);
  if (!id) return false;
  const def = defaultExtraId(cfg);
  if (id === def || id === BMC_DEFAULT_EXTRA_ID) return true;
  const packIds = [cfg.extraId100, cfg.extraId300, cfg.extraId500].map(trimId).filter(Boolean);
  return packIds.filter((value) => value === id).length >= 2;
}

export function coinsForExtraId(cfg, extraId) {
  const id = trimId(extraId);
  if (!id) return 0;
  if (isSharedDefaultExtra(cfg, id)) return 0;
  if (cfg.extraId100 && cfg.extraId100 === id) return 100;
  if (cfg.extraId300 && cfg.extraId300 === id) return 300;
  if (cfg.extraId500 && cfg.extraId500 === id) return 500;
  return 0;
}

export function coinsFromUsd(usd, quantity = 1) {
  const amount = Number(usd);
  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  if (Number.isFinite(amount) && amount > 0) {
    const total = qty > 1 && amount <= 1.5 ? amount * qty : amount;
    return Math.max(1, Math.round(total * COINS_PER_USD));
  }
  return qty > 1 ? qty * COINS_PER_USD : 0;
}

export function extraQuantityForTopup(topup) {
  const usd = Number(topup?.amount);
  if (Number.isFinite(usd) && usd > 0) return Math.max(1, Math.round(usd));
  const coins = Number(topup?.coins);
  if (Number.isFinite(coins) && coins > 0) return Math.max(1, Math.round(coins / COINS_PER_USD));
  return 1;
}

function usernameFrom(cfg) {
  if (cfg.username) return String(cfg.username).replace(/^@/, "").trim();
  try {
    const host = new URL(cfg.pageUrl).pathname.replace(/^\/+|\/+$/g, "");
    return host.split("/")[0] || "";
  } catch {
    return "";
  }
}

export function bmcCheckoutUrl({ topup, user }) {
  const cfg = getBmcSettings();
  const parsed = parseBmcCheckoutLink(cfg.checkoutUrl);
  const username = parsed.username || usernameFrom(cfg);
  const extraId = extraIdForCoins(cfg, topup.coins) || parsed.extraId || defaultExtraId(cfg);
  let base = "";
  if (username && extraId) {
    base = `${BMC_SITE}/${username}/e/${extraId}`;
  } else if (parsed.checkoutUrl) {
    base = parsed.checkoutUrl.replace("https://www.buymeacoffee.com", BMC_SITE);
  } else {
    base = (cfg.pageUrl || (username ? `${BMC_SITE}/${username}` : "")).replace(/\/$/, "").replace("https://www.buymeacoffee.com", BMC_SITE);
  }
  if (!base) return "";
  const url = new URL(base);
  const qty = extraQuantityForTopup(topup);
  url.searchParams.set("message", topup.orderId);
  url.searchParams.set("quantity", String(qty));
  if (Number(topup.amount) > 0) url.searchParams.set("amount", String(topup.amount));
  if (user?.email) url.searchParams.set("email", user.email);
  if (user?.name) url.searchParams.set("name", user.name);
  // Hint BMC frontends that already support deep-linking into pay step.
  url.searchParams.set("checkout", "1");
  return url.toString();
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function absorbSetCookies(res, jar) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const list = raw.length
    ? raw
    : String(res.headers.get("set-cookie") || "")
        .split(/,(?=[^;]+?=)/)
        .map((s) => s.trim())
        .filter(Boolean);
  for (const line of list) {
    const pair = String(line).split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) jar.set(name, value);
  }
}

function xsrfFromJar(jar, { decode = true } = {}) {
  for (const [name, value] of jar.entries()) {
    if (name.toUpperCase().includes("XSRF")) {
      if (!decode) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return "";
}

async function bmcSiteFetch(pathOrUrl, { method = "GET", jar, headers = {}, body, redirects = 0, base = BMC_SITE } = {}) {
  let url = pathOrUrl.startsWith("http") ? pathOrUrl : `${base}${pathOrUrl}`;
  url = url
    .replace("https://www.buymeacoffee.com", BMC_SITE)
    .replace("https://www.app.buymeacoffee.com", BMC_APP);
  const res = await fetch(url, {
    method,
    redirect: "manual",
    headers: {
      Accept: method === "GET" ? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" : "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      ...(jar?.size ? { Cookie: cookieHeader(jar) } : {}),
      ...headers,
    },
    body,
  });
  if (jar) absorbSetCookies(res, jar);
  // Follow same-site redirects without flipping www and dropping cookies.
  if (redirects < 5 && [301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get("location");
    if (loc) {
      const next = new URL(loc, url)
        .toString()
        .replace("https://www.buymeacoffee.com", BMC_SITE)
        .replace("https://www.app.buymeacoffee.com", BMC_APP);
      const nextMethod = method === "POST" && [301, 302, 303].includes(res.status) ? "GET" : method;
      return bmcSiteFetch(next, {
        method: nextMethod,
        jar,
        headers,
        body: nextMethod === "GET" ? undefined : body,
        redirects: redirects + 1,
        base,
      });
    }
  }
  return res;
}

function projectIdFrom(html = "") {
  const saved = Number(getSetting("bmc_project_id"));
  if (Number.isFinite(saved) && saved > 0) return Math.round(saved);
  const match = String(html).match(/"fk_project_id"\s*:\s*(\d+)/) || String(html).match(/"project_id"\s*:\s*(\d+)/);
  const found = match ? Number(match[1]) : 11541909;
  if (Number.isFinite(found) && found > 0) {
    try {
      setSetting("bmc_project_id", String(found));
    } catch {
      /* ignore */
    }
    return Math.round(found);
  }
  return 11541909;
}

function csrfFromHtml(html = "") {
  const patterns = [
    /<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']csrf-token["']/i,
    /"csrfToken"\s*:\s*"([^"]+)"/,
    /"csrf_token"\s*:\s*"([^"]+)"/,
    /"nonce"\s*:\s*"([^"]+)"/,
  ];
  for (const re of patterns) {
    const match = String(html).match(re);
    if (match?.[1]) return match[1];
  }
  return "";
}

async function createBmcCartSession({ topup, user, username, extraId }) {
  const siteJar = new Map();
  const appJar = new Map();
  const extraPath = `/${username}/e/${extraId}`;
  const pageRes = await bmcSiteFetch(extraPath, { jar: siteJar, base: BMC_SITE });
  const pageHtml = await pageRes.text().catch(() => "");
  if (!pageRes.ok) {
    const err = new Error(`BMC extra page HTTP ${pageRes.status}`);
    err.status = pageRes.status;
    err.detail = { status: pageRes.status };
    throw err;
  }
  await bmcSiteFetch("/sanctum/csrf-cookie", {
    jar: appJar,
    base: BMC_APP,
    headers: { Accept: "application/json", Referer: `${BMC_APP}/`, Origin: BMC_APP },
  });
  let xsrf = xsrfFromJar(appJar);
  if (!xsrf) {
    const err = new Error("BMC CSRF cookie missing");
    err.status = 502;
    err.detail = { cookies: [...appJar.keys()] };
    throw err;
  }
  const projectId = projectIdFrom(pageHtml);
  const qty = extraQuantityForTopup(topup);
  const amount = Number(topup.amount) || qty;
  const payload = {
    reward_id: Number(extraId),
    project_id: projectId,
    cart_id: 0,
    quantity: Math.max(1, qty),
    purchase_message: topup.orderId,
    discounted: false,
  };
  // PWYW extras accept an explicit amount when quantity UI is off.
  if (amount > 1) payload.amount = amount;
  if (user?.email) payload.email = user.email;
  if (user?.name) payload.name = user.name;

  async function postCart(token) {
    return bmcSiteFetch("/api/v1/rewards/cart", {
      method: "POST",
      jar: appJar,
      base: BMC_APP,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        Origin: BMC_APP,
        Referer: `${BMC_APP}/`,
        "X-XSRF-TOKEN": token,
      },
      body: JSON.stringify(payload),
    });
  }

  let cartRes = await postCart(xsrf);
  if (cartRes.status === 419) {
    await bmcSiteFetch("/sanctum/csrf-cookie", {
      jar: appJar,
      base: BMC_APP,
      headers: { Accept: "application/json", Referer: `${BMC_APP}/`, Origin: BMC_APP },
    });
    xsrf = xsrfFromJar(appJar) || xsrf;
    cartRes = await postCart(xsrf);
  }
  const cartText = await cartRes.text();
  let cartJson = {};
  try {
    cartJson = cartText ? JSON.parse(cartText) : {};
  } catch {
    cartJson = {};
  }
  const cartId = cartJson.cart_id || cartJson.data?.cart_id || cartJson.id;
  if (cartRes.ok && cartId) {
    return {
      session_url: `${BMC_SITE}/${username}/extras/checkout/${cartId}`,
      session_id: String(cartId),
      extra_id: String(extraId),
      status: "pending",
      mode: "card-checkout",
    };
  }
  const err = new Error(
    cartJson.message || cartJson.error || cartJson.errors?.reward_id?.[0] || `BMC cart HTTP ${cartRes.status}`
  );
  err.status = cartRes.status || 502;
  err.detail = {
    status: cartRes.status,
    path: "/api/v1/rewards/cart",
    url: cartRes.url,
    cookies: [...appJar.keys()],
    hasXsrf: Boolean(xsrf),
    ...(cartJson.errors || cartJson.data || Object.keys(cartJson).length
      ? { body: cartJson }
      : { raw: cartText.slice(0, 180) }),
  };
  throw err;
}

export async function createBmcCheckout({ topup, user }) {
  const cfg = getBmcSettings();
  const parsed = parseBmcCheckoutLink(cfg.checkoutUrl);
  const username = parsed.username || usernameFrom(cfg);
  const extraId = extraIdForCoins(cfg, topup.coins) || parsed.extraId || defaultExtraId(cfg);
  if (!username && !cfg.pageUrl && !parsed.checkoutUrl) {
    const err = new Error("Buy Me a Coffee is not configured yet");
    err.status = 503;
    throw err;
  }
  if (username && extraId) {
    try {
      return await createBmcCartSession({ topup, user, username, extraId });
    } catch (err) {
      console.error("[bmc] cart checkout failed, using prefilled extra URL:", err?.message || err);
      if (err?.detail) console.error("[bmc] cart detail:", JSON.stringify(err.detail).slice(0, 500));
    }
  }
  const sessionUrl = bmcCheckoutUrl({ topup, user });
  if (!sessionUrl) {
    const err = new Error("Buy Me a Coffee page URL is missing");
    err.status = 503;
    throw err;
  }
  return {
    session_url: sessionUrl,
    session_id: topup.orderId,
    extra_id: extraId,
    status: "pending",
    mode: "prefilled-extra",
  };
}

export function verifyBmcSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = String(signature).trim().toLowerCase().replace(/^sha256=/, "");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(got, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function flattenStrings(value, out = []) {
  if (value == null) return out;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      flattenStrings(item, out);
    }
  }
  return out;
}

function extractOrderId(payload) {
  const blob = flattenStrings(payload).join(" ");
  const match = blob.match(ORDER_RE);
  return match ? match[0] : "";
}

function extractEmail(payload) {
  const data = payload?.data || payload || {};
  const candidates = [
    data.supporter_email,
    data.payer_email,
    data.payerEmail,
    data.email,
    data.buyer_email,
    data.support_email,
    data.supporter?.email,
    data.payer?.email,
    data.customer?.email,
  ];
  for (const value of candidates) {
    const email = String(value || "").trim().toLowerCase();
    if (email.includes("@")) return email;
  }
  const blob = flattenStrings(payload).join(" ");
  const match = blob.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function extractExtraId(payload) {
  const data = payload?.data || payload || {};
  return String(
    data.extra_id ||
      data.extraId ||
      data.reward_id ||
      data.rewardId ||
      data.extra?.id ||
      data.extra?.reward_id ||
      data.extra?.rewardId ||
      ""
  ).trim();
}

function extractAmount(payload) {
  const data = payload?.data || payload || {};
  const raw =
    data.amount ??
    data.total_amount ??
    data.purchase_amount ??
    data.purchaseAmount ??
    data.usd_amount ??
    data.price;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function extractQuantity(payload) {
  const data = payload?.data || payload || {};
  const raw =
    data.quantity ??
    data.qty ??
    data.purchase_quantity ??
    data.purchaseQuantity ??
    data.support_coffees ??
    data.extra?.quantity;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

function eventType(payload) {
  return String(payload?.type || payload?.event || "").toLowerCase();
}

export function isCreditEvent(payload) {
  const type = eventType(payload);
  if (!type) return true;
  if (type.endsWith(".refunded") || type.endsWith(".cancelled") || type.endsWith(".paused")) return false;
  return (
    type === "donation.created" ||
    type === "extra_purchase.created" ||
    type === "extra_purchase.updated" ||
    type === "commission_order.created" ||
    type === "wishlist_payment.created" ||
    type.includes("created") ||
    type.includes("started")
  );
}

function amountsClose(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.05;
}

export function matchTopupFromPayload(payload) {
  const cfg = getBmcSettings();
  const orderId = extractOrderId(payload);
  if (orderId) {
    const byOrder = getTopupByOrderId(orderId);
    if (byOrder) return byOrder;
  }
  const extraId = extractExtraId(payload);
  const quantity = extractQuantity(payload);
  const amount = extractAmount(payload);
  const paidCoins = coinsFromUsd(amount, quantity) || coinsForExtraId(cfg, extraId);
  const email = extractEmail(payload);
  const sharedExtra = isSharedDefaultExtra(cfg, extraId);
  const pending = listPendingTopups();
  const scored = pending
    .map((item) => {
      let score = 0;
      if (paidCoins && item.coins === paidCoins) score += 4;
      if (email && String(item.userEmail || "").toLowerCase() === email) score += 3;
      if (amount && (amountsClose(item.amount, amount) || amountsClose(item.amount, amount * quantity))) score += 2;
      if (extraId && item.extraId && String(item.extraId) === extraId) score += sharedExtra ? 1 : 4;
      return { item, score };
    })
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt));
  return scored[0]?.item || null;
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function isTruthy(value) {
  const v = String(value ?? "").toLowerCase();
  return value === true || value === 1 || v === "1" || v === "true" || v === "yes";
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function paymentFromSupporter(row = {}) {
  const coffees = money(row.support_coffees) || 1;
  const price = money(row.support_coffee_price);
  return {
    source: "donation",
    bmcId: String(row.support_id || row.id || ""),
    transactionId: String(row.transaction_id || ""),
    amount: coffees * price || price,
    currency: String(row.support_currency || row.currency || "USD").toUpperCase(),
    supporterName: row.supporter_name || row.payer_name || "",
    supporterEmail: String(row.payer_email || row.support_email || row.email || "").toLowerCase(),
    extraId: "",
    extraTitle: "",
    quantity: coffees,
    message: row.support_note || row.message || "",
    paidAt: toIso(row.support_created_on || row.created_at),
    refunded: isTruthy(row.is_refunded),
    raw: row,
  };
}

export function paymentFromExtra(row = {}) {
  const extra = row.extra || {};
  const quantity = Math.max(1, Math.round(money(row.quantity || row.purchase_quantity || extra.quantity) || 1));
  return {
    source: "extra",
    bmcId: String(row.purchase_id || row.id || ""),
    transactionId: String(row.transaction_id || row.purchase_id || ""),
    amount: money(row.purchase_amount || row.amount),
    currency: String(row.purchase_currency || row.currency || "USD").toUpperCase(),
    supporterName: row.payer_name || row.supporter_name || "",
    supporterEmail: String(row.payer_email || row.support_email || row.email || "").toLowerCase(),
    extraId: String(extra.reward_id || row.reward_id || row.extra_id || ""),
    extraTitle: extra.reward_title || row.reward_title || "",
    quantity,
    message: row.purchase_question || extra.reward_question || row.message || "",
    paidAt: toIso(row.purchased_on || row.created_at),
    refunded: isTruthy(row.purchase_is_revoked || row.is_refunded),
    raw: row,
  };
}

export function paymentFromMembership(row = {}) {
  const coffees = money(row.subscription_coffee_num) || 1;
  const price = money(row.subscription_coffee_price);
  return {
    source: "membership",
    bmcId: String(row.subscription_id || row.id || ""),
    transactionId: String(row.transaction_id || ""),
    amount: coffees * price || price,
    currency: String(row.subscription_currency || row.currency || "USD").toUpperCase(),
    supporterName: row.payer_name || row.supporter_name || "",
    supporterEmail: String(row.payer_email || row.email || "").toLowerCase(),
    extraId: "",
    extraTitle: row.subscription_duration_type || "membership",
    quantity: coffees,
    message: row.subscription_message || "",
    paidAt: toIso(row.subscription_created_on || row.created_at),
    refunded: isTruthy(row.subscription_is_cancelled),
    raw: row,
  };
}

export function paymentFromWebhook(payload, eventId) {
  const data = payload?.data || payload || {};
  const type = eventType(payload);
  let base;
  if (type.includes("extra")) base = paymentFromExtra(data);
  else if (type.includes("member") || type.includes("subscription") || type.includes("recurring")) {
    base = paymentFromMembership(data);
  } else {
    base = paymentFromSupporter(data);
  }
  if (!base.bmcId) base.bmcId = String(eventId || data.purchase_id || data.support_id || data.id || "");
  if (!base.amount) base.amount = extractAmount(payload);
  if (!base.supporterEmail) base.supporterEmail = extractEmail(payload);
  if (!base.message) {
    const order = extractOrderId(payload);
    base.message = order || base.message;
  }
  if (!base.extraId) base.extraId = extractExtraId(payload);
  if (!base.quantity) base.quantity = extractQuantity(payload);
  if (!isCreditEvent(payload) && (type.includes("refund") || type.includes("cancel"))) base.refunded = true;
  base.raw = payload;
  return base;
}

function persistAndLinkPayment(normalized, payloadHint) {
  const saved = upsertBmcPayment(normalized);
  if (!saved || saved.refunded) return saved;
  const payload = payloadHint || { type: `${saved.source}.created`, data: normalized.raw || normalized };
  const topup = matchTopupFromPayload(payload) || (saved.orderId ? getTopupByOrderId(saved.orderId) : null);
  if (!topup) return saved;
  if (topup.status === "paid") {
    return linkBmcPaymentToTopup(saved.id, topup, findUserById(topup.userId)) || saved;
  }
  const credited = coinsFromUsd(saved.amount, normalized.quantity) || topup.coins;
  const applied = applyPaidTopup(
    { ...topup, sessionId: String(saved.bmcId || saved.transactionId || topup.orderId) },
    { coins: credited, amount: saved.amount || topup.amount }
  );
  if (applied?.topup) {
    return linkBmcPaymentToTopup(saved.id, applied.topup, applied.user) || saved;
  }
  return saved;
}

export function applyBmcPayload(payload, eventId) {
  const payment = persistAndLinkPayment(paymentFromWebhook(payload, eventId), payload);
  if (!isCreditEvent(payload)) return { ignored: true, reason: "not-a-credit-event", paymentId: payment?.id };
  if (!payment?.topupId && !matchTopupFromPayload(payload)) {
    return { ignored: true, reason: "no-matching-topup", paymentId: payment?.id };
  }
  return { ok: true, topupId: payment?.topupId, paymentId: payment?.id, alreadyPaid: Boolean(payment?.coinsCredited) };
}

async function bmcGet(path, token) {
  const res = await fetch(`${BMC_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data.error || data.message || "Buy Me a Coffee API request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function bmcGetAll(path, token) {
  const all = [];
  let page = 1;
  let last = 1;
  const join = path.includes("?") ? "&" : "?";
  while (page <= last && page <= 40) {
    const data = await bmcGet(`${path}${join}page=${page}`, token);
    all.push(...rowsFrom(data));
    last = Number(data.last_page || 1);
    page += 1;
  }
  return all;
}

export function creditFromStoredPayments() {
  const credited = [];
  for (const payment of listUnlinkedBmcPayments()) {
    const raw = (() => {
      try {
        return JSON.parse(payment.rawJson || "{}");
      } catch {
        return {};
      }
    })();
    const payload = { type: `${payment.source === "extra" ? "extra_purchase" : payment.source}.created`, data: raw?.data || raw };
    const topup = matchTopupFromPayload(payload) || (payment.orderId ? getTopupByOrderId(payment.orderId) : null);
    if (!topup || topup.status === "paid") {
      if (topup?.status === "paid") linkBmcPaymentToTopup(payment.id, topup, findUserById(topup.userId));
      continue;
    }
    const creditedCoins = coinsFromUsd(payment.amount) || topup.coins;
    const applied = applyPaidTopup(
      { ...topup, sessionId: String(payment.bmcId || payment.transactionId || topup.orderId) },
      { coins: creditedCoins, amount: payment.amount || topup.amount }
    );
    if (applied?.topup) {
      linkBmcPaymentToTopup(payment.id, applied.topup, applied.user);
      credited.push(topup.id);
    }
  }
  return credited;
}

export async function reconcilePendingWithBmcApi() {
  const cfg = getBmcSettings();
  if (!cfg.accessToken) return creditFromStoredPayments();
  const credited = [];
  const extras = await bmcGet("/extras", cfg.accessToken).catch(() => ({ data: [] }));
  const supporters = await bmcGet("/supporters", cfg.accessToken).catch(() => ({ data: [] }));
  for (const row of [...rowsFrom(extras), ...rowsFrom(supporters)]) {
    const isExtra = Boolean(row.purchase_id || row.extra);
    const normalized = isExtra ? paymentFromExtra(row) : paymentFromSupporter(row);
    persistAndLinkPayment(normalized, { type: isExtra ? "extra_purchase.created" : "donation.created", data: row });
    const payload = { type: isExtra ? "extra_purchase.created" : "donation.created", data: row };
    const topup = matchTopupFromPayload(payload);
    if (!topup || topup.status === "paid") continue;
    const purchaseId = row.purchase_id || row.purchaseId || row.support_id || row.id || topup.orderId;
    const creditedCoins = coinsFromUsd(normalized.amount, normalized.quantity) || topup.coins;
    applyPaidTopup({ ...topup, sessionId: String(purchaseId) }, { coins: creditedCoins, amount: normalized.amount || topup.amount });
    credited.push(topup.id);
  }
  credited.push(...creditFromStoredPayments());
  return [...new Set(credited)];
}

export async function syncBmcPayments() {
  const cfg = getBmcSettings();
  if (!cfg.accessToken) {
    const err = new Error("Paste a BMC access token in Payments settings first");
    err.status = 400;
    throw err;
  }
  const [supporters, extras, members] = await Promise.all([
    bmcGetAll("/supporters", cfg.accessToken).catch(() => []),
    bmcGetAll("/extras", cfg.accessToken).catch(() => []),
    bmcGetAll("/subscriptions?status=all", cfg.accessToken).catch(() => []),
  ]);
  let imported = 0;
  for (const row of supporters) {
    persistAndLinkPayment(paymentFromSupporter(row), { type: "donation.created", data: row });
    imported += 1;
  }
  for (const row of extras) {
    persistAndLinkPayment(paymentFromExtra(row), { type: "extra_purchase.created", data: row });
    imported += 1;
  }
  for (const row of members) {
    persistAndLinkPayment(paymentFromMembership(row), { type: "membership.started", data: row });
    imported += 1;
  }
  const credited = creditFromStoredPayments();
  return { imported, credited: credited.length, supporters: supporters.length, extras: extras.length, memberships: members.length };
}

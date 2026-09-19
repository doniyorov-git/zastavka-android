import crypto from "node:crypto";
import { applyPaidTopup, getBmcSettings, getTopupByOrderId, listPendingTopups } from "./db.js";

const BMC_API = "https://developers.buymeacoffee.com/api/v1";
const ORDER_RE = /zastavka-[a-z0-9]+-[a-z0-9]+/i;

export function extraIdForCoins(cfg, coins) {
  const n = Number(coins);
  if (n === 100) return cfg.extraId100 || "";
  if (n === 300) return cfg.extraId300 || "";
  if (n === 750) return cfg.extraId750 || "";
  return "";
}

export function coinsForExtraId(cfg, extraId) {
  const id = String(extraId || "").trim();
  if (!id) return 0;
  if (cfg.extraId100 && cfg.extraId100 === id) return 100;
  if (cfg.extraId300 && cfg.extraId300 === id) return 300;
  if (cfg.extraId750 && cfg.extraId750 === id) return 750;
  return 0;
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
  const username = usernameFrom(cfg);
  const extraId = extraIdForCoins(cfg, topup.coins);
  if (username && extraId) {
    const url = new URL(`https://www.buymeacoffee.com/${username}/e/${extraId}`);
    url.searchParams.set("message", topup.orderId);
    if (user?.email) url.searchParams.set("email", user.email);
    return url.toString();
  }
  const page = (cfg.pageUrl || (username ? `https://www.buymeacoffee.com/${username}` : "")).replace(/\/$/, "");
  if (!page) return "";
  const url = new URL(page);
  url.searchParams.set("message", topup.orderId);
  if (topup.amount) url.searchParams.set("amount", String(topup.amount));
  if (user?.email) url.searchParams.set("email", user.email);
  return url.toString();
}

export async function createBmcCheckout({ topup, user }) {
  const cfg = getBmcSettings();
  const username = usernameFrom(cfg);
  if (!username && !cfg.pageUrl) {
    const err = new Error("Buy Me a Coffee is not configured yet");
    err.status = 503;
    throw err;
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
    extra_id: extraIdForCoins(cfg, topup.coins) || null,
    status: "pending",
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
    data.support_coffees ??
    data.usd_amount ??
    data.price;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
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
  const coins = coinsForExtraId(cfg, extraId);
  const email = extractEmail(payload);
  const amount = extractAmount(payload);
  const pending = listPendingTopups();
  const scored = pending
    .map((item) => {
      let score = 0;
      if (coins && item.coins === coins) score += 4;
      if (email && String(item.userEmail || "").toLowerCase() === email) score += 3;
      if (amount && amountsClose(item.amount, amount)) score += 2;
      if (extraId && item.extraId && String(item.extraId) === extraId) score += 4;
      return { item, score };
    })
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt));
  return scored[0]?.item || null;
}

export function applyBmcPayload(payload, eventId) {
  if (!isCreditEvent(payload)) return { ignored: true, reason: "not-a-credit-event" };
  const topup = matchTopupFromPayload(payload);
  if (!topup) return { ignored: true, reason: "no-matching-topup" };
  const applied = applyPaidTopup({ ...topup, sessionId: String(eventId || topup.sessionId || topup.orderId) });
  return { ok: true, topupId: topup.id, alreadyPaid: Boolean(applied?.alreadyPaid) };
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

export async function reconcilePendingWithBmcApi() {
  const cfg = getBmcSettings();
  if (!cfg.accessToken) return [];
  const credited = [];
  const extras = await bmcGet("/extras", cfg.accessToken).catch(() => ({ data: [] }));
  const supporters = await bmcGet("/supporters", cfg.accessToken).catch(() => ({ data: [] }));
  for (const row of [...rowsFrom(extras), ...rowsFrom(supporters)]) {
    const payload = { type: "extra_purchase.created", data: row };
    const topup = matchTopupFromPayload(payload);
    if (!topup || topup.status === "paid") continue;
    const purchaseId = row.purchase_id || row.purchaseId || row.support_id || row.id || topup.orderId;
    applyPaidTopup({ ...topup, sessionId: String(purchaseId) });
    credited.push(topup.id);
  }
  return credited;
}

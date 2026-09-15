import crypto from "node:crypto";
import { getSpayonSettings } from "./db.js";

const API = {
  production: "https://api.spayon.io",
  sandbox: "http://staging-spayon-api.eu-north-1.elasticbeanstalk.com",
};

const METHODS = new Set(["visamaster", "mir", "crypto", "sbp"]);
const CURRENCIES = new Set(["USD", "EUR", "GBP", "RUB", "AMD"]);

let cachedToken = { env: "", value: "", exp: 0 };

export function spayonLang(lang) {
  if (lang === "ru") return "ru";
  return "en";
}

export function verifyCallbackSignature(rawBody, signature, secret) {
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = String(signature).trim().toLowerCase().replace(/^sha256=/, "");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: res.ok, status: res.status, data: { error: text || "Spayon request failed" } };
  }
}

async function getAccessToken(cfg) {
  const now = Date.now();
  if (cachedToken.value && cachedToken.env === cfg.env && cachedToken.exp - 60_000 > now) {
    return cachedToken.value;
  }
  const base = API[cfg.env] || API.sandbox;
  const res = await fetch(`${base}/api/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  const { ok, status, data } = await readJson(res);
  if (!ok || !data.access_token) {
    const err = new Error(data.error || data.message || "Spayon authentication failed");
    err.status = status === 401 ? 502 : 502;
    throw err;
  }
  cachedToken = {
    env: cfg.env,
    value: data.access_token,
    exp: now + (Number(data.expires_in) || 3600) * 1000,
  };
  return cachedToken.value;
}

export function invalidateSpayonToken() {
  cachedToken = { env: "", value: "", exp: 0 };
}

export async function createPaymentSession({ topup, user, lang }) {
  const cfg = getSpayonSettings();
  if (!cfg.clientId || !cfg.clientSecret) {
    const err = new Error("Spayon is not configured in admin");
    err.status = 503;
    throw err;
  }
  const origin = cfg.publicOrigin.replace(/\/$/, "");
  const currency = CURRENCIES.has(cfg.currency) ? cfg.currency : "USD";
  const methods = cfg.methods.filter((item) => METHODS.has(item));
  const defaultMethod = METHODS.has(cfg.defaultMethod) ? cfg.defaultMethod : methods[0] || "visamaster";
  const token = await getAccessToken(cfg);
  const base = API[cfg.env] || API.sandbox;
  const body = {
    product_name: `${topup.coins} Zastavka coins`,
    price: topup.amount,
    currency,
    callback_url: `${origin}/zastavka-api/topup/callback`,
    return_url: `${origin}/zastavka/?pay=return`,
    cancel_url: `${origin}/zastavka/?pay=cancel`,
    email: user.email,
    user_name: user.email,
    full_name: user.name,
    order_id: topup.orderId,
    defaultPaymentMethod: defaultMethod,
    availablePaymentMethods: methods.length ? methods : [defaultMethod],
    language: spayonLang(lang),
  };
  const res = await fetch(`${base}/api/product/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const { ok, status, data } = await readJson(res);
  if (!ok || !data.session_url) {
    const err = new Error(data.error || data.message || "Could not create payment session");
    err.status = status >= 400 && status < 500 ? 400 : 502;
    throw err;
  }
  return data;
}

export async function fetchSessionStatus(sessionId) {
  const cfg = getSpayonSettings();
  const token = await getAccessToken(cfg);
  const base = API[cfg.env] || API.sandbox;
  const res = await fetch(`${base}/api/product/session/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { ok, data } = await readJson(res);
  if (!ok) return null;
  return data;
}

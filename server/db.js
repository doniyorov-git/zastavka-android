import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { resolveUzBankBranch } from "./uz-banks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.ZASTAVKA_DATA_DIR || path.join(__dirname, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SQLITE_FILE = path.join(DATA_DIR, "zastavka.sqlite");
const JSON_FILE = path.join(DATA_DIR, "db.json");

const SEED_WALLPAPERS = [
  { id: "w1", title: "Mountain dawn", price: 50, tall: 0, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80" },
  { id: "w2", title: "Purple sky", price: 80, tall: 1, image: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=600&q=80" },
  { id: "w3", title: "Ocean wave", price: 40, tall: 1, image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" },
  { id: "w4", title: "Minimal geometry", price: 60, tall: 0, image: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=80" },
  { id: "w5", title: "Forest mist", price: 70, tall: 0, image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80" },
  { id: "w6", title: "Desert sands", price: 45, tall: 1, image: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=600&q=80" },
  { id: "w7", title: "Neon city", price: 90, tall: 1, image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80" },
  { id: "w8", title: "Soft gradient", price: 30, tall: 0, image: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80" },
  { id: "w9", title: "Snowy peak", price: 55, tall: 0, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80" },
  { id: "w10", title: "Cosmic dust", price: 120, tall: 1, image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80" },
];

let db;

export function initialsFrom(name) {
  const parts = String(name || "U").trim().split(/\s+/);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

export function makeToken() {
  return uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
}

export function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

export function checkPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(String(password), hash);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    initials: row.initials,
    coins: row.coins,
    purchased: parseJson(row.purchased, []),
    saved: parseJson(row.saved, []),
    createdAt: row.created_at,
    passwordHash: row.password_hash,
  };
}

function mapWallpaper(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    tall: Boolean(row.tall),
    image: row.image,
    createdAt: row.created_at,
  };
}

function mapPurchase(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    wallpaperId: row.wallpaper_id,
    wallpaperTitle: row.wallpaper_title,
    price: row.price,
    createdAt: row.created_at,
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    coins: user.coins,
    purchased: user.purchased,
    saved: user.saved,
  };
}

export function initDb() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  db = new Database(SQLITE_FILE);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      initials TEXT,
      coins INTEGER DEFAULT 80,
      purchased TEXT DEFAULT '[]',
      saved TEXT DEFAULT '[]',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS wallpapers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      tall INTEGER DEFAULT 0,
      image TEXT NOT NULL,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      wallpaper_id TEXT,
      wallpaper_title TEXT,
      price INTEGER,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      coins INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      session_id TEXT,
      order_id TEXT UNIQUE,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS bmc_payments (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      bmc_id TEXT,
      transaction_id TEXT,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      supporter_name TEXT,
      supporter_email TEXT,
      extra_id TEXT,
      extra_title TEXT,
      message TEXT,
      paid_at TEXT,
      refunded INTEGER DEFAULT 0,
      topup_id TEXT,
      user_id TEXT,
      user_email TEXT,
      order_id TEXT,
      coins_credited INTEGER DEFAULT 0,
      raw_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS bmc_payouts (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      bank TEXT,
      branch TEXT,
      created_at TEXT,
      updated_at TEXT,
      paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS google_play_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT,
      package_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      purchase_token TEXT NOT NULL UNIQUE,
      order_id TEXT,
      purchase_state INTEGER DEFAULT 0,
      consumption_state INTEGER DEFAULT 0,
      coins_credited INTEGER DEFAULT 0,
      is_subscription INTEGER DEFAULT 0,
      raw_verification TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topups_session ON topups(session_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bmc_payments_source_id ON bmc_payments(source, bmc_id);
    CREATE INDEX IF NOT EXISTS idx_bmc_payments_paid_at ON bmc_payments(paid_at);
    CREATE INDEX IF NOT EXISTS idx_bmc_payouts_status ON bmc_payouts(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_gp_purchases_token ON google_play_purchases(purchase_token);
    CREATE INDEX IF NOT EXISTS idx_gp_purchases_user ON google_play_purchases(user_id);
    CREATE TABLE IF NOT EXISTS coin_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON coin_ledger(user_id, created_at);
  `);
  try {
    db.exec("ALTER TABLE topups ADD COLUMN extra_id TEXT");
  } catch {
    /* already exists */
  }
  for (const col of ["bank TEXT", "branch TEXT"]) {
    try {
      db.exec(`ALTER TABLE bmc_payouts ADD COLUMN ${col}`);
    } catch {
      /* already exists */
    }
  }

  if (fs.existsSync(JSON_FILE)) {
    migrateJson();
  }

  const wallpaperCount = db.prepare("SELECT COUNT(*) AS n FROM wallpapers").get().n;
  if (wallpaperCount === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      "INSERT INTO wallpapers (id, title, price, tall, image, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const tx = db.transaction(() => {
      for (const w of SEED_WALLPAPERS) insert.run(w.id, w.title, w.price, w.tall, w.image, now);
    });
    tx();
  }

  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0 && process.env.NODE_ENV !== "production") {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, initials, coins, purchased, saved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "u-aziz",
      "Aziz",
      "aziz.karimov@gmail.com",
      hashPassword("aziz123"),
      "AK",
      80,
      JSON.stringify(["w8"]),
      "[]",
      now
    );
    db.prepare(
      `INSERT INTO purchases (id, user_id, user_name, user_email, wallpaper_id, wallpaper_title, price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("p-seed", "u-aziz", "Aziz", "aziz.karimov@gmail.com", "w8", "Soft gradient", 30, now);
  }

  const origin = getSetting("public_origin", "");
  if (!origin || /sslip\.io|130\.61\.247\.126/.test(origin)) {
    setSetting("public_origin", "https://silkrood.uz");
  }
  if (!getSetting("bmc_username")) setSetting("bmc_username", "admin09wet");
  if (!getSetting("bmc_page_url")) setSetting("bmc_page_url", "https://www.buymeacoffee.com/admin09wet");
  if (!getSetting("bmc_checkout_url")) {
    setSetting("bmc_checkout_url", "https://www.buymeacoffee.com/admin09wet/e/577212");
  }
  if (!getSetting("bmc_extra_default")) setSetting("bmc_extra_default", "577212");
  if (!getSetting("bmc_extra_100")) setSetting("bmc_extra_100", "577212");
  if (!getSetting("bmc_extra_300")) setSetting("bmc_extra_300", "577212");
  if (!getSetting("bmc_extra_500")) setSetting("bmc_extra_500", getSetting("bmc_extra_750") || "577212");
}

function migrateJson() {
  try {
    const raw = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
    const insertUser = db.prepare(
      `INSERT OR IGNORE INTO users (id, name, email, password_hash, initials, coins, purchased, saved, created_at)
       VALUES (@id, @name, @email, @password_hash, @initials, @coins, @purchased, @saved, @created_at)`
    );
    const insertWp = db.prepare(
      `INSERT OR IGNORE INTO wallpapers (id, title, price, tall, image, created_at)
       VALUES (@id, @title, @price, @tall, @image, @created_at)`
    );
    const insertP = db.prepare(
      `INSERT OR IGNORE INTO purchases (id, user_id, user_name, user_email, wallpaper_id, wallpaper_title, price, created_at)
       VALUES (@id, @user_id, @user_name, @user_email, @wallpaper_id, @wallpaper_title, @price, @created_at)`
    );
    const tx = db.transaction(() => {
      for (const u of raw.users || []) {
        insertUser.run({
          id: u.id,
          name: u.name,
          email: u.email,
          password_hash: u.passwordHash || hashPassword("aziz123"),
          initials: u.initials,
          coins: u.coins,
          purchased: JSON.stringify(u.purchased || []),
          saved: JSON.stringify(u.saved || []),
          created_at: u.createdAt,
        });
      }
      for (const w of raw.wallpapers || []) {
        insertWp.run({
          id: w.id,
          title: w.title,
          price: w.price,
          tall: w.tall ? 1 : 0,
          image: w.image,
          created_at: w.createdAt,
        });
      }
      for (const p of raw.purchases || []) {
        insertP.run({
          id: p.id,
          user_id: p.userId,
          user_name: p.userName,
          user_email: p.userEmail,
          wallpaper_id: p.wallpaperId,
          wallpaper_title: p.wallpaperTitle,
          price: p.price,
          created_at: p.createdAt,
        });
      }
    });
    tx();
    fs.renameSync(JSON_FILE, `${JSON_FILE}.migrated`);
  } catch (err) {
    console.error("JSON migrate skipped:", err.message);
  }
}

export function listWallpapers(q = "") {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const rows = q
    ? db.prepare("SELECT * FROM wallpapers WHERE lower(title) LIKE ? OR lower(id) LIKE ? ORDER BY created_at DESC").all(term, term)
    : db.prepare("SELECT * FROM wallpapers ORDER BY created_at DESC").all();
  return rows.map(mapWallpaper);
}

export function getWallpaper(id) {
  return mapWallpaper(db.prepare("SELECT * FROM wallpapers WHERE id = ?").get(id));
}

export function createWallpaper(item) {
  db.prepare(
    "INSERT INTO wallpapers (id, title, price, tall, image, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(item.id, item.title, item.price, item.tall ? 1 : 0, item.image, item.createdAt);
  return getWallpaper(item.id);
}

export function updateWallpaper(id, fields) {
  const item = getWallpaper(id);
  if (!item) return null;
  const next = { ...item, ...fields };
  db.prepare("UPDATE wallpapers SET title=?, price=?, tall=?, image=? WHERE id=?").run(
    next.title,
    next.price,
    next.tall ? 1 : 0,
    next.image,
    id
  );
  return getWallpaper(id);
}

export function deleteWallpaper(id) {
  const item = getWallpaper(id);
  if (!item) return null;
  db.prepare("DELETE FROM wallpapers WHERE id = ?").run(id);
  return item;
}

export function findUserByEmail(email) {
  return mapUser(db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase()));
}

export function findUserById(id) {
  return mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export function createUser({ name, email, password }) {
  const id = uuid();
  const now = new Date().toISOString();
  const user = {
    id,
    name,
    email: email.toLowerCase(),
    initials: initialsFrom(name),
    coins: 80,
    purchased: [],
    saved: [],
    createdAt: now,
  };
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, initials, coins, purchased, saved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', ?)`
  ).run(id, name, user.email, hashPassword(password), user.initials, 80, now);
  return user;
}

export function saveUser(user) {
  db.prepare("UPDATE users SET name=?, coins=?, purchased=?, saved=? WHERE id=?").run(
    user.name,
    user.coins,
    JSON.stringify(user.purchased || []),
    JSON.stringify(user.saved || []),
    user.id
  );
  return findUserById(user.id);
}

export function deleteUserAccount(userId) {
  const id = String(userId || "");
  if (!id) return false;
  const user = findUserById(id);
  if (!user) return false;
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM purchases WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM topups WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}

export function deleteUserAccountByEmail(email) {
  const user = findUserByEmail(email);
  if (!user) return false;
  return deleteUserAccount(user.id);
}

export function listUsers() {
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(mapUser);
  const counts = db.prepare("SELECT user_id, COUNT(*) AS n FROM purchases GROUP BY user_id").all();
  const map = Object.fromEntries(counts.map((r) => [r.user_id, r.n]));
  return users.map((u) => ({ ...publicUser(u), createdAt: u.createdAt, purchaseCount: map[u.id] || 0 }));
}

export function addPurchase(row) {
  db.prepare(
    `INSERT INTO purchases (id, user_id, user_name, user_email, wallpaper_id, wallpaper_title, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.userId, row.userName, row.userEmail, row.wallpaperId, row.wallpaperTitle, row.price, row.createdAt);
  return row;
}

export function listPurchases(q = "") {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const rows = q
    ? db
        .prepare(
          `SELECT * FROM purchases WHERE lower(user_name) LIKE ? OR lower(user_email) LIKE ? OR lower(wallpaper_title) LIKE ?
           ORDER BY created_at DESC`
        )
        .all(term, term, term)
    : db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all();
  return rows.map(mapPurchase);
}

export function stats() {
  const earnings = getBmcEarningsSummary();
  return {
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    wallpapers: db.prepare("SELECT COUNT(*) AS n FROM wallpapers").get().n,
    purchases: db.prepare("SELECT COUNT(*) AS n FROM purchases").get().n,
    bmcGross: earnings.gross,
    bmcAvailable: earnings.available,
    bmcWithdrawn: earnings.withdrawn,
    bmcCurrency: earnings.currency,
    bmcIncoming: earnings.incomingCount,
  };
}

export function createSession({ token, role, userId }) {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND role = ?").run(userId, role);
  db.prepare("INSERT INTO sessions (token, role, user_id, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    role,
    userId,
    new Date().toISOString()
  );
}

export function findSession(token) {
  return db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
}

export function issueUserToken(user) {
  const token = makeToken();
  createSession({ token, role: "user", userId: user.id });
  return token;
}

export function getSetting(key, fallback = "") {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value ?? ""));
}

export function parseBmcCheckoutLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return { checkoutUrl: "", username: "", extraId: "" };
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
    const url = new URL(withScheme);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    const username = (parts[0] || "").replace(/^@/, "");
    const extraIdx = parts.findIndex((part) => part === "e" || part === "extra");
    const extraId = extraIdx >= 0 ? String(parts[extraIdx + 1] || "").trim() : "";
    const checkoutUrl =
      username && extraId
        ? `https://www.buymeacoffee.com/${username}/e/${extraId}`
        : `${url.origin}${url.pathname}`.replace(/\/$/, "");
    return { checkoutUrl, username, extraId };
  } catch {
    return { checkoutUrl: raw.replace(/\/$/, ""), username: "", extraId: "" };
  }
}

export function getBmcSettings() {
  return {
    username: getSetting("bmc_username", "admin09wet"),
    pageUrl: getSetting("bmc_page_url", "https://www.buymeacoffee.com/admin09wet"),
    checkoutUrl: getSetting("bmc_checkout_url", "https://www.buymeacoffee.com/admin09wet/e/577212"),
    accessToken: getSetting("bmc_access_token"),
    webhookSecret: getSetting("bmc_webhook_secret"),
    defaultProductId: getSetting("bmc_extra_default", "577212"),
    extraId100: getSetting("bmc_extra_100", "577212"),
    extraId300: getSetting("bmc_extra_300", "577212"),
    extraId500: getSetting("bmc_extra_500") || getSetting("bmc_extra_750") || "577212",
    extraId750: getSetting("bmc_extra_750"),
    publicOrigin: getSetting("public_origin", "https://silkrood.uz"),
  };
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function publicBmcSettings() {
  const cfg = getBmcSettings();
  const origin = cfg.publicOrigin.replace(/\/$/, "");
  const username = cfg.username || "admin09wet";
  const extraId = cfg.defaultProductId || "577212";
  const parsedCheckout = parseBmcCheckoutLink(cfg.checkoutUrl);
  const checkoutUrl =
    parsedCheckout.checkoutUrl ||
    (username && extraId ? `https://www.buymeacoffee.com/${username}/e/${extraId}` : cfg.pageUrl || "");
  return {
    username,
    pageUrl: cfg.pageUrl || `https://www.buymeacoffee.com/${username}`,
    checkoutUrl,
    accessTokenSet: Boolean(cfg.accessToken),
    accessTokenMask: maskSecret(cfg.accessToken),
    webhookSecretSet: Boolean(cfg.webhookSecret),
    webhookSecretMask: maskSecret(cfg.webhookSecret),
    defaultProductId: cfg.defaultProductId || "577212",
    extraId100: cfg.extraId100,
    extraId300: cfg.extraId300,
    extraId500: cfg.extraId500,
    extraId750: cfg.extraId750,
    publicOrigin: origin,
    webhookUrl: `${origin}/zastavka-api/webhooks/bmc`,
    callbackUrl: `${origin}/zastavka-api/topup/callback`,
    returnUrl: `${origin}/zastavka/?pay=return`,
    cancelUrl: `${origin}/zastavka/?pay=cancel`,
    configured: Boolean((username || cfg.pageUrl || checkoutUrl) && cfg.webhookSecret),
    checkoutReady: Boolean(username || cfg.pageUrl || checkoutUrl),
    dashboardUrl: "https://www.buymeacoffee.com/dashboard",
    payoutsUrl: "https://www.buymeacoffee.com/dashboard",
    stripePayoutsUrl: "https://dashboard.stripe.com/balance/overview",
    loginUrl: "https://www.buymeacoffee.com/login",
  };
}

export function saveBmcSettings(body) {
  if (body.username != null) setSetting("bmc_username", String(body.username).replace(/^@/, "").trim());
  if (body.pageUrl != null) setSetting("bmc_page_url", String(body.pageUrl).trim().replace(/\/$/, ""));
  if (body.checkoutUrl != null) {
    const parsed = parseBmcCheckoutLink(body.checkoutUrl);
    setSetting("bmc_checkout_url", parsed.checkoutUrl);
    if (parsed.username) {
      setSetting("bmc_username", parsed.username);
      setSetting("bmc_page_url", `https://www.buymeacoffee.com/${parsed.username}`);
    }
    if (parsed.extraId) setSetting("bmc_extra_default", parsed.extraId);
  }
  if (body.accessToken) setSetting("bmc_access_token", String(body.accessToken).trim());
  if (body.webhookSecret) setSetting("bmc_webhook_secret", String(body.webhookSecret).trim());
  if (body.defaultProductId != null) setSetting("bmc_extra_default", String(body.defaultProductId).trim());
  if (body.extraId100 != null) setSetting("bmc_extra_100", String(body.extraId100).trim());
  if (body.extraId300 != null) setSetting("bmc_extra_300", String(body.extraId300).trim());
  if (body.extraId500 != null) setSetting("bmc_extra_500", String(body.extraId500).trim());
  if (body.extraId750 != null && body.extraId500 == null) setSetting("bmc_extra_500", String(body.extraId750).trim());
  if (body.publicOrigin != null) {
    setSetting("public_origin", String(body.publicOrigin).trim().replace(/\/$/, ""));
  }
  return publicBmcSettings();
}

export function rememberWebhookEvent(eventId) {
  if (!eventId) return false;
  const info = db.prepare("INSERT OR IGNORE INTO webhook_events (event_id, created_at) VALUES (?, ?)").run(
    String(eventId),
    new Date().toISOString()
  );
  return info.changes === 0;
}

export function createTopup(row) {
  db.prepare(
    `INSERT INTO topups (id, user_id, coins, amount, currency, session_id, order_id, extra_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.userId,
    row.coins,
    row.amount,
    row.currency,
    row.sessionId || null,
    row.orderId,
    row.extraId || null,
    row.status,
    row.createdAt,
    row.updatedAt
  );
  return getTopupById(row.id);
}

export function getTopupById(id) {
  return mapTopup(db.prepare("SELECT * FROM topups WHERE id = ?").get(id));
}

export function getTopupByOrderId(orderId) {
  return mapTopup(db.prepare("SELECT * FROM topups WHERE order_id = ?").get(orderId));
}

export function getTopupBySessionId(sessionId) {
  return mapTopup(db.prepare("SELECT * FROM topups WHERE session_id = ?").get(sessionId));
}

export function updateTopup(id, fields) {
  const item = getTopupById(id);
  if (!item) return null;
  const next = { ...item, ...fields, updatedAt: new Date().toISOString() };
  db.prepare(
    "UPDATE topups SET session_id=?, extra_id=?, status=?, coins=?, amount=?, updated_at=? WHERE id=?"
  ).run(
    next.sessionId || null,
    next.extraId || null,
    next.status,
    next.coins,
    next.amount,
    next.updatedAt,
    id
  );
  return getTopupById(id);
}

export function listTopups() {
  return db
    .prepare(
      `SELECT t.*, u.email AS user_email, u.name AS user_name
       FROM topups t
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT 200`
    )
    .all()
    .map(mapTopup);
}

export function listPendingTopups() {
  return db
    .prepare(
      `SELECT t.*, u.email AS user_email
       FROM topups t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.status = 'pending'
       ORDER BY t.created_at DESC
       LIMIT 200`
    )
    .all()
    .map(mapTopup);
}

function mapTopup(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email || "",
    userName: row.user_name || "",
    coins: row.coins,
    amount: row.amount,
    currency: row.currency,
    sessionId: row.session_id,
    extraId: row.extra_id || "",
    orderId: row.order_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function applyPaidTopup(topup, extras = {}) {
  if (!topup) return null;
  const apply = db.transaction(() => {
    const current = getTopupById(topup.id);
    if (!current) return null;
    if (current.status === "paid") return { topup: current, alreadyPaid: true, user: findUserById(current.userId) };
    const user = findUserById(current.userId);
    if (!user) return null;
    const creditCoins = Number.isFinite(Number(extras.coins)) && Number(extras.coins) > 0 ? Math.round(Number(extras.coins)) : current.coins;
    user.coins += creditCoins;
    saveUser(user);
    const paid = updateTopup(current.id, {
      sessionId: topup.sessionId || current.sessionId,
      status: "paid",
      coins: creditCoins,
      amount: extras.amount != null ? extras.amount : current.amount,
    });
    return { topup: paid, alreadyPaid: false, user: findUserById(user.id) };
  });
  return apply();
}

function mapBmcPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    bmcId: row.bmc_id || "",
    transactionId: row.transaction_id || "",
    amount: Number(row.amount) || 0,
    currency: row.currency || "USD",
    supporterName: row.supporter_name || "",
    supporterEmail: row.supporter_email || "",
    extraId: row.extra_id || "",
    extraTitle: row.extra_title || "",
    message: row.message || "",
    paidAt: row.paid_at || row.created_at,
    refunded: Boolean(row.refunded),
    topupId: row.topup_id || "",
    userId: row.user_id || "",
    userEmail: row.user_email || "",
    orderId: row.order_id || "",
    coinsCredited: Number(row.coins_credited) || 0,
    rawJson: row.raw_json || "{}",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBmcPayout(row) {
  if (!row) return null;
  const status = row.status === "jarayonda" ? "pending" : row.status;
  return {
    id: row.id,
    amount: Number(row.amount) || 0,
    currency: row.currency || "USD",
    method: row.method,
    status,
    note: row.note || "",
    bank: row.bank || "",
    branch: row.branch || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at || "",
  };
}

export function getBmcPaymentByKey(source, bmcId) {
  if (!source || !bmcId) return null;
  return mapBmcPayment(
    db.prepare("SELECT * FROM bmc_payments WHERE source = ? AND bmc_id = ?").get(String(source), String(bmcId))
  );
}

export function upsertBmcPayment(input) {
  const source = String(input.source || "donation");
  const bmcId = String(input.bmcId || input.transactionId || "").trim() || uuid();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT * FROM bmc_payments WHERE source = ? AND bmc_id = ?").get(source, bmcId);
  const next = {
    id: existing?.id || uuid(),
    source,
    bmc_id: bmcId,
    transaction_id: String(input.transactionId || existing?.transaction_id || ""),
    amount: Number.isFinite(Number(input.amount)) ? Number(input.amount) : Number(existing?.amount) || 0,
    currency: String(input.currency || existing?.currency || "USD").toUpperCase(),
    supporter_name: input.supporterName ?? existing?.supporter_name ?? "",
    supporter_email: String(input.supporterEmail || existing?.supporter_email || "").toLowerCase(),
    extra_id: input.extraId ?? existing?.extra_id ?? "",
    extra_title: input.extraTitle ?? existing?.extra_title ?? "",
    message: input.message ?? existing?.message ?? "",
    paid_at: input.paidAt || existing?.paid_at || now,
    refunded: input.refunded ? 1 : existing?.refunded || 0,
    topup_id: input.topupId || existing?.topup_id || null,
    user_id: input.userId || existing?.user_id || null,
    user_email: input.userEmail || existing?.user_email || "",
    order_id: input.orderId || existing?.order_id || "",
    coins_credited: Number(input.coinsCredited ?? existing?.coins_credited ?? 0),
    raw_json: input.raw != null ? JSON.stringify(input.raw) : existing?.raw_json || "{}",
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO bmc_payments (
      id, source, bmc_id, transaction_id, amount, currency, supporter_name, supporter_email,
      extra_id, extra_title, message, paid_at, refunded, topup_id, user_id, user_email,
      order_id, coins_credited, raw_json, created_at, updated_at
    ) VALUES (
      @id, @source, @bmc_id, @transaction_id, @amount, @currency, @supporter_name, @supporter_email,
      @extra_id, @extra_title, @message, @paid_at, @refunded, @topup_id, @user_id, @user_email,
      @order_id, @coins_credited, @raw_json, @created_at, @updated_at
    ) ON CONFLICT(source, bmc_id) DO UPDATE SET
      transaction_id=excluded.transaction_id,
      amount=excluded.amount,
      currency=excluded.currency,
      supporter_name=excluded.supporter_name,
      supporter_email=excluded.supporter_email,
      extra_id=excluded.extra_id,
      extra_title=excluded.extra_title,
      message=excluded.message,
      paid_at=excluded.paid_at,
      refunded=excluded.refunded,
      topup_id=COALESCE(excluded.topup_id, bmc_payments.topup_id),
      user_id=COALESCE(excluded.user_id, bmc_payments.user_id),
      user_email=CASE WHEN excluded.user_email != '' THEN excluded.user_email ELSE bmc_payments.user_email END,
      order_id=CASE WHEN excluded.order_id != '' THEN excluded.order_id ELSE bmc_payments.order_id END,
      coins_credited=MAX(excluded.coins_credited, bmc_payments.coins_credited),
      raw_json=excluded.raw_json,
      updated_at=excluded.updated_at`
  ).run(next);
  return getBmcPaymentByKey(source, bmcId);
}

export function linkBmcPaymentToTopup(paymentId, topup, user) {
  if (!paymentId || !topup) return null;
  db.prepare(
    `UPDATE bmc_payments
     SET topup_id=?, user_id=?, user_email=?, order_id=?, coins_credited=?, updated_at=?
     WHERE id=?`
  ).run(
    topup.id,
    topup.userId || user?.id || null,
    (user?.email || topup.userEmail || "").toLowerCase(),
    topup.orderId || "",
    topup.status === "paid" ? topup.coins : 0,
    new Date().toISOString(),
    paymentId
  );
  return mapBmcPayment(db.prepare("SELECT * FROM bmc_payments WHERE id = ?").get(paymentId));
}

export function listBmcPayments() {
  return db.prepare("SELECT * FROM bmc_payments ORDER BY paid_at DESC, created_at DESC LIMIT 500").all().map(mapBmcPayment);
}

export function listUnlinkedBmcPayments() {
  return db
    .prepare("SELECT * FROM bmc_payments WHERE refunded = 0 AND (topup_id IS NULL OR topup_id = '') ORDER BY paid_at DESC LIMIT 500")
    .all()
    .map(mapBmcPayment);
}

export function listBmcPayouts() {
  return db.prepare("SELECT * FROM bmc_payouts ORDER BY created_at DESC LIMIT 200").all().map(mapBmcPayout);
}

export function getBmcPayout(id) {
  return mapBmcPayout(db.prepare("SELECT * FROM bmc_payouts WHERE id = ?").get(id));
}

function moneyByCurrency(rows, key = "amount") {
  const map = {};
  for (const row of rows) {
    const currency = String(row.currency || "USD").toUpperCase();
    if (!map[currency]) map[currency] = 0;
    map[currency] += Number(row[key]) || 0;
  }
  return map;
}

export function getBmcEarningsSummary() {
  const incomingRows = db
    .prepare("SELECT amount, currency, refunded FROM bmc_payments")
    .all()
    .filter((row) => !row.refunded)
    .map((row) => ({ amount: row.amount, currency: row.currency }));
  const payoutRows = db.prepare("SELECT amount, currency, status FROM bmc_payouts").all();
  const grossMap = moneyByCurrency(incomingRows);
  const withdrawnMap = moneyByCurrency(payoutRows.filter((row) => row.status === "paid"));
  const pendingMap = moneyByCurrency(payoutRows.filter((row) => row.status === "pending" || row.status === "jarayonda"));
  const currencies = Array.from(new Set([...Object.keys(grossMap), ...Object.keys(withdrawnMap), ...Object.keys(pendingMap), "USD"]));
  const byCurrency = currencies.map((currency) => {
    const gross = roundMoney(grossMap[currency] || 0);
    const withdrawn = roundMoney(withdrawnMap[currency] || 0);
    const pending = roundMoney(pendingMap[currency] || 0);
    return {
      currency,
      gross,
      withdrawn,
      pending,
      available: roundMoney(gross - withdrawn - pending),
    };
  });
  const primary = byCurrency.find((row) => row.gross > 0 || row.withdrawn > 0 || row.pending > 0) || byCurrency.find((row) => row.currency === "USD") || byCurrency[0];
  return {
    currency: primary.currency,
    gross: primary.gross,
    withdrawn: primary.withdrawn,
    pending: primary.pending,
    available: primary.available,
    incomingCount: incomingRows.length,
    payoutCount: payoutRows.length,
    byCurrency,
  };
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function createBmcPayout({ amount, currency = "USD", method = "bank", note = "", bankId, branchId, bank, branch }) {
  const value = roundMoney(amount);
  if (!Number.isFinite(value) || value <= 0) {
    const err = new Error("Summani kiriting");
    err.status = 400;
    throw err;
  }
  const resolved = resolveUzBankBranch(bankId, branchId);
  const bankName = resolved?.bank.name || String(bank || "").trim();
  const branchName = resolved?.branch.name || String(branch || "").trim();
  if (!resolved && (!bankName || !branchName)) {
    const err = new Error("Bank va filialni tanlang");
    err.status = 400;
    throw err;
  }
  if (!resolved && (bankId || branchId)) {
    const err = new Error("Bank yoki filial noto'g'ri");
    err.status = 400;
    throw err;
  }
  const cur = String(currency || "USD").toUpperCase();
  const summary = getBmcEarningsSummary();
  const bucket = summary.byCurrency.find((row) => row.currency === cur) || { available: summary.available };
  if (value > bucket.available + 0.009) {
    const err = new Error("Summa qoldiqdan katta");
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO bmc_payouts (id, amount, currency, method, status, note, bank, branch, created_at, updated_at, paid_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL)`
  ).run(
    id,
    value,
    cur,
    String(method || "bank"),
    String(note || "").trim(),
    bankName,
    branchName,
    now,
    now
  );
  return getBmcPayout(id);
}

export function updateBmcPayout(id, { status, note }) {
  const item = getBmcPayout(id);
  if (!item) return null;
  let nextStatus = status ? String(status) : item.status;
  if (nextStatus === "jarayonda") nextStatus = "pending";
  if (!["pending", "paid", "cancelled"].includes(nextStatus)) {
    const err = new Error("Invalid payout status");
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const paidAt = nextStatus === "paid" ? item.paidAt || now : null;
  db.prepare("UPDATE bmc_payouts SET status=?, note=?, updated_at=?, paid_at=? WHERE id=?").run(
    nextStatus,
    note != null ? String(note) : item.note,
    now,
    paidAt,
    id
  );
  return getBmcPayout(id);
}

export function findGooglePlayPurchaseByToken(purchaseToken) {
  if (!purchaseToken) return null;
  const row = db.prepare("SELECT * FROM google_play_purchases WHERE purchase_token = ?").get(purchaseToken);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    packageName: row.package_name,
    productId: row.product_id,
    purchaseToken: row.purchase_token,
    orderId: row.order_id,
    purchaseState: row.purchase_state,
    consumptionState: row.consumption_state,
    coinsCredited: row.coins_credited,
    isSubscription: Boolean(row.is_subscription),
    rawVerification: row.raw_verification ? JSON.parse(row.raw_verification) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function recordAndCreditGooglePlayPurchase({
  id,
  userId,
  userEmail,
  packageName,
  productId,
  purchaseToken,
  orderId,
  purchaseState = 0,
  consumptionState = 0,
  coinsToCredit = 0,
  isSubscription = false,
  rawVerification = {},
}) {
  const now = new Date().toISOString();
  const apply = db.transaction(() => {
    // Check if token already exists to avoid race conditions
    const existing = db.prepare("SELECT * FROM google_play_purchases WHERE purchase_token = ?").get(purchaseToken);
    if (existing && existing.user_id !== userId) {
      const error = new Error("Purchase token is already linked to another account");
      error.status = 409;
      error.code = "PURCHASE_TOKEN_CONFLICT";
      throw error;
    }
    if (existing && existing.coins_credited > 0) {
      return { duplicate: true, record: existing, coinsCredited: 0, user: findUserById(userId) };
    }

    const user = findUserById(userId);
    if (!user) throw new Error("User not found");

    if (coinsToCredit > 0) {
      user.coins += coinsToCredit;
      saveUser(user);

      // Record to immutable coin transaction ledger
      db.prepare(`
        INSERT INTO coin_ledger (id, user_id, amount, balance_after, type, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id + "-ledger",
        userId,
        coinsToCredit,
        user.coins,
        "google_play_purchase",
        orderId || purchaseToken,
        `Purchased ${coinsToCredit} coins via Google Play (${productId})`,
        now
      );
    }

    db.prepare(`
      INSERT INTO google_play_purchases (
        id, user_id, user_email, package_name, product_id, purchase_token,
        order_id, purchase_state, consumption_state, coins_credited, is_subscription,
        raw_verification, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(purchase_token) DO UPDATE SET
        order_id = excluded.order_id,
        purchase_state = excluded.purchase_state,
        consumption_state = excluded.consumption_state,
        coins_credited = MAX(google_play_purchases.coins_credited, excluded.coins_credited),
        updated_at = excluded.updated_at
    `).run(
      id,
      userId,
      userEmail || user.email,
      packageName,
      productId,
      purchaseToken,
      orderId || null,
      purchaseState,
      consumptionState,
      coinsToCredit,
      isSubscription ? 1 : 0,
      JSON.stringify(rawVerification || {}),
      now,
      now
    );

    return {
      duplicate: false,
      coinsCredited: coinsToCredit,
      user: findUserById(userId),
    };
  });

  return apply();
}

export function updateGooglePlayPurchaseConsumption(purchaseToken, consumptionState = 1) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE google_play_purchases
    SET consumption_state = ?, updated_at = ?
    WHERE purchase_token = ?
  `).run(consumptionState, now, purchaseToken);
}

export function refundGooglePlayPurchase(purchaseToken, reason = "refunded") {
  const now = new Date().toISOString();
  const apply = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM google_play_purchases WHERE purchase_token = ?").get(purchaseToken);
    if (!existing) return { ok: false, error: "Purchase not found" };
    if (existing.purchase_state === 1) return { ok: true, alreadyRefunded: true };

    const user = findUserById(existing.user_id);
    if (user && existing.coins_credited > 0) {
      user.coins = Math.max(0, user.coins - existing.coins_credited);
      saveUser(user);

      db.prepare(`
        INSERT INTO coin_ledger (id, user_id, amount, balance_after, type, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "refund-" + Date.now(),
        user.id,
        -existing.coins_credited,
        user.coins,
        "refund",
        existing.order_id || purchaseToken,
        `Revoked/Refunded purchase: -${existing.coins_credited} coins (${reason})`,
        now
      );
    }

    db.prepare(`
      UPDATE google_play_purchases
      SET purchase_state = 1, updated_at = ?
      WHERE purchase_token = ?
    `).run(now, purchaseToken);

    return { ok: true, user: user ? findUserById(user.id) : null };
  });

  return apply();
}

export function listCoinLedger(userId, limit = 50) {
  return db.prepare("SELECT * FROM coin_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit);
}

export function listGooglePlayPurchases(limit = 100) {
  return db.prepare("SELECT * FROM google_play_purchases ORDER BY created_at DESC LIMIT ?").all(limit);
}



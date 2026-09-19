import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import { v4 as uuid } from "uuid";
import { openApi } from "./openapi.js";
import {
  DATA_DIR,
  UPLOAD_DIR,
  initDb,
  publicUser,
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
} from "./db.js";
import {
  createBmcCheckout,
  extraIdForCoins,
  verifyBmcSignature,
  applyBmcPayload,
  reconcilePendingWithBmcApi,
} from "./bmc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3050);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ZastavkaAdmin!";
const PREFIX = "/zastavka-api";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!cfg.username && !cfg.pageUrl) {
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
    { coins: 100, usd: 0.99 },
    { coins: 300, usd: 2.99 },
    { coins: 750, usd: 5.99 },
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

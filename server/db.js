import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "data");
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
  `);

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
  if (userCount === 0) {
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
  return {
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    wallpapers: db.prepare("SELECT COUNT(*) AS n FROM wallpapers").get().n,
    purchases: db.prepare("SELECT COUNT(*) AS n FROM purchases").get().n,
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

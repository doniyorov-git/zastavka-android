import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuid } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

const SEED_WALLPAPERS = [
  { id: "w1", title: "Mountain dawn", price: 50, tall: false, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80" },
  { id: "w2", title: "Purple sky", price: 80, tall: true, image: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=600&q=80" },
  { id: "w3", title: "Ocean wave", price: 40, tall: true, image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" },
  { id: "w4", title: "Minimal geometry", price: 60, tall: false, image: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=80" },
  { id: "w5", title: "Forest mist", price: 70, tall: false, image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80" },
  { id: "w6", title: "Desert sands", price: 45, tall: true, image: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=600&q=80" },
  { id: "w7", title: "Neon city", price: 90, tall: true, image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80" },
  { id: "w8", title: "Soft gradient", price: 30, tall: false, image: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80" },
  { id: "w9", title: "Snowy peak", price: 55, tall: false, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80" },
  { id: "w10", title: "Cosmic dust", price: 120, tall: true, image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80" },
];

function emptyDb() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u-aziz",
        name: "Aziz",
        email: "aziz.karimov@gmail.com",
        initials: "AK",
        coins: 80,
        purchased: ["w8"],
        saved: [],
        createdAt: now,
      },
    ],
    wallpapers: SEED_WALLPAPERS.map((w) => ({ ...w, createdAt: now })),
    purchases: [
      {
        id: "p-seed",
        userId: "u-aziz",
        userName: "Aziz",
        userEmail: "aziz.karimov@gmail.com",
        wallpaperId: "w8",
        wallpaperTitle: "Soft gradient",
        price: 30,
        createdAt: now,
      },
    ],
    sessions: [],
  };
}

export function ensureStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
  }
}

export function readDb() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

export function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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

export function makeToken() {
  return uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
}

export function initialsFrom(name) {
  const parts = String(name || "U").trim().split(/\s+/);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Replace catalog with 1000 wallpapers (varied coin prices).
 * Images: Lorem Picsum seeds (unique, reliable CDN).
 * Run on API host: node seed-1000-wallpapers.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data", "zastavka.sqlite"));

const ADJECTIVES = [
  "Alpine", "Azure", "Blush", "Coral", "Crystal", "Dawn", "Deep", "Desert", "Electric", "Emerald",
  "Foggy", "Frozen", "Golden", "Hidden", "Indigo", "Ivory", "Jade", "Lavender", "Liquid", "Lunar",
  "Misty", "Neon", "Northern", "Obsidian", "Ocean", "Pastel", "Pearl", "Polar", "Quiet", "Radiant",
  "Rose", "Ruby", "Sandy", "Silk", "Silver", "Soft", "Storm", "Sunset", "Teal", "Tropical",
  "Velvet", "Violet", "Warm", "Wild", "Amber", "Arctic", "Bright", "Calm", "Cosmic", "Dark",
];

const NOUNS = [
  "Peak", "Shore", "Valley", "Sky", "Forest", "Dunes", "City", "Lake", "Ridge", "Glow",
  "Horizon", "Trail", "Canyon", "Harbor", "Meadow", "Cliff", "Wave", "Clouds", "Lights", "Path",
  "Grove", "Field", "Bridge", "Bay", "Summit", "River", "Night", "Bloom", "Sand", "Mist",
  "Aurora", "Reef", "Tower", "Road", "Island", "Marsh", "Glacier", "Plaza", "Cascade", "Vista",
];

const PRICE_TIERS = [
  ...Array(150).fill(20),
  ...Array(150).fill(25),
  ...Array(120).fill(30),
  ...Array(100).fill(35),
  ...Array(80).fill(40),
  ...Array(70).fill(45),
  ...Array(60).fill(50),
  ...Array(50).fill(55),
  ...Array(40).fill(60),
  ...Array(35).fill(70),
  ...Array(30).fill(80),
  ...Array(25).fill(90),
  ...Array(25).fill(100),
  ...Array(20).fill(120),
  ...Array(15).fill(150),
  ...Array(15).fill(180),
  ...Array(15).fill(200),
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function titleFor(i) {
  const a = ADJECTIVES[i % ADJECTIVES.length];
  const n = NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length];
  const suffix = i >= ADJECTIVES.length * NOUNS.length ? ` ${Math.floor(i / (ADJECTIVES.length * NOUNS.length)) + 1}` : "";
  return `${a} ${n}${suffix}`;
}

const prices = shuffle(PRICE_TIERS).slice(0, 1000);
while (prices.length < 1000) prices.push(40 + (prices.length % 10) * 5);

const items = [];
for (let i = 0; i < 1000; i++) {
  const tall = i % 3 !== 0; // ~2/3 portrait
  const w = tall ? 900 : 1200;
  const h = tall ? 1600 : 800;
  items.push({
    id: `wp${String(i + 1).padStart(4, "0")}`,
    title: titleFor(i),
    price: prices[i],
    tall: tall ? 1 : 0,
    image: `https://picsum.photos/seed/zastavka${i + 1}/${w}/${h}`,
    createdAt: new Date(Date.now() - i * 500).toISOString(),
  });
}

const del = db.prepare("DELETE FROM wallpapers");
const insert = db.prepare(
  "INSERT INTO wallpapers (id, title, price, tall, image, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);

const tx = db.transaction(() => {
  del.run();
  for (const w of items) insert.run(w.id, w.title, w.price, w.tall, w.image, w.createdAt);
});
tx();

const count = db.prepare("SELECT COUNT(*) AS n FROM wallpapers").get().n;
const pricesStat = db
  .prepare("SELECT MIN(price) AS lo, MAX(price) AS hi, ROUND(AVG(price)) AS avg FROM wallpapers")
  .get();
const tiers = db
  .prepare(
    `SELECT CASE
      WHEN price < 40 THEN 'budget'
      WHEN price < 80 THEN 'mid'
      WHEN price < 120 THEN 'plus'
      ELSE 'premium' END AS tier, COUNT(*) AS n
     FROM wallpapers GROUP BY 1 ORDER BY MIN(price)`
  )
  .all();

console.log(JSON.stringify({ count, prices: pricesStat, tiers }, null, 2));
db.close();

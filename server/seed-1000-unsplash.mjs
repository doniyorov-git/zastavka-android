/**
 * Re-seed 1000 wallpapers using Unsplash CDN (picsum blocks hotlink from many hosts).
 * Run: node seed-1000-unsplash.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data", "zastavka.sqlite"));

/** Known-good Unsplash photo IDs (unique) */
const PHOTOS = [
  "photo-1506905925346-21bda4d32df4",
  "photo-1419242902214-272b3f66ee7a",
  "photo-1507525428034-b723cf961d3e",
  "photo-1557683316-973673baf926",
  "photo-1441974231531-c6227db76b6e",
  "photo-1509316785289-025f5b846b35",
  "photo-1514565131-fce0801e5785",
  "photo-1579546929518-9e396f3cc809",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1462331940025-496dfbfc7564",
  "photo-1531366936337-7c912a4589a7",
  "photo-1439066615861-d1af74d74000",
  "photo-1540959733332-eab4deabeeaf",
  "photo-1473580044384-7ba9967eb272",
  "photo-1611273426858-450d8e3c9fce",
  "photo-1501854140801-50d01698950b",
  "photo-1519681393784-d120267933ba",
  "photo-1513002749550-ff529d646b30",
  "photo-1483728642384-2c3adf7f2fad",
  "photo-1499002238440-d264edd596ec",
  "photo-1550745165-9bc8b375ee72",
  "photo-1477959858617-67f85cf4f1df",
  "photo-1469854523086-cc02fe5d8800",
  "photo-1454496522488-7a8e488e8606",
  "photo-1557682250-33bd709cbe85",
  "photo-1519501025264-65ba15a82390",
  "photo-1465146633011-14f8e0781093",
  "photo-1480714378408-67cf0d13bc1b",
  "photo-1682686580391-615b1f28e5ee",
  "photo-1483347756197-71ef80e95f73",
  "photo-1505142468610-359e7d316be0",
  "photo-1550684848-fac1c5b4e853",
  "photo-1448375240586-882707db888b",
  "photo-1486325212027-8081e485987e",
  "photo-1559827260-dc66d52bef19",
  "photo-1505144808419-1957a94ca61e",
  "photo-1522383225653-ed111181a951",
  "photo-1557682224-5b8590cd9ec5",
  "photo-1432405972618-c60b0225b8f9",
  "photo-1501594907352-04cda38ebc29",
  "photo-1528164344705-47542687000d",
  "photo-1451187580459-43490279c0fa",
  "photo-1579546929662-711aa80948ac",
  "photo-1472214103451-9374bd1c798e",
  "photo-1499346030926-9a72daac6c63",
  "photo-1491002052546-bf38f186af56",
  "photo-1510414842594-a61c695b5ae3",
  "photo-1501785888041-af3ef285b470",
  "photo-1502134249126-9f3755a93009",
  "photo-1493976040374-85c8e12f0c0e",
  "photo-1511497584788-876760111969",
  "photo-1507608616759-54f48f0af0ee",
  "photo-1449824913935-59a10b8d2000",
  "photo-1557682260-9677301c7a73",
  "photo-1500382017468-9049fed747ef",
  "photo-1495616811223-4d98c6e9c869",
  "photo-1476820865390-c52aeebb9891",
  "photo-1505765050516-f72dcac9c60e",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1500534314209-a25ddb2bd429",
  "photo-1470240731273-4821b1e80b54",
  "photo-1469474968028-56623f02e42e",
  "photo-1447752875215-b2761acb3c5d",
  "photo-1518173946687-a0c98949aaad",
  "photo-1475924156734-496f6cac6ec1",
  "photo-1433832597046-4f10e10ac764",
  "photo-1493246507139-91e8fad9978e",
  "photo-1506744038136-46273834b3fb",
  "photo-1470770841072-f978cf4d019e",
  "photo-1500534314209-a25ddb2bd429",
  "photo-1426604966848-d7adac402bff",
  "photo-1470252649378-9c147bb0c63c",
  "photo-1501785888041-af3ef285b470",
  "photo-1511593358241-7eea1f3c84e5",
  "photo-1493246507139-91e8fad9978e",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1519681393784-d120267933ba",
  "photo-1506905925346-21bda4d32df4",
  "photo-1441974231531-c6227db76b6e",
  "photo-1514565131-fce0801e5785",
  "photo-1540206395-68808572332f",
  "photo-1497366216548-37526070297c",
  "photo-1506905925346-21bda4d32df4",
  "photo-1518837695005-2083093ee35b",
  "photo-1472214103451-9374bd1c798e",
  "photo-1507525428034-b723cf961d3e",
  "photo-1469474968028-56623f02e42e",
  "photo-1500534314209-a25ddb2bd429",
  "photo-1510797215324-95aa89f43c33",
  "photo-1506744038136-46273834b3fb",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1426604966848-d7adac402bff",
  "photo-1470252649378-9c147bb0c63c",
  "photo-1447752875215-b2761acb3c5d",
  "photo-1433832597046-4f10e10ac764",
  "photo-1470770841072-f978cf4d019e",
  "photo-1518173946687-a0c98949aaad",
  "photo-1475924156734-496f6cac6ec1",
  "photo-1505765050516-f72dcac9c60e",
  "photo-1511593358241-7eea1f3c84e5",
  "photo-1518837695005-2083093ee35b",
  "photo-1540206395-68808572332f",
  "photo-1497366216548-37526070297c",
  "photo-1510797215324-95aa89f43c33",
  "photo-1504280390367-361c6d9f38f4",
  "photo-1476514525535-07fb3b4ae5f1",
  "photo-1506197603052-3cc9c3a201bd",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1482192505345-5655af888cc4",
  "photo-1500530855697-b586d89ba3ee",
  "photo-1444723121867-7a241cacace9",
  "photo-1519904981063-b0cf448d479e",
  "photo-1465056836041-7f43ac27bdb1",
  "photo-1494500764479-0c8f2919a3ad",
  "photo-1502082553048-f009c37129b9",
  "photo-1475924156734-496f6cac6ec1",
  "photo-1418065460487-3e41f6e8b6e9",
  "photo-1493246507139-91e8fad9978e",
  "photo-1501785888041-af3ef285b470",
  "photo-1470071459604-3b5ec3a7fe05",
];

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
];

const PRICE_POOL = [
  ...Array(150).fill(20), ...Array(150).fill(25), ...Array(120).fill(30), ...Array(100).fill(35),
  ...Array(80).fill(40), ...Array(70).fill(45), ...Array(60).fill(50), ...Array(50).fill(55),
  ...Array(40).fill(60), ...Array(35).fill(70), ...Array(30).fill(80), ...Array(25).fill(90),
  ...Array(25).fill(100), ...Array(20).fill(120), ...Array(15).fill(150), ...Array(15).fill(180),
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

function unsplash(photo, tall) {
  const w = tall ? 900 : 1200;
  const h = tall ? 1600 : 800;
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

const prices = shuffle(PRICE_POOL);
while (prices.length < 1000) prices.push(40);

const uniquePhotos = [...new Set(PHOTOS)];
const items = [];
for (let i = 0; i < 1000; i++) {
  const tall = i % 3 !== 0;
  const photo = uniquePhotos[i % uniquePhotos.length];
  const title = `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length]}${
    i >= ADJECTIVES.length * NOUNS.length ? ` ${Math.floor(i / (ADJECTIVES.length * NOUNS.length)) + 1}` : ""
  }`;
  items.push({
    id: `wp${String(i + 1).padStart(4, "0")}`,
    title,
    price: prices[i],
    tall: tall ? 1 : 0,
    image: unsplash(photo, tall),
    createdAt: new Date(Date.now() - i * 500).toISOString(),
  });
}

const del = db.prepare("DELETE FROM wallpapers");
const insert = db.prepare(
  "INSERT INTO wallpapers (id, title, price, tall, image, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);
db.transaction(() => {
  del.run();
  for (const w of items) insert.run(w.id, w.title, w.price, w.tall, w.image, w.createdAt);
})();

const count = db.prepare("SELECT COUNT(*) AS n FROM wallpapers").get().n;
const sample = db.prepare("SELECT title, image FROM wallpapers LIMIT 1").get();
console.log(JSON.stringify({ count, uniquePhotos: uniquePhotos.length, sample }, null, 2));
db.close();

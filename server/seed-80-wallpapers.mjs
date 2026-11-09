/**
 * Replace catalog with 80 premium Unsplash wallpapers (varied coin prices).
 * Run on API host: node seed-80-wallpapers.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data", "zastavka.sqlite"));

const img = (id, w = 1080) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;

/** [title, priceCoins, tall(0|1), unsplash photo-…] — 80 unique */
const FULL = [
  ["Alpine Glow", 40, 0, "photo-1506905925346-21bda4d32df4"],
  ["Starfield Night", 90, 1, "photo-1419242902214-272b3f66ee7a"],
  ["Turquoise Shore", 35, 1, "photo-1507525428034-b723cf961d3e"],
  ["Violet Blur", 25, 0, "photo-1557683316-973673baf926"],
  ["Misty Woods", 55, 0, "photo-1441974231531-c6227db76b6e"],
  ["Golden Dunes", 45, 1, "photo-1509316785289-025f5b846b35"],
  ["Neon Skyline", 100, 1, "photo-1514565131-fce0801e5785"],
  ["Pastel Wash", 20, 0, "photo-1579546929518-9e396f3cc809"],
  ["Snow Ridge", 60, 0, "photo-1464822759023-fed622ff2c3b"],
  ["Deep Cosmos", 150, 1, "photo-1462331940025-496dfbfc7564"],
  ["Northern Lights", 180, 1, "photo-1531366936337-7c912a4589a7"],
  ["Crystal Lake", 50, 0, "photo-1439066615861-d1af74d74000"],
  ["Tokyo Nights", 110, 1, "photo-1540959733332-eab4deabeeaf"],
  ["Sahara Sunset", 70, 0, "photo-1473580044384-7ba9967eb272"],
  ["Volcano Ember", 130, 1, "photo-1611273426858-450d8e3c9fce"],
  ["Green Valley", 40, 0, "photo-1501854140801-50d01698950b"],
  ["Night Peaks", 75, 1, "photo-1519681393784-d120267933ba"],
  ["Pink Clouds", 30, 0, "photo-1513002749550-ff529d646b30"],
  ["Ice Summit", 140, 1, "photo-1483728642384-2c3adf7f2fad"],
  ["Lavender Field", 45, 0, "photo-1499002238440-d264edd596ec"],
  ["Cyber Alley", 160, 1, "photo-1550745165-9bc8b375ee72"],
  ["Fog Bridge", 55, 1, "photo-1477959858617-67f85cf4f1df"],
  ["Red Rock Road", 65, 0, "photo-1469854523086-cc02fe5d8800"],
  ["Moonlit Peak", 120, 1, "photo-1454496522488-7a8e488e8606"],
  ["Soft Peach", 20, 0, "photo-1557682250-33bd709cbe85"],
  ["Rainy Street", 80, 1, "photo-1519501025264-65ba15a82390"],
  ["Tropical Leaf", 40, 0, "photo-1465146633011-14f8e0781093"],
  ["Blue Hour City", 95, 1, "photo-1480714378408-67cf0d13bc1b"],
  ["White Dunes", 50, 0, "photo-1682686580391-615b1f28e5ee"],
  ["Aurora Curtain", 200, 1, "photo-1483347756197-71ef80e95f73"],
  ["Sunset Surf", 60, 0, "photo-1505142468610-359e7d316be0"],
  ["Marble Abstract", 30, 0, "photo-1550684848-fac1c5b4e853"],
  ["Forest Path", 45, 1, "photo-1448375240586-882707db888b"],
  ["Glass Towers", 85, 1, "photo-1486325212027-8081e485987e"],
  ["Coral Water", 70, 0, "photo-1559827260-dc66d52bef19"],
  ["Black Sand Beach", 90, 1, "photo-1505144808419-1957a94ca61e"],
  ["Cherry Blossom", 55, 0, "photo-1522383225653-ed111181a951"],
  ["Soft Blue Mesh", 25, 0, "photo-1557682224-5b8590cd9ec5"],
  ["Waterfall Mist", 75, 1, "photo-1432405972618-c60b0225b8f9"],
  ["Golden Gate Fog", 110, 0, "photo-1501594907352-04cda38ebc29"],
  ["Bamboo Grove", 40, 1, "photo-1528164344705-47542687000d"],
  ["Earth From Space", 130, 0, "photo-1451187580459-43490279c0fa"],
  ["Warm Gradient", 20, 0, "photo-1579546929662-711aa80948ac"],
  ["Cliff Edge", 80, 1, "photo-1472214103451-9374bd1c798e"],
  ["Storm Clouds", 70, 1, "photo-1499346030926-9a72daac6c63"],
  ["Quiet Snow", 55, 0, "photo-1491002052546-bf38f186af56"],
  ["Palm Shadow", 45, 1, "photo-1510414842594-a61c695b5ae3"],
  ["River Canyon", 65, 0, "photo-1501785888041-af3ef285b470"],
  ["Purple Haze", 100, 1, "photo-1502134249126-9f3755a93009"],
  ["Desert Highway", 50, 0, "photo-1469854523086-cc02fe5d8800"],
  ["Lantern Night", 115, 1, "photo-1493976040374-85c8e12f0c0e"],
  ["Ocean Cliff", 85, 0, "photo-1507525428034-b723cf961d3e"],
  ["Foggy Forest", 60, 1, "photo-1511497584788-876760111969"],
  ["Sunrise Balloon", 70, 0, "photo-1507608616759-54f48f0af0ee"],
  ["Iceberg Blue", 140, 1, "photo-1491002052546-bf38f186af56"],
  ["City Reflection", 90, 0, "photo-1449824913935-59a10b8d2000"],
  ["Mountain Road", 55, 1, "photo-1464822759023-fed622ff2c3b"],
  ["Soft Lilac", 25, 0, "photo-1557682260-9677301c7a73"],
  ["Tropical Bay", 75, 1, "photo-1559827260-dc66d52bef19"],
  ["Star Trails", 170, 1, "photo-1419242902214-272b3f66ee7a"],
  ["Wheat Field", 35, 0, "photo-1500382017468-9049fed747ef"],
  ["Night Bridge", 95, 1, "photo-1477959858617-67f85cf4f1df"],
  ["Rocky Coast", 65, 0, "photo-1505144808419-1957a94ca61e"],
  ["Pink Horizon", 40, 0, "photo-1495616811223-4d98c6e9c869"],
  ["Dark Neon", 150, 1, "photo-1550745165-9bc8b375ee72"],
  ["Alpine Lake", 80, 0, "photo-1439066615861-d1af74d74000"],
  ["Autumn Leaves", 45, 1, "photo-1476820865390-c52aeebb9891"],
  ["Skyline Dusk", 100, 0, "photo-1480714378408-67cf0d13bc1b"],
  ["Moss Canyon", 55, 1, "photo-1441974231531-c6227db76b6e"],
  ["Silver Dunes", 60, 0, "photo-1509316785289-025f5b846b35"],
  ["Galaxy Core", 190, 1, "photo-1462331940025-496dfbfc7564"],
  ["Quiet Pier", 50, 0, "photo-1505142468610-359e7d316be0"],
  ["Rain Neon", 120, 1, "photo-1519501025264-65ba15a82390"],
  ["Green Hills", 35, 0, "photo-1501854140801-50d01698950b"],
  ["Frozen Peak", 110, 1, "photo-1454496522488-7a8e488e8606"],
  ["Blush Soft", 20, 0, "photo-1557682250-33bd709cbe85"],
  ["Harbor Lights", 85, 1, "photo-1514565131-fce0801e5785"],
  ["Wildflower Meadow", 40, 0, "photo-1465146633011-14f8e0781093"],
  ["Moon Desert", 125, 1, "photo-1473580044384-7ba9967eb272"],
  ["Clear Water", 70, 0, "photo-1505144808419-1957a94ca61e"],
  ["Indigo Night", 160, 1, "photo-1531366936337-7c912a4589a7"],
  ["Sand Curves", 45, 0, "photo-1682686580391-615b1f28e5ee"],
  ["Temple Fog", 90, 1, "photo-1528164344705-47542687000d"],
  ["Sky Gradient", 30, 0, "photo-1513002749550-ff529d646b30"],
  ["Cliff Ocean", 105, 1, "photo-1472214103451-9374bd1c798e"],
  ["City Morning", 60, 0, "photo-1449824913935-59a10b8d2000"],
  ["Deep Jungle", 75, 1, "photo-1511497584788-876760111969"],
  ["Hot Air Dawn", 80, 0, "photo-1507608616759-54f48f0af0ee"],
  ["Polar Glow", 200, 1, "photo-1483347756197-71ef80e95f73"],
  ["Road Horizon", 50, 0, "photo-1501785888041-af3ef285b470"],
];

const photos = FULL.map((r) => r[3]);
const unique = new Set(photos);
if (FULL.length < 80) {
  console.error("Need >= 80 rows, got", FULL.length);
  process.exit(1);
}
if (unique.size < 70) {
  console.warn("Warning: only", unique.size, "unique photo IDs");
}

const items = FULL.slice(0, 80).map(([title, price, tall, photo], i) => ({
  id: `wp${String(i + 1).padStart(3, "0")}`,
  title,
  price,
  tall,
  image: img(photo, tall ? 900 : 1080),
  createdAt: new Date(Date.now() - i * 1000).toISOString(),
}));

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
const prices = db
  .prepare("SELECT MIN(price) AS lo, MAX(price) AS hi, ROUND(AVG(price)) AS avg FROM wallpapers")
  .get();
const tiers = db
  .prepare(
    `SELECT CASE
      WHEN price < 40 THEN 'budget'
      WHEN price < 80 THEN 'mid'
      WHEN price < 120 THEN 'plus'
      ELSE 'premium' END AS tier, COUNT(*) AS n
     FROM wallpapers GROUP BY 1 ORDER BY 1`
  )
  .all();

console.log(JSON.stringify({ count, prices, tiers, uniquePhotos: unique.size }, null, 2));
db.close();

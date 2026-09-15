export const USER = {
  name: "Aziz",
  email: "aziz.karimov@gmail.com",
  initials: "AK",
};

export const COIN_USD_RATE = 0.01;

export const PACKAGES = [
  { id: "p1", coins: 100, usd: 0.99, popular: false },
  { id: "p2", coins: 300, usd: 2.99, popular: true },
  { id: "p3", coins: 750, usd: 5.99, popular: false },
];

export function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function usdForCoins(coins) {
  const n = Number(coins);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const match = PACKAGES.find((p) => p.coins === n);
  if (match) return match.usd;
  return Math.round(n * COIN_USD_RATE * 100) / 100;
}

export const WALLPAPERS = [
  {
    id: "w1",
    title: "Tog‘ tongi",
    price: 50,
    tall: false,
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w2",
    title: "Binafsha osmon",
    price: 80,
    tall: true,
    image:
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w3",
    title: "Okean to‘lqini",
    price: 40,
    tall: true,
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w4",
    title: "Minimal geometriya",
    price: 60,
    tall: false,
    image:
      "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w5",
    title: "O‘rmon tuman",
    price: 70,
    tall: false,
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w6",
    title: "Sahro qumlari",
    price: 45,
    tall: true,
    image:
      "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w7",
    title: "Neon shahar",
    price: 90,
    tall: true,
    image:
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w8",
    title: "Yumshoq gradient",
    price: 30,
    tall: false,
    image:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w9",
    title: "Qorli cho‘qqi",
    price: 55,
    tall: false,
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "w10",
    title: "Kosmik chang",
    price: 120,
    tall: true,
    image:
      "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=600&q=80",
  },
];

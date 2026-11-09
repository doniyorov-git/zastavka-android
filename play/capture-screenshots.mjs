import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chrome =
  process.env.CHROME_PATH ||
  "/Users/mac/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.env.STORE_URL || "https://silkrood.uz/zastavka/";
const python = process.env.PYTHON || "/usr/local/bin/python3";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const PHONE_CSS = `
html, body, #root, .app, .shell, .screen {
  max-width: none !important;
  width: 100% !important;
}
.grid { grid-template-columns: 1fr 1fr !important; }
.card-wall img { aspect-ratio: 9 / 16 !important; }
`;

// CSS viewport stays under the 1100px desktop breakpoint.
// deviceScaleFactor yields store pixel sizes (1080×1920 / 1290×2796 / 1284×2778).
const targets = [
  {
    name: "play-1080x1920",
    dir: path.join(__dirname, "screenshots"),
    width: 1080,
    height: 1920,
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    userAgent: ANDROID_UA,
  },
  {
    name: "ios-6.7",
    dir: path.resolve(__dirname, "../store/ios/screenshots/6.7"),
    width: 1290,
    height: 2796,
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA,
  },
  {
    name: "ios-6.5",
    dir: path.resolve(__dirname, "../store/ios/screenshots/6.5"),
    width: 1284,
    height: 2778,
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA,
  },
];

function flattenPng(file, width, height) {
  const script = `
from PIL import Image
im = Image.open(${JSON.stringify(file)}).convert("RGB")
if im.size != (${width}, ${height}):
    im = im.resize((${width}, ${height}), Image.Resampling.LANCZOS)
im.save(${JSON.stringify(file)}, "PNG")
print(im.size[0], im.size[1], im.mode)
`;
  const r = spawnSync(python, ["-c", script], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || `flatten failed for ${file}`);
  }
  return r.stdout.trim();
}

async function captureTarget(browser, target) {
  fs.mkdirSync(target.dir, { recursive: true });
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: target.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: target.userAgent,
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.addInitScript((css) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    const inject = () => {
      if (document.getElementById("store-phone-css")) return;
      const s = document.createElement("style");
      s.id = "store-phone-css";
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    document.addEventListener("DOMContentLoaded", inject);
    inject();
  }, PHONE_CSS);

  async function waitVisual() {
    await page.addStyleTag({ content: PHONE_CSS }).catch(() => {});
    await page.waitForFunction(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      const images = [...document.images];
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
        )
      );
    });
  }

  async function hideJunkCards() {
    await page.evaluate(() => {
      for (const card of document.querySelectorAll(".card-wall")) {
        const alt = (card.querySelector("img")?.alt || "").trim();
        const price = (card.querySelector(".badge span")?.textContent || "").replace(/\s/g, "");
        const n = Number(price);
        if (/test/i.test(alt) || n >= 10000 || n === 500000) card.remove();
      }
    });
  }

  async function saveSampleWallpapers() {
    const fabs = page.locator(".card-wall .save-fab");
    const n = Math.min(4, await fabs.count());
    for (let i = 0; i < n; i++) {
      const fab = fabs.nth(i);
      const label = (await fab.getAttribute("aria-label")) || "";
      if (/unsave|remove/i.test(label)) continue;
      await fab.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);
  }

  async function shot(name) {
    await waitVisual();
    const dest = path.join(target.dir, name);
    await page.screenshot({
      path: dest,
      type: "png",
      fullPage: false,
      animations: "disabled",
      omitBackground: false,
    });
    const info = flattenPng(dest, target.width, target.height);
    console.log(target.name, name, info);
  }

  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({ content: PHONE_CSS }).catch(() => {});
  await shot("01-onboarding.png");
  await page.getByRole("button", { name: "Next" }).click();
  await shot("02-onboarding-coins.png");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.locator("#auth-email").waitFor({ timeout: 15000 });
  await shot("03-login.png");
  await page.getByRole("tab", { name: "Register" }).click();
  await shot("04-register.png");
  await page.getByRole("tab", { name: "Log in" }).click();
  await page.locator("#auth-email").fill("aziz.karimov@gmail.com");
  await page.locator("#auth-password").fill("aziz123");
  await page.locator(".auth-form .btn-primary").click();
  await page.locator(".nav").waitFor({ timeout: 20000 });
  await page.locator(".card-wall").first().waitFor({ timeout: 20000 });
  await hideJunkCards();
  await saveSampleWallpapers();
  await hideJunkCards();
  await shot("05-home.png");
  await page.getByRole("button", { name: "Saved" }).click();
  await hideJunkCards();
  await shot("06-saved.png");
  await page.getByRole("button", { name: "Profile" }).click();
  await shot("07-profile.png");
  await page.getByRole("button", { name: "Top up" }).click();
  await page.locator(".sheet").first().waitFor({ timeout: 10000 });
  await shot("08-topup.png");
  await context.close();
}

function flattenBanner(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const script = `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert("RGB")
if im.size != (1024, 500):
    im = im.resize((1024, 500), Image.Resampling.LANCZOS)
im.save(${JSON.stringify(dest)}, "PNG")
print(im.size[0], im.size[1], im.mode)
`;
  const r = spawnSync(python, ["-c", script], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "banner flatten failed");
  }
  return r.stdout.trim();
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--hide-scrollbars"],
});

try {
  for (const target of targets) {
    await captureTarget(browser, target);
  }
} finally {
  await browser.close();
}

const feature = path.join(__dirname, "feature-graphic.png");
console.log("play-banner", flattenBanner(feature, feature));
console.log(
  "ios-banner",
  flattenBanner(feature, path.resolve(__dirname, "../store/ios/banner-1024x500.png"))
);

console.log("done");

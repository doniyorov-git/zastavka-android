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

const shots = [
  "01-onboarding.png",
  "02-onboarding-coins.png",
  "03-login.png",
  "04-register.png",
  "05-home.png",
  "06-saved.png",
  "07-profile.png",
  "08-topup.png",
];

// Phone CSS viewports (under the 1100px desktop breakpoint) × DSF = store pixels.
const targets = [
  {
    name: "play-16x9",
    dir: path.join(__dirname, "screenshots-16x9"),
    width: 1920,
    height: 1080,
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 3,
    userAgent: ANDROID_UA,
  },
  {
    name: "ios-16x9",
    dir: path.resolve(__dirname, "../store/ios/screenshots/16x9"),
    width: 1920,
    height: 1080,
    viewport: { width: 640, height: 360 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA,
  },
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

  async function waitVisual() {
    await page.waitForFunction(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(500);
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
        if (/^test$/i.test(alt) || Number(price) >= 10000) card.remove();
      }
    });
  }

  async function shot(name) {
    await waitVisual();
    const dest = path.join(target.dir, name);
    await page.screenshot({
      path: dest,
      type: "png",
      animations: "disabled",
      omitBackground: false,
    });
    const info = flattenPng(dest, target.width, target.height);
    console.log(target.name, name, info);
  }

  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
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
  await shot("05-home.png");
  await page.getByRole("button", { name: "Saved" }).click();
  await hideJunkCards();
  await shot("06-saved.png");
  await page.getByRole("button", { name: "Profile" }).click();
  await shot("07-profile.png");
  await page.getByRole("button", { name: "Top up" }).click();
  await page.locator(".sheet, .modal, .topup").first().waitFor({ timeout: 10000 }).catch(() => {});
  await shot("08-topup.png");
  await context.close();
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

console.log("done");

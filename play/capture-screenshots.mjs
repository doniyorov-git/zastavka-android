import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chrome =
  process.env.CHROME_PATH ||
  "/Users/mac/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.env.STORE_URL || "https://130.61.247.126.sslip.io/zastavka/";

const targets = [
  { dir: path.join(__dirname, "screenshots"), width: 1080, height: 1920 },
  { dir: path.resolve(__dirname, "../store/ios/screenshots/6.7"), width: 1290, height: 2796 },
  { dir: path.resolve(__dirname, "../store/ios/screenshots/6.5"), width: 1284, height: 2778 },
];

async function capture(size) {
  fs.mkdirSync(size.dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--hide-scrollbars"],
  });
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  });

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

  async function shot(name) {
    await waitVisual();
    await page.screenshot({ path: path.join(size.dir, name), type: "png" });
    console.log("saved", size.width, name);
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
  await shot("05-home.png");
  await page.getByRole("button", { name: "Saved" }).click();
  await shot("06-saved.png");
  await page.getByRole("button", { name: "Profile" }).click();
  await shot("07-profile.png");
  await page.getByRole("button", { name: "Top up" }).click();
  await shot("08-topup.png");
  await browser.close();
}

for (const size of targets) await capture(size);
console.log("done");

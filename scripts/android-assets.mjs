import { copyFileSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src1024 = join(root, "play/icon-1024.png");
const src512 = join(root, "play/icon-512.png");

function sips(args) {
  const r = spawnSync("sips", args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "sips failed");
  }
}

function resizePng(src, dest, size, flatten = false) {
  mkdirSync(dirname(dest), { recursive: true });
  sips(["-z", String(size), String(size), src, "--out", dest]);
  if (!flatten) return;
  const tmp = `${dest}.tmp.jpg`;
  sips(["-s", "format", "jpeg", dest, "--out", tmp]);
  sips(["-s", "format", "png", tmp, "--out", dest]);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

const mip = join(root, "android/app/src/main/res");
const sizes = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

for (const [folder, size] of sizes) {
  const dir = join(mip, folder);
  resizePng(src1024, join(dir, "ic_launcher.png"), size);
  resizePng(src1024, join(dir, "ic_launcher_round.png"), size);
  resizePng(src1024, join(dir, "ic_launcher_foreground.png"), Math.round(size * 2.25));
}

copyFileSync(src512, join(root, "play/icon-512.png"));
resizePng(src1024, join(root, "store/ios/icon-1024.png"), 1024, true);
resizePng(src1024, join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), 1024, true);

console.log("Android mipmaps and iOS 1024 (RGB, no alpha) written from play/icon-1024.png");

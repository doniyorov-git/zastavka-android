import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "play/icon.svg"));

function render(size, out) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  }).render().asPng();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
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
  render(size, join(mip, folder, "ic_launcher.png"));
  render(size, join(mip, folder, "ic_launcher_round.png"));
  render(Math.round(size * 2.25), join(mip, folder, "ic_launcher_foreground.png"));
}

render(512, join(root, "play/icon-512.png"));
render(1024, join(root, "play/icon-1024.png"));

const feature = readFileSync(join(root, "play/feature-graphic.svg"));
const featurePng = new Resvg(feature, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
writeFileSync(join(root, "play/feature-graphic.png"), featurePng);
console.log("Android and Play icons written");

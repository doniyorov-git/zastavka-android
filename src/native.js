import { Capacitor } from "@capacitor/core";
import { wallpaperSrc } from "./api";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      resolve(text.includes(",") ? text.split(",")[1] : text);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileNameFor(item) {
  const raw = String(item?.title || "wallpaper")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${raw || "wallpaper"}.jpg`;
}

export async function saveWallpaper(item) {
  const res = await fetch(wallpaperSrc(item.image));
  if (!res.ok) throw new Error("Could not download image");
  const blob = await res.blob();
  const name = fileNameFor(item);

  if (isNativeApp()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await blobToBase64(blob);
    const file = await Filesystem.writeFile({
      path: `Zastavka/${name}`,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: item.title || "Zastavka",
      url: file.uri,
      dialogTitle: item.title || "Zastavka",
    });
    return;
  }

  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
}

export async function initNativeShell() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native");
  const [{ StatusBar, Style }, { SplashScreen }, { Keyboard, KeyboardResize }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/keyboard"),
  ]);
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
  } catch {
    /* web preview */
  }
  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    /* older devices */
  }
  await SplashScreen.hide();
}

export async function listenBackButton(handler) {
  if (!isNativeApp()) return () => {};
  const { App } = await import("@capacitor/app");
  const sub = await App.addListener("backButton", handler);
  return () => sub.remove();
}

export async function exitApp() {
  if (!isNativeApp()) return;
  const { App } = await import("@capacitor/app");
  App.exitApp();
}

export function legalUrl(kind) {
  const file = kind === "terms" ? "terms.html" : "privacy.html";
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${file}`;
}

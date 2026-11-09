import { Capacitor, registerPlugin } from "@capacitor/core";
import { wallpaperSrc } from "./api";

const Wallpaper = registerPlugin("Wallpaper");

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

/**
 * Unlock/download action:
 * - Android: WallpaperManager sets Home + Lock (does not only save/share).
 * - iOS: Apple does not allow App Store apps to silently set Lock/Home wallpaper.
 *   Present the share sheet so the user can tap Use as Wallpaper.
 * - Web: file download fallback.
 */
export async function saveWallpaper(item, labels = {}) {
  const res = await fetch(wallpaperSrc(item.image));
  if (!res.ok) throw new Error("Could not download image");
  const blob = await res.blob();
  const name = fileNameFor(item);
  const dialogTitle = labels.dialogTitle || "Set as wallpaper";
  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await blobToBase64(blob);
    const file = await Filesystem.writeFile({
      path: `Zastavka/${name}`,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Wallpaper.set({ path: file.uri });
    } catch {
      await Wallpaper.set({ data });
    }
    return "set";
  }

  if (platform === "ios") {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await blobToBase64(blob);
    const file = await Filesystem.writeFile({
      path: `Zastavka/${name}`,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({
        title: dialogTitle,
        files: [file.uri],
        dialogTitle,
      });
    } catch (err) {
      if (isShareCanceled(err)) return "share-cancel";
      throw err;
    }
    return "share";
  }

  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
  return "download";
}

function isShareCanceled(err) {
  const text = `${err?.message || ""} ${err?.errorMessage || ""}`.toLowerCase();
  return text.includes("cancel") || text.includes("cancell");
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

export function openCheckoutPlaceholder() {
  if (isNativeApp() || typeof window === "undefined") return null;
  try {
    return window.open("about:blank", "zastavka-checkout");
  } catch {
    return null;
  }
}

export function closeCheckoutPlaceholder(win) {
  try {
    if (win && !win.closed) win.close();
  } catch {
    /* ignore */
  }
}

function navigateCheckoutWindow(url, pendingWindow) {
  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.location.replace(url);
    try {
      pendingWindow.focus();
    } catch {
      /* ignore */
    }
    return true;
  }
  try {
    const opened = window.open(url, "zastavka-checkout");
    if (opened) {
      try {
        opened.focus();
      } catch {
        /* ignore */
      }
      return true;
    }
  } catch {
    /* popup blocked */
  }
  window.location.assign(url);
  return true;
}

export async function openPaymentCheckout(url, pendingWindow) {
  if (!url) throw new Error("Payment URL missing");
  if (isNativeApp()) {
    closeCheckoutPlaceholder(pendingWindow);
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "fullscreen" });
      return;
    } catch {
      navigateCheckoutWindow(url);
      return;
    }
  }
  navigateCheckoutWindow(url, pendingWindow);
}

export async function listenAppResume(handler) {
  if (!isNativeApp()) return () => {};
  const { App } = await import("@capacitor/app");
  const sub = await App.addListener("appStateChange", (state) => {
    if (state.isActive) handler();
  });
  let browserSub = { remove: () => {} };
  try {
    const { Browser } = await import("@capacitor/browser");
    browserSub = await Browser.addListener("browserFinished", handler);
  } catch {
    /* web */
  }
  return () => {
    sub.remove();
    browserSub.remove?.();
  };
}

export function legalUrl(kind) {
  const file = kind === "terms" ? "terms.html" : kind === "delete" ? "delete-account.html" : "privacy.html";
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${file}`;
}

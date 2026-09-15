const BASE = import.meta.env.VITE_API_BASE || "/zastavka-api";

export function apiUrl(path) {
  if (!path) return BASE;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/zastavka-api")) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function wallpaperSrc(image) {
  if (!image) return "";
  if (image.startsWith("http") || image.startsWith("data:")) return image;
  return apiUrl(image);
}

export async function api(path, opts = {}) {
  const token = localStorage.getItem("zastavka-token");
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(apiUrl(path), { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export function setToken(token) {
  if (token) localStorage.setItem("zastavka-token", token);
  else localStorage.removeItem("zastavka-token");
}

export function getToken() {
  return localStorage.getItem("zastavka-token");
}

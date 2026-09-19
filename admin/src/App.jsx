import { useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, setToken, wallpaperSrc } from "./api";
import { LANGS, t as tr } from "./i18n";

const LANG_KEY = "zastavka-admin-lang";

function useLang() {
  const [lang, setLang] = useState(() => {
    const v = localStorage.getItem(LANG_KEY);
    return v === "ru" || v === "zh" ? v : "en";
  });
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (key) => tr(lang, key);
  return { lang, setLang, t };
}

export default function App() {
  const i18n = useLang();
  const [token, setTok] = useState(getToken());
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState({ users: 0, wallpapers: 0, purchases: 0 });
  const [wallpapers, setWallpapers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [pq, setPq] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  async function loadAll() {
    const [s, w, p, u] = await Promise.all([
      api("/admin/stats"),
      api("/admin/wallpapers"),
      api("/admin/purchases"),
      api("/admin/users"),
    ]);
    setStats(s);
    setWallpapers(w.wallpapers || []);
    setPurchases(p.purchases || []);
    setUsers(u.users || []);
  }

  useEffect(() => {
    if (!token) return;
    loadAll().catch((err) => {
      if (err.status === 401) {
        setToken(null);
        setTok(null);
      }
    });
  }, [token]);

  if (!token) return <Login i18n={i18n} onOk={(tk) => { setToken(tk); setTok(tk); }} />;

  const filteredWallpapers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return wallpapers;
    return wallpapers.filter((w) => w.title.toLowerCase().includes(s) || w.id.toLowerCase().includes(s));
  }, [wallpapers, q]);

  const filteredPurchases = useMemo(() => {
    const s = pq.trim().toLowerCase();
    if (!s) return purchases;
    return purchases.filter(
      (p) =>
        p.userName.toLowerCase().includes(s) ||
        p.userEmail.toLowerCase().includes(s) ||
        p.wallpaperTitle.toLowerCase().includes(s)
    );
  }, [purchases, pq]);

  const { t, lang, setLang } = i18n;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Zastavka</div>
        <nav>
          {["dashboard", "images", "purchases", "users", "payments"].map((id) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {t(id)}
            </button>
          ))}
          <a href="/zastavka-api/docs" target="_blank" rel="noreferrer">
            {t("docs")}
          </a>
        </nav>
        <div className="side-foot">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("language")}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeLabel}
              </option>
            ))}
          </select>
          <button
            className="ghost"
            onClick={() => {
              setToken(null);
              setTok(null);
            }}
          >
            {t("logout")}
          </button>
        </div>
      </aside>
      <main className="main">
        {error && <div className="banner">{error}</div>}
        {tab === "dashboard" && (
          <section>
            <h1>{t("dashboard")}</h1>
            <div className="stats">
              <article>
                <small>{t("usersCount")}</small>
                <strong>{stats.users}</strong>
              </article>
              <article>
                <small>{t("imagesCount")}</small>
                <strong>{stats.wallpapers}</strong>
              </article>
              <article>
                <small>{t("purchasesCount")}</small>
                <strong>{stats.purchases}</strong>
              </article>
            </div>
          </section>
        )}

        {tab === "images" && (
          <section>
            <div className="toolbar">
              <h1>{t("images")}</h1>
              <button className="primary" onClick={() => setEditing({ id: null, title: "", price: 50, tall: false, file: null })}>
                {t("addImage")}
              </button>
            </div>
            <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchImages")} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>{t("title")}</th>
                    <th>{t("price")}</th>
                    <th>{t("created")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredWallpapers.length === 0 && (
                    <tr>
                      <td colSpan={5}>{t("noRows")}</td>
                    </tr>
                  )}
                  {filteredWallpapers.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <img className="thumb" src={wallpaperSrc(w.image)} alt="" />
                      </td>
                      <td>{w.title}</td>
                      <td>{w.price}</td>
                      <td>{new Date(w.createdAt).toLocaleString()}</td>
                      <td className="actions">
                        <button onClick={() => setEditing({ ...w, file: null })}>{t("edit")}</button>
                        <button
                          className="danger"
                          onClick={async () => {
                            if (!confirm(t("delete") + "?")) return;
                            try {
                              await api(`/admin/wallpapers/${w.id}`, { method: "DELETE" });
                              await loadAll();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "purchases" && (
          <section>
            <h1>{t("purchases")}</h1>
            <input className="search" value={pq} onChange={(e) => setPq(e.target.value)} placeholder={t("searchPurchases")} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("buyer")}</th>
                    <th>{t("wallpaper")}</th>
                    <th>{t("coins")}</th>
                    <th>{t("created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={4}>{t("noRows")}</td>
                    </tr>
                  )}
                  {filteredPurchases.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div>{p.userName}</div>
                        <small>{p.userEmail}</small>
                      </td>
                      <td>{p.wallpaperTitle}</td>
                      <td>{p.price}</td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "users" && (
          <section>
            <h1>{t("users")}</h1>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("email")}</th>
                    <th>{t("coins")}</th>
                    <th>{t("purchases")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4}>{t("noRows")}</td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.coins}</td>
                      <td>{u.purchaseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "payments" && <BmcPanel i18n={i18n} onError={setError} />}
      </main>

      {editing && (
        <ImageModal
          i18n={i18n}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAll();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function Login({ i18n, onOk }) {
  const { t, lang, setLang } = i18n;
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const data = await api("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      onOk(data.token);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <h1>{t("loginTitle")}</h1>
        <label>
          {t("password")}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="primary" disabled={busy}>
          {t("signIn")}
        </button>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}

function ImageModal({ i18n, item, onClose, onSaved, onError }) {
  const { t } = i18n;
  const isNew = !item.id;
  const inputRef = useRef(null);
  const [title, setTitle] = useState(item.title || "");
  const [price, setPrice] = useState(item.price || 50);
  const [tall, setTall] = useState(Boolean(item.tall));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = preview || (item.image ? wallpaperSrc(item.image) : "");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(next) {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      onError("Only image files are allowed");
      return;
    }
    setFile(next);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      body.append("title", title);
      body.append("price", String(price));
      body.append("tall", String(tall));
      if (file) body.append("file", file);
      if (isNew) {
        if (!file) throw new Error("Image file is required");
        await api("/admin/wallpapers", { method: "POST", body });
      } else {
        await api(`/admin/wallpapers/${item.id}`, { method: "PATCH", body });
      }
      onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? t("addImage") : t("edit")}</h2>
        <label>
          {t("title")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          {t("price")}
          <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <div className="file-field">
          <span>{t("file")}</span>
          <input
            ref={inputRef}
            className="file-hidden"
            type="file"
            accept="image/*"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className={`dropzone ${drag ? "drag" : ""} ${shown ? "has-file" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {shown ? <img src={shown} alt="" /> : <span className="drop-icon">⬆</span>}
            <strong>{shown ? t("dropReplace") : t("dropHint")}</strong>
            {file ? <small>{t("chosenFile").replace("{name}", file.name)}</small> : null}
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={tall} onChange={(e) => setTall(e.target.checked)} />
          {t("tall")}
        </label>
        <div className="row">
          <button type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="primary" disabled={busy}>
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function BmcPanel({ i18n, onError }) {
  const { t } = i18n;
  const [settings, setSettings] = useState(null);
  const [topups, setTopups] = useState([]);
  const [form, setForm] = useState({
    username: "admin09wet",
    pageUrl: "https://www.buymeacoffee.com/admin09wet",
    accessToken: "",
    webhookSecret: "",
    extraId100: "",
    extraId300: "",
    extraId750: "",
    publicOrigin: "https://silkrood.uz",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const [s, p] = await Promise.all([api("/admin/bmc"), api("/admin/topups")]);
    setSettings(s.settings);
    setTopups(p.topups || []);
    setForm((cur) => ({
      ...cur,
      username: s.settings.username || "admin09wet",
      pageUrl: s.settings.pageUrl || "https://www.buymeacoffee.com/admin09wet",
      accessToken: "",
      webhookSecret: "",
      extraId100: s.settings.extraId100 || "",
      extraId300: s.settings.extraId300 || "",
      extraId750: s.settings.extraId750 || "",
      publicOrigin: s.settings.publicOrigin || "https://silkrood.uz",
    }));
  }

  useEffect(() => {
    load().catch((err) => onError(err.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const data = await api("/admin/bmc", { method: "PUT", body: JSON.stringify(form) });
      setSettings(data.settings);
      setForm((cur) => ({ ...cur, accessToken: "", webhookSecret: "" }));
      setSaved(true);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>{t("payments")}</h1>
      <p className="hint">{t("bmcHint")}</p>
      {settings && (
        <p className={`status-pill ${settings.configured ? "ok" : "warn"}`}>
          {settings.configured ? t("bmcReady") : t("bmcMissing")}
        </p>
      )}
      <form className="settings-card" onSubmit={save}>
        <label>
          {t("bmcUsername")}
          <input value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} autoComplete="off" />
        </label>
        <label>
          {t("bmcPageUrl")}
          <input value={form.pageUrl} onChange={(e) => setForm((c) => ({ ...c, pageUrl: e.target.value }))} autoComplete="off" />
        </label>
        <label>
          {t("bmcToken")}
          <input
            type="password"
            value={form.accessToken}
            placeholder={settings?.accessTokenSet ? settings.accessTokenMask : t("secretPlaceholder")}
            onChange={(e) => setForm((c) => ({ ...c, accessToken: e.target.value }))}
            autoComplete="new-password"
          />
        </label>
        <label>
          {t("bmcWebhookSecret")}
          <input
            type="password"
            value={form.webhookSecret}
            placeholder={settings?.webhookSecretSet ? settings.webhookSecretMask : t("secretPlaceholder")}
            onChange={(e) => setForm((c) => ({ ...c, webhookSecret: e.target.value }))}
            autoComplete="new-password"
          />
        </label>
        <label>
          {t("bmcExtra100")}
          <input value={form.extraId100} onChange={(e) => setForm((c) => ({ ...c, extraId100: e.target.value }))} autoComplete="off" />
        </label>
        <label>
          {t("bmcExtra300")}
          <input value={form.extraId300} onChange={(e) => setForm((c) => ({ ...c, extraId300: e.target.value }))} autoComplete="off" />
        </label>
        <label>
          {t("bmcExtra750")}
          <input value={form.extraId750} onChange={(e) => setForm((c) => ({ ...c, extraId750: e.target.value }))} autoComplete="off" />
        </label>
        <label>
          {t("publicOrigin")}
          <input value={form.publicOrigin} onChange={(e) => setForm((c) => ({ ...c, publicOrigin: e.target.value }))} />
        </label>
        {settings && (
          <div className="readonly">
            <p>
              <small>{t("webhookUrl")}</small>
              <code>{settings.webhookUrl}</code>
            </p>
            <p>
              <small>{t("callbackUrl")}</small>
              <code>{settings.callbackUrl}</code>
            </p>
            <p>
              <small>{t("returnUrl")}</small>
              <code>{settings.returnUrl}</code>
            </p>
          </div>
        )}
        <div className="row">
          {saved && <span className="ok-text">{t("savedOk")}</span>}
          <button className="primary" disabled={busy}>
            {t("save")}
          </button>
        </div>
      </form>

      <h2 className="subhead">{t("topups")}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("order")}</th>
              <th>{t("coins")}</th>
              <th>{t("amount")}</th>
              <th>{t("status")}</th>
              <th>{t("created")}</th>
            </tr>
          </thead>
          <tbody>
            {topups.length === 0 && (
              <tr>
                <td colSpan={5}>{t("noRows")}</td>
              </tr>
            )}
            {topups.map((item) => (
              <tr key={item.id}>
                <td>
                  <div>{item.orderId}</div>
                  <small>{item.sessionId || "—"}</small>
                </td>
                <td>{item.coins}</td>
                <td>
                  {item.amount} {item.currency}
                </td>
                <td>{item.status}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

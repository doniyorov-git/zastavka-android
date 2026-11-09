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

  if (!token) return <Login i18n={i18n} onOk={(tk) => { setToken(tk); setTok(tk); }} />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Zastavka</div>
        <nav>
          {["dashboard", "images", "purchases", "users", "earnings"].map((id) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {t(id === "earnings" ? "withdraw" : id)}
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
              <article>
                <small>{t("bmcGross")}</small>
                <strong>{formatMoney(stats.bmcGross, stats.bmcCurrency)}</strong>
              </article>
              <article>
                <small>{t("bmcAvailable")}</small>
                <strong>{formatMoney(stats.bmcAvailable, stats.bmcCurrency)}</strong>
              </article>
              <article>
                <small>{t("bmcWithdrawn")}</small>
                <strong>{formatMoney(stats.bmcWithdrawn, stats.bmcCurrency)}</strong>
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

        {tab === "earnings" && <BmcPanel i18n={i18n} onError={setError} />}
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

function formatMoney(amount, currency = "USD") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || "USD"}`;
  }
}

function statusClass(status) {
  if (status === "paid") return "ok";
  if (status === "cancelled" || status === "refunded") return "bad";
  return "warn";
}

function FilterSelect({ label, value, onChange, options, placeholder, searchPlaceholder, disabled, required }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    const list = s
      ? options.filter(
          (item) =>
            item.label.toLowerCase().includes(s) || String(item.value).toLowerCase().includes(s)
        )
      : options;
    if (value && !list.some((item) => item.value === value)) {
      const selected = options.find((item) => item.value === value);
      if (selected) return [selected, ...list];
    }
    return list;
  }, [options, query, value]);

  return (
    <label className="filter-select">
      {label}
      <input
        type="search"
        value={query}
        disabled={disabled}
        placeholder={searchPlaceholder}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select value={value} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {filtered.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function payoutStatusLabel(status, t) {
  if (status === "pending" || status === "jarayonda") return t("pending");
  if (status === "paid") return t("paid");
  if (status === "cancelled") return t("cancelled");
  return t(status) || status;
}

function BmcPanel({ i18n, onError }) {
  const { t } = i18n;
  const [payouts, setPayouts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [summary, setSummary] = useState({
    gross: 0,
    available: 0,
    withdrawn: 0,
    pending: 0,
    incomingCount: 0,
    currency: "USD",
    byCurrency: [],
  });
  const [payoutForm, setPayoutForm] = useState({ amount: "", bankId: "", branchId: "", currency: "USD" });
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecretSet, setWebhookSecretSet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const e = await api("/admin/bmc/earnings");
    setPayouts(e.payouts || []);
    setBanks(e.banks || []);
    setSummary(e.summary || summary);
    setPayoutForm((cur) => ({ ...cur, currency: e.summary?.currency || "USD" }));
    setCheckoutUrl(e.settings?.checkoutUrl || "");
    setWebhookUrl(e.settings?.webhookUrl || "");
    setWebhookSecretSet(Boolean(e.settings?.webhookSecretSet));
    setWebhookSecret("");
  }

  async function saveCheckout(ev) {
    ev.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const body = { checkoutUrl };
      if (webhookSecret.trim()) body.webhookSecret = webhookSecret.trim();
      const data = await api("/admin/bmc", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setCheckoutUrl(data.settings?.checkoutUrl || checkoutUrl);
      setWebhookUrl(data.settings?.webhookUrl || webhookUrl);
      setWebhookSecretSet(Boolean(data.settings?.webhookSecretSet));
      setWebhookSecret("");
      setNotice(t("savedOk"));
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch((err) => onError(err.message));
  }, []);

  async function submitPayout(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const value = Number(payoutForm.amount);
    if (!Number.isFinite(value) || value <= 0) {
      setBusy(false);
      onError(t("withdrawAmount"));
      return;
    }
    if (value > available + 0.009) {
      setBusy(false);
      onError(`${t("remaining")}: ${formatMoney(available, summary.currency)}`);
      return;
    }
    try {
      const data = await api("/admin/bmc/payouts", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payoutForm.amount),
          currency: payoutForm.currency || summary.currency,
          bankId: payoutForm.bankId,
          branchId: payoutForm.branchId,
        }),
      });
      setPayouts(data.payouts || []);
      setSummary(data.summary || summary);
      setPayoutForm((cur) => ({ ...cur, amount: "", bankId: "", branchId: "" }));
      setNotice(t("payoutCreated"));
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function patchPayout(id, status) {
    try {
      const data = await api(`/admin/bmc/payouts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setPayouts(data.payouts || []);
      setSummary(data.summary || summary);
    } catch (err) {
      onError(err.message);
    }
  }

  const available = Number(summary.available) || 0;
  const selectedBank = banks.find((item) => item.id === payoutForm.bankId);
  const branchOptions = (selectedBank?.branches || []).map((item) => ({ value: item.id, label: item.name }));
  const bankOptions = banks.map((item) => ({ value: item.id, label: item.name }));

  return (
    <section>
      <h1>{t("withdraw")}</h1>
      <div className="stats four">
        <article>
          <small>{t("bmcGross")}</small>
          <strong>{formatMoney(summary.gross, summary.currency)}</strong>
        </article>
        <article>
          <small>{t("bmcAvailable")}</small>
          <strong>{formatMoney(summary.available, summary.currency)}</strong>
        </article>
        <article>
          <small>{t("bmcWithdrawn")}</small>
          <strong>{formatMoney(summary.withdrawn, summary.currency)}</strong>
        </article>
        <article>
          <small>{t("bmcPendingOut")}</small>
          <strong>{formatMoney(summary.pending, summary.currency)}</strong>
        </article>
      </div>
      {notice && <p className="ok-text">{notice}</p>}

      <form className="payout-card" onSubmit={saveCheckout}>
        <label>
          {t("checkoutUrl")}
          <input
            type="text"
            value={checkoutUrl}
            onChange={(e) => setCheckoutUrl(e.target.value)}
            placeholder="https://www.buymeacoffee.com/admin09wet/e/577212"
            required
          />
        </label>
        <label>
          {t("bmcWebhookSecret")}
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={webhookSecretSet ? t("secretPlaceholder") : "BMC Integrations → Signing Secret"}
            autoComplete="off"
          />
          <small>{webhookSecretSet ? t("bmcReady") : t("bmcMissing")}</small>
        </label>
        {webhookUrl ? (
          <label>
            {t("webhookUrl")}
            <input type="text" value={webhookUrl} readOnly onFocus={(e) => e.target.select()} />
          </label>
        ) : null}
        <button className="primary checkout-save" disabled={busy}>
          {t("save")}
        </button>
      </form>

      <form className="payout-card" onSubmit={submitPayout}>
        <h2 className="subhead">{t("withdraw")}</h2>
        <div className="payout-grid">
          <label>
            {t("withdrawAmount")}
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={available > 0 ? available : undefined}
              value={payoutForm.amount}
              onChange={(e) => setPayoutForm((c) => ({ ...c, amount: e.target.value }))}
              required
            />
            <small>
              {t("remaining")}: {formatMoney(available, summary.currency)}
            </small>
          </label>
          <FilterSelect
            label={t("bank")}
            value={payoutForm.bankId}
            options={bankOptions}
            placeholder={t("selectBank")}
            searchPlaceholder={t("searchBank")}
            required
            onChange={(bankId) => setPayoutForm((c) => ({ ...c, bankId, branchId: "" }))}
          />
          <FilterSelect
            key={payoutForm.bankId || "no-bank"}
            label={t("branch")}
            value={payoutForm.branchId}
            options={branchOptions}
            placeholder={t("selectBranch")}
            searchPlaceholder={t("searchBranch")}
            required
            disabled={!payoutForm.bankId}
            onChange={(branchId) => setPayoutForm((c) => ({ ...c, branchId }))}
          />
          <button className="primary payout-submit" disabled={busy || available <= 0}>
            {t("withdraw")}
          </button>
        </div>
      </form>

      <h2 className="subhead">{t("payoutHistory")}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("amount")}</th>
              <th>{t("bank")}</th>
              <th>{t("branch")}</th>
              <th>{t("status")}</th>
              <th>{t("created")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 && (
              <tr>
                <td colSpan={6}>{t("noRows")}</td>
              </tr>
            )}
            {payouts.map((item) => (
              <tr key={item.id}>
                <td>{formatMoney(item.amount, item.currency)}</td>
                <td>{item.bank || "—"}</td>
                <td>{item.branch || "—"}</td>
                <td>
                  <span className={`status-pill ${statusClass(item.status)}`}>{payoutStatusLabel(item.status, t)}</span>
                </td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td className="actions">
                  {item.status === "pending" && (
                    <>
                      <button type="button" onClick={() => patchPayout(item.id, "paid")}>
                        {t("markPaid")}
                      </button>
                      <button type="button" className="danger" onClick={() => patchPayout(item.id, "cancelled")}>
                        {t("markCancelled")}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

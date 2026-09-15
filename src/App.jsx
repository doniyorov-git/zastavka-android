import { useEffect, useMemo, useRef, useState } from "react";
import { USER, PACKAGES, formatUsd, usdForCoins } from "./data";
import { LANGS, langLabel, useI18n } from "./i18n";
import { api, getToken, setToken, wallpaperSrc } from "./api";
import { Icon, Logo } from "./icons";
import { exitApp, initNativeShell, legalUrl, listenAppResume, listenBackButton, openPaymentCheckout, saveWallpaper } from "./native";
import {
  IllustrationGallery,
  IllustrationCoins,
  IllustrationHeart,
  IllustrationEmpty,
} from "./illustrations";

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button className="btn btn-primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function CoinMark({ size = 18 }) {
  return <Icon name="coin" size={size} />;
}

export default function App() {
  const { t, lang } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const [flow, setFlow] = useState(() => (params.get("screen") === "app" ? "app" : "onboarding"));
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState(() => params.get("tab") || "home");
  const [coins, setCoins] = useState(80);
  const [purchased, setPurchased] = useState(["w8"]);
  const [saved, setSaved] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [user, setUser] = useState(USER);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showLow, setShowLow] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showLegal, setShowLegal] = useState(null);
  const [toast, setToast] = useState("");
  const [download, setDownload] = useState(null);
  const [fly, setFly] = useState(null);
  const [pkg, setPkg] = useState(PACKAGES[1].id);
  const [coinQty, setCoinQty] = useState(String(PACKAGES[1].coins));
  const [payAmount, setPayAmount] = useState(formatUsd(PACKAGES[1].usd));
  const [paying, setPaying] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const coinBtnRef = useRef(null);
  const phoneRef = useRef(null);

  useEffect(() => {
    api("/wallpapers")
      .then((data) => setWallpapers(data.wallpapers || []))
      .catch(() => setWallpapers([]));
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api("/me")
      .then(({ user: u }) => {
        setUser({ ...USER, ...u });
        setCoins(u.coins);
        setPurchased(u.purchased || []);
        setSaved(u.saved || []);
        setFlow("app");
      })
      .catch(() => setToken(null));
  }, []);

  useEffect(() => {
    initNativeShell();
  }, []);

  useEffect(() => {
    let off = () => {};
    listenBackButton(() => {
      if (showLegal) setShowLegal(null);
      else if (showLang) setShowLang(false);
      else if (showTopUp) setShowTopUp(false);
      else if (showLow) setShowLow(false);
      else if (flow === "app" && tab !== "home") setTab("home");
      else exitApp();
    }).then((remove) => {
      off = remove;
    });
    return () => off();
  }, [flow, tab, showLang, showLow, showTopUp, showLegal]);

  useEffect(() => {
    if (!toast) return;
    const tmr = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(tmr);
  }, [toast]);

  useEffect(() => {
    if (flow !== "app") return;
    const search = new URLSearchParams(window.location.search);
    const payState = search.get("pay");
    const sessionId = search.get("sessionId");
    let orderId = "";
    try {
      orderId = JSON.parse(sessionStorage.getItem("zastavka-topup") || "{}").orderId || "";
    } catch {
      orderId = "";
    }
    if (payState === "cancel") notify(t("toastPayFail"));
    if (sessionId || orderId) refreshTopup(orderId, sessionId);
    if (payState || sessionId) {
      search.delete("pay");
      search.delete("sessionId");
      const q = search.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
    }
  }, [flow]);

  useEffect(() => {
    let off = () => {};
    listenAppResume(() => {
      try {
        const pending = JSON.parse(sessionStorage.getItem("zastavka-topup") || "{}");
        if (pending.orderId || pending.sessionId) refreshTopup(pending.orderId, pending.sessionId);
      } catch {
        /* ignore */
      }
    }).then((remove) => {
      off = remove;
    });
    return () => off();
  }, []);

  function applyCoins(qty, packageId) {
    const n = Number(qty);
    const match = PACKAGES.find((p) => p.id === packageId) || PACKAGES.find((p) => p.coins === n);
    setPkg(match ? match.id : "");
    setCoinQty(qty);
    setPayAmount(formatUsd(match ? match.usd : usdForCoins(n)));
  }

  const savedItems = useMemo(
    () => wallpapers.filter((w) => saved.includes(w.id)),
    [saved, wallpapers]
  );

  function notify(msg) {
    setToast(msg);
  }

  async function refreshTopup(orderId, sessionId) {
    if (!getToken() || (!orderId && !sessionId)) return null;
    const query = new URLSearchParams();
    if (orderId) query.set("orderId", orderId);
    if (sessionId) query.set("sessionId", sessionId);
    try {
      const data = await api(`/topup/status?${query.toString()}`);
      if (data.user) {
        setUser({ ...USER, ...data.user });
        setCoins(data.user.coins);
        setPurchased(data.user.purchased || []);
        setSaved(data.user.saved || []);
      }
      if (data.status === "paid") {
        sessionStorage.removeItem("zastavka-topup");
        notify(t("toastToppedUp", { usd: formatUsd(usdForCoins(data.coins)) }));
      } else if (data.status === "failed" || data.status === "expired") {
        sessionStorage.removeItem("zastavka-topup");
        notify(t("toastPayFail"));
      }
      return data;
    } catch {
      return null;
    }
  }

  function openTopUp() {
    setShowLow(false);
    setShowTopUp(true);
  }

  function flyCoin(fromEl) {
    const phone = phoneRef.current?.getBoundingClientRect();
    const dest = coinBtnRef.current?.getBoundingClientRect();
    const from = fromEl?.getBoundingClientRect();
    if (!phone || !dest || !from) return;
    setFly({
      x: from.left - phone.left + from.width / 2 - 12,
      y: from.top - phone.top + from.height / 2 - 12,
      dx: dest.left - from.left,
      dy: dest.top - from.top,
    });
    setTimeout(() => setFly(null), 700);
  }

  async function startDownload(item) {
    setDownload({ id: item.id, progress: 10 });
    const tick = setInterval(() => {
      setDownload((cur) =>
        cur && cur.id === item.id ? { ...cur, progress: Math.min(88, cur.progress + 10) } : cur
      );
    }, 160);
    try {
      await saveWallpaper(item);
      clearInterval(tick);
      setDownload({ id: item.id, progress: 100 });
      setTimeout(() => {
        setDownload(null);
        notify(t("toastDownloaded"));
      }, 350);
    } catch (err) {
      clearInterval(tick);
      setDownload(null);
      notify(err.message || t("toastDownloadFail"));
    }
  }

  async function onWallpaperTap(item, event) {
    if (download) return;
    if (purchased.includes(item.id)) {
      startDownload(item);
      return;
    }
    if (coins < item.price) {
      setShowLow(true);
      return;
    }
    try {
      flyCoin(event.currentTarget);
      const { user: u } = await api("/purchases", {
        method: "POST",
        body: JSON.stringify({ wallpaperId: item.id }),
      });
      setCoins(u.coins);
      setPurchased(u.purchased || []);
      notify(t("toastPurchased"));
      setTimeout(() => startDownload(item), 420);
    } catch (err) {
      if (err.code === "LOW_BALANCE" || err.status === 400) setShowLow(true);
      else notify(err.message);
    }
  }

  async function toggleSave(id, event) {
    event.stopPropagation();
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    try {
      await api("/me", { method: "PATCH", body: JSON.stringify({ saved: next }) });
    } catch {
      /* keep local */
    }
  }

  async function pay() {
    if (paying) return;
    const qty = Number(coinQty);
    if (!Number.isFinite(qty) || qty < 1) {
      notify(t("toastCoins"));
      return;
    }
    setPaying(true);
    try {
      const data = await api("/topup", {
        method: "POST",
        body: JSON.stringify({ coins: qty, usd: usdForCoins(qty), lang }),
      });
      sessionStorage.setItem(
        "zastavka-topup",
        JSON.stringify({ orderId: data.orderId, sessionId: data.sessionId, coins: qty })
      );
      setShowTopUp(false);
      notify(t("toastPayRedirect"));
      await openPaymentCheckout(data.sessionUrl);
    } catch (err) {
      notify(err.message);
    } finally {
      setPaying(false);
    }
  }

  async function signIn({ mode, name, email, password }) {
    setAuthBusy(true);
    try {
      const path = mode === "register" ? "/auth/register" : "/auth/login";
      const body = mode === "register" ? { name, email, password } : { email, password };
      const { token, user: u } = await api(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(token);
      setUser({ ...USER, ...u });
      setCoins(u.coins);
      setPurchased(u.purchased || []);
      setSaved(u.saved || []);
      setFlow("app");
      setTab("home");
    } catch (err) {
      notify(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    setToken(null);
    setFlow("auth");
    setTab("home");
  }

  function goTab(next) {
    setTab(next);
  }

  return (
    <div className="stage">
      <div className="phone" ref={phoneRef}>
        <div className="phone-screen">
          {flow === "onboarding" && (
            <Onboarding
              step={step}
              onSkip={() => setFlow("auth")}
              onNext={() => {
                if (step === 2) setFlow("auth");
                else setStep((s) => s + 1);
              }}
            />
          )}

          {flow === "auth" && (
            <Auth onSubmit={signIn} loading={authBusy} onOpenLegal={setShowLegal} />
          )}

          {flow === "app" && (
            <>
              {tab === "home" && (
                <Home
                  user={user}
                  wallpapers={wallpapers}
                  coins={coins}
                  purchased={purchased}
                  saved={saved}
                  download={download}
                  coinBtnRef={coinBtnRef}
                  onTopUp={openTopUp}
                  onTap={onWallpaperTap}
                  onSave={toggleSave}
                />
              )}
              {tab === "saved" && (
                <Saved
                  items={savedItems}
                  coins={coins}
                  purchased={purchased}
                  saved={saved}
                  download={download}
                  coinBtnRef={coinBtnRef}
                  onTopUp={openTopUp}
                  onTap={onWallpaperTap}
                  onSave={toggleSave}
                  onBrowse={() => setTab("home")}
                />
              )}
              {tab === "profile" && (
                <Profile
                  user={user}
                  coins={coins}
                  onTopUp={openTopUp}
                  onLogout={logout}
                  onOpenLang={() => setShowLang(true)}
                />
              )}
              <nav className="nav" aria-label={t("navMain")}>
                <span className={`nav-pill nav-pill--${tab}`} />
                <button
                  className={`nav-btn ${tab === "saved" ? "active" : ""}`}
                  onClick={() => goTab("saved")}
                  aria-label={t("navSaved")}
                >
                  <Icon name={tab === "saved" ? "bookmark-filled" : "bookmark"} />
                </button>
                <button
                  className={`nav-btn ${tab === "home" ? "active" : ""}`}
                  onClick={() => goTab("home")}
                  aria-label={t("navHome")}
                >
                  <Icon name={tab === "home" ? "home-filled" : "home"} />
                </button>
                <button
                  className={`nav-btn ${tab === "profile" ? "active" : ""}`}
                  onClick={() => goTab("profile")}
                  aria-label={t("navProfile")}
                >
                  <Icon name={tab === "profile" ? "user-filled" : "user"} />
                </button>
              </nav>
            </>
          )}

          {showTopUp && (
            <TopUpSheet
              pkg={pkg}
              coinQty={coinQty}
              amount={payAmount}
              onSelectPackage={(id) => {
                const selected = PACKAGES.find((p) => p.id === id);
                if (selected) applyCoins(String(selected.coins), selected.id);
              }}
              onCoinQtyChange={(value) => {
                const cleaned = value.replace(/\D/g, "").slice(0, 6);
                applyCoins(cleaned);
              }}
              paying={paying}
              onClose={() => setShowTopUp(false)}
              onPay={pay}
            />
          )}

          {showLow && (
            <div className="modal-backdrop" onClick={() => setShowLow(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <IllustrationCoins />
                <h3>{t("lowTitle")}</h3>
                <p>{t("lowText")}</p>
                <PrimaryButton onClick={openTopUp}>{t("topUp")}</PrimaryButton>
                <button className="skip" style={{ alignSelf: "center", marginTop: 10 }} onClick={() => setShowLow(false)}>
                  {t("later")}
                </button>
              </div>
            </div>
          )}

          {showLang && <LanguageSheet onClose={() => setShowLang(false)} />}
          {showLegal && <LegalSheet kind={showLegal} onClose={() => setShowLegal(null)} />}

          {toast && <div className="toast">{toast}</div>}

          {fly && (
            <div
              className="fly-coin"
              style={{
                left: fly.x,
                top: fly.y,
                "--dx": `${fly.dx}px`,
                "--dy": `${fly.dy}px`,
              }}
            >
              <CoinMark size={28} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Onboarding({ step, onSkip, onNext }) {
  const { t } = useI18n();
  const slides = [
    { title: t("onboard1Title"), text: t("onboard1Text"), art: <IllustrationGallery /> },
    { title: t("onboard2Title"), text: t("onboard2Text"), art: <IllustrationCoins /> },
    { title: t("onboard3Title"), text: t("onboard3Text"), art: <IllustrationHeart /> },
  ];
  const item = slides[step];
  return (
    <section className="screen onboarding">
      <button className="skip" onClick={onSkip}>
        {t("skip")}
      </button>
      <div className="illustration-wrap">{item.art}</div>
      <div>
        <h1>{item.title}</h1>
        <p>{item.text}</p>
        <div className="dots">
          {slides.map((_, i) => (
            <span key={i} className={`dot ${i === step ? "active" : ""}`} />
          ))}
        </div>
        <PrimaryButton onClick={onNext}>{step === 2 ? t("getStarted") : t("next")}</PrimaryButton>
      </div>
    </section>
  );
}

function Auth({ onSubmit, loading, onOpenLegal }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    onSubmit({ mode, name, email, password });
  }

  return (
    <section className="screen auth">
      <div className="auth-brand">
        <Logo />
        <h1>Zastavka</h1>
        <span>{t("tagline")}</span>
      </div>
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          {t("loginTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          {t("registerTab")}
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <div className="field">
            <label htmlFor="auth-name">{t("name")}</label>
            <input
              id="auth-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">{t("email")}</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">{t("password")}</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            minLength={6}
            required
          />
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? t("wait") : mode === "register" ? t("createAccount") : t("signIn")}
        </button>
      </form>
      <p className="legal">
        {t("legalBefore")}{" "}
        <button type="button" onClick={() => onOpenLegal("terms")}>
          {t("legalTerms")}
        </button>{" "}
        {t("legalAnd")}{" "}
        <button type="button" onClick={() => onOpenLegal("privacy")}>
          {t("legalPrivacy")}
        </button>
        {t("legalAfter")}
      </p>
    </section>
  );
}

function CoinButton({ coins, onTopUp, coinBtnRef }) {
  const { t } = useI18n();
  return (
    <button className="coin-btn" onClick={onTopUp} ref={coinBtnRef} aria-label={t("balanceAria")}>
      <CoinMark />
      <span>{coins}</span>
      <span className="coin-plus">
        <Icon name="plus" size={14} />
      </span>
    </button>
  );
}

function Home({ user, wallpapers, coins, purchased, saved, download, coinBtnRef, onTopUp, onTap, onSave }) {
  const { t } = useI18n();
  return (
    <section className="screen screen--scroll">
      <div className="topbar">
        <div className="greet">
          <div className="avatar">{user.initials || USER.initials}</div>
          <div>
            <strong>{t("hello", { name: user.name || USER.name })}</strong>
            <small>{t("homeSubtitle")}</small>
          </div>
        </div>
        <CoinButton coins={coins} onTopUp={onTopUp} coinBtnRef={coinBtnRef} />
      </div>
      <h2 className="section-title">{t("wallpapers")}</h2>
      <WallpaperGrid
        items={wallpapers}
        purchased={purchased}
        saved={saved}
        download={download}
        onTap={onTap}
        onSave={onSave}
      />
    </section>
  );
}

function Saved({ items, purchased, saved, download, coinBtnRef, coins, onTopUp, onTap, onSave, onBrowse }) {
  const { t } = useI18n();
  return (
    <section className="screen screen--scroll">
      <div className="topbar">
        <div className="greet">
          <div>
            <strong>{t("savedTitle")}</strong>
            <small>{t("savedCount", { count: items.length })}</small>
          </div>
        </div>
        <CoinButton coins={coins} onTopUp={onTopUp} coinBtnRef={coinBtnRef} />
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <IllustrationEmpty />
          <h3>{t("emptyTitle")}</h3>
          <p>{t("emptyText")}</p>
          <div style={{ width: "100%", marginTop: 18 }}>
            <PrimaryButton onClick={onBrowse}>{t("browseImages")}</PrimaryButton>
          </div>
        </div>
      ) : (
        <WallpaperGrid
          items={items}
          purchased={purchased}
          saved={saved}
          download={download}
          onTap={onTap}
          onSave={onSave}
        />
      )}
    </section>
  );
}

function Profile({ user, coins, onTopUp, onLogout, onOpenLang }) {
  const { t, lang } = useI18n();
  return (
    <section className="screen screen--scroll">
      <div className="profile-head">
        <div className="avatar avatar--lg">{user.initials || USER.initials}</div>
        <h2>{user.name || USER.name}</h2>
        <p>{user.email || USER.email}</p>
      </div>
      <div className="balance-card">
        <div>
          <small>{t("balance")}</small>
          <strong>
            <CoinMark size={26} /> {t("coinsCount", { coins })}
          </strong>
        </div>
        <button className="btn btn-gold" onClick={onTopUp}>
          {t("topUp")}
        </button>
      </div>
      <div className="settings">
        <button className="settings-item" onClick={onOpenLang}>
          <span className="ico">
            <Icon name="globe" />
          </span>
          <span className="grow">
            <span>{t("language")}</span>
            <small>{langLabel(lang)}</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button className="settings-item">
          <span className="ico">
            <Icon name="sun" />
          </span>
          <span className="grow">
            <span>{t("theme")}</span>
            <small>{t("themeLight")}</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
        <button className="settings-item danger" onClick={onLogout}>
          <span className="ico">
            <Icon name="logout" />
          </span>
          <span className="grow">
            <span>{t("logout")}</span>
            <small>{t("logoutHint")}</small>
          </span>
        </button>
      </div>
    </section>
  );
}

function LanguageSheet({ onClose }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("chooseLanguage")}</h3>
        <p>{t("language")}</p>
        <div className="lang-list">
          {LANGS.map((item) => (
            <button
              key={item.code}
              className={`lang-option ${lang === item.code ? "active" : ""}`}
              onClick={() => {
                setLang(item.code);
                onClose();
              }}
            >
              <span>{item.nativeLabel}</span>
              {lang === item.code && <small>✓</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegalSheet({ kind, onClose }) {
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="legal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="legal-sheet-bar">
          <h3>{kind === "terms" ? t("legalTerms") : t("legalPrivacy")}</h3>
          <button type="button" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        <iframe title={kind} src={legalUrl(kind)} />
      </div>
    </div>
  );
}

function WallpaperGrid({ items, purchased, saved, download, onTap, onSave }) {
  const { t } = useI18n();
  return (
    <div className="grid">
      {items.map((item) => {
        const owned = purchased.includes(item.id);
        const isSaved = saved.includes(item.id);
        const busy = download?.id === item.id;
        return (
          <article
            key={item.id}
            className={`card-wall ${item.tall ? "is-tall" : ""}`}
            onClick={(e) => onTap(item, e)}
          >
            <img src={wallpaperSrc(item.image)} alt={item.title} />
            <button
              className={`save-fab ${isSaved ? "active" : ""}`}
              onClick={(e) => onSave(item.id, e)}
              aria-label={isSaved ? t("unsave") : t("save")}
            >
              <Icon name={isSaved ? "heart-filled" : "heart"} size={16} />
            </button>
            <div className={`badge ${owned ? "owned" : ""}`}>
              {owned ? <Icon name="download" size={14} /> : <CoinMark size={14} />}
              <span>{owned ? t("download") : item.price}</span>
            </div>
            {busy && (
              <div className="progress-overlay">
                <svg className="ring" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#eef1f6" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#8b7cff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${download.progress * 0.88} 88`}
                  />
                </svg>
                {download.progress}%
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function TopUpSheet({
  pkg,
  coinQty,
  amount,
  onSelectPackage,
  onCoinQtyChange,
  paying,
  onClose,
  onPay,
}) {
  const { t } = useI18n();
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>{t("topUpTitle")}</h3>
          <button onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        <p>{t("topUpHint")}</p>
        <div className="packages">
          {PACKAGES.map((item) => (
            <button
              key={item.id}
              className={`package ${pkg === item.id ? "active" : ""}`}
              onClick={() => onSelectPackage(item.id)}
            >
              {item.popular && <span className="popular">{t("popular")}</span>}
              <CoinMark size={22} />
              <strong>{item.coins}</strong>
              <small>{formatUsd(item.usd)}</small>
            </button>
          ))}
        </div>
        <div className="field field-coins">
          <label>{t("coins")}</label>
          <div className="field-coins-wrap">
            <span className="field-coins-icon">
              <CoinMark size={18} />
            </span>
            <input
              inputMode="numeric"
              placeholder={t("coinsPlaceholder")}
              value={coinQty}
              onChange={(e) => onCoinQtyChange(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>{t("amount")}</label>
          <input value={amount} readOnly placeholder="$0.00" />
        </div>
        <p className="legal">{t("paySecure")}</p>
        <PrimaryButton onClick={onPay}>{paying ? t("paying") : t("pay")}</PrimaryButton>
      </div>
    </div>
  );
}

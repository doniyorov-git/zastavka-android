import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

export const LANGS = [
  { code: "en", nativeLabel: "English" },
  { code: "ru", nativeLabel: "Русский" },
  { code: "zh", nativeLabel: "中文" },
];

export const DEFAULT_LANG = "en";
export const STORAGE_KEY = "zastavka-lang";

export const translations = {
  en: {
    skip: "Skip",
    next: "Next",
    getStarted: "Get started",
    onboard1Title: "Thousands of wallpapers",
    onboard1Text: "Ready-made wallpapers for your screen",
    onboard2Title: "Earn coins and buy",
    onboard2Text: "Unlock premium images with coins",
    onboard3Title: "Save to favorites",
    onboard3Text: "Keep the images you like",
    tagline: "Wallpaper store",
    wait: "Please wait...",
    loginTab: "Log in",
    registerTab: "Register",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@email.com",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    signIn: "Log in",
    createAccount: "Create account",
    legalBefore: "By continuing, you agree to the",
    legalTerms: "Terms of Use",
    legalAnd: "and",
    legalPrivacy: "Privacy Policy",
    legalAfter: ".",
    navMain: "Main navigation",
    navSaved: "Saved",
    navHome: "Home",
    navProfile: "Profile",
    hello: "Hello, {name}",
    homeSubtitle: "Fresh wallpapers today",
    wallpapers: "Wallpapers",
    balanceAria: "Balance",
    savedTitle: "Saved",
    savedCount: "{count} images",
    emptyTitle: "Nothing here yet",
    emptyText: "Save images you like — they will show up here",
    browseImages: "Browse wallpapers",
    balance: "Balance",
    coinsCount: "{coins} coins",
    topUp: "Top up",
    language: "Language",
    theme: "Theme",
    themeLight: "Light",
    logout: "Log out",
    logoutHint: "Sign out of your account",
    chooseLanguage: "Choose language",
    unsave: "Remove from favorites",
    save: "Add to favorites",
    download: "Download",
    topUpTitle: "Top up balance",
    close: "Close",
    topUpHint: "Pick a pack or enter your own coin amount",
    popular: "Popular",
    coins: "Coins",
    coinsPlaceholder: "Enter your own coins",
    cardNumber: "Card number",
    expiry: "Expiry date",
    cvv: "CVV",
    amount: "Amount",
    paying: "Paying...",
    pay: "Pay",
    paySecure: "Payment is completed on a secure checkout page.",
    lowTitle: "Insufficient balance",
    lowText: "Add coins to unlock this wallpaper",
    later: "Later",
    toastDownloaded: "Downloaded",
    toastDownloadFail: "Could not save the image",
    toastPurchased: "Purchased",
    toastCard: "Fill in your card details",
    toastCoins: "Enter a coin amount",
    toastPayRedirect: "Opening secure payment…",
    toastPayFail: "Payment was not completed",
    toastToppedUp: "Balance topped up · {usd}",
  },
  ru: {
    skip: "Пропустить",
    next: "Далее",
    getStarted: "Начать",
    onboard1Title: "Тысячи обоев",
    onboard1Text: "Готовые обои для вашего экрана",
    onboard2Title: "Копите монеты и покупайте",
    onboard2Text: "Открывайте премиум-изображения за монеты",
    onboard3Title: "Сохраняйте в избранное",
    onboard3Text: "Оставляйте понравившиеся картинки",
    tagline: "Магазин обоев",
    wait: "Подождите...",
    loginTab: "Вход",
    registerTab: "Регистрация",
    name: "Имя",
    namePlaceholder: "Ваше имя",
    email: "Email",
    emailPlaceholder: "you@email.com",
    password: "Пароль",
    passwordPlaceholder: "Не меньше 6 символов",
    signIn: "Войти",
    createAccount: "Создать аккаунт",
    legalBefore: "Продолжая, вы принимаете",
    legalTerms: "Условия использования",
    legalAnd: "и",
    legalPrivacy: "Политику конфиденциальности",
    legalAfter: ".",
    navMain: "Основная навигация",
    navSaved: "Сохранённые",
    navHome: "Главная",
    navProfile: "Профиль",
    hello: "Привет, {name}",
    homeSubtitle: "Новые обои сегодня",
    wallpapers: "Обои",
    balanceAria: "Баланс",
    savedTitle: "Сохранённые",
    savedCount: "{count} изображений",
    emptyTitle: "Пока пусто",
    emptyText: "Сохраните понравившиеся обои — они появятся здесь",
    browseImages: "Смотреть обои",
    balance: "Баланс",
    coinsCount: "{coins} монет",
    topUp: "Пополнить",
    language: "Язык",
    theme: "Тема",
    themeLight: "Светлая",
    logout: "Выйти",
    logoutHint: "Выйти из аккаунта",
    chooseLanguage: "Выберите язык",
    unsave: "Убрать из избранного",
    save: "В избранное",
    download: "Скачать",
    topUpTitle: "Пополнение баланса",
    close: "Закрыть",
    topUpHint: "Выберите пакет или введите своё число монет",
    popular: "Хит",
    coins: "Монеты",
    coinsPlaceholder: "Своё количество монет",
    cardNumber: "Номер карты",
    expiry: "Срок действия",
    cvv: "CVV",
    amount: "Сумма",
    paying: "Оплата...",
    pay: "Оплатить",
    paySecure: "Оплата проходит на защищённой странице.",
    lowTitle: "Недостаточно средств",
    lowText: "Пополните монеты, чтобы открыть эти обои",
    later: "Позже",
    toastDownloaded: "Скачано",
    toastDownloadFail: "Не удалось сохранить изображение",
    toastPurchased: "Куплено",
    toastCard: "Заполните данные карты",
    toastCoins: "Введите число монет",
    toastPayRedirect: "Открываем защищённую оплату…",
    toastPayFail: "Оплата не завершена",
    toastToppedUp: "Баланс пополнен · {usd}",
  },
  zh: {
    skip: "跳过",
    next: "下一步",
    getStarted: "开始",
    onboard1Title: "海量壁纸",
    onboard1Text: "为你的屏幕准备好的壁纸",
    onboard2Title: "攒金币购买",
    onboard2Text: "用金币解锁高级壁纸",
    onboard3Title: "收藏喜欢的",
    onboard3Text: "把喜欢的图片保存下来",
    tagline: "壁纸商店",
    wait: "请稍候...",
    loginTab: "登录",
    registerTab: "注册",
    name: "姓名",
    namePlaceholder: "你的名字",
    email: "邮箱",
    emailPlaceholder: "you@email.com",
    password: "密码",
    passwordPlaceholder: "至少 6 个字符",
    signIn: "登录",
    createAccount: "创建账号",
    legalBefore: "继续即表示你同意",
    legalTerms: "使用条款",
    legalAnd: "和",
    legalPrivacy: "隐私政策",
    legalAfter: "。",
    navMain: "主导航",
    navSaved: "收藏",
    navHome: "首页",
    navProfile: "我的",
    hello: "你好，{name}",
    homeSubtitle: "今日新壁纸",
    wallpapers: "壁纸",
    balanceAria: "余额",
    savedTitle: "收藏",
    savedCount: "{count} 张图片",
    emptyTitle: "暂无内容",
    emptyText: "收藏喜欢的壁纸，它们会出现在这里",
    browseImages: "浏览壁纸",
    balance: "余额",
    coinsCount: "{coins} 金币",
    topUp: "充值",
    language: "语言",
    theme: "主题",
    themeLight: "浅色",
    logout: "退出",
    logoutHint: "退出当前账号",
    chooseLanguage: "选择语言",
    unsave: "取消收藏",
    save: "加入收藏",
    download: "下载",
    topUpTitle: "充值余额",
    close: "关闭",
    topUpHint: "选择套餐或输入自定义金币数量",
    popular: "热门",
    coins: "金币",
    coinsPlaceholder: "输入金币数量",
    cardNumber: "卡号",
    expiry: "有效期",
    cvv: "CVV",
    amount: "金额",
    paying: "支付中...",
    pay: "支付",
    paySecure: "付款在安全结算页完成。",
    lowTitle: "余额不足",
    lowText: "充值金币以解锁这张壁纸",
    later: "稍后",
    toastDownloaded: "已下载",
    toastDownloadFail: "无法保存图片",
    toastPurchased: "已购买",
    toastCard: "请填写卡片信息",
    toastCoins: "请输入金币数量",
    toastPayRedirect: "正在打开安全支付…",
    toastPayFail: "支付未完成",
    toastToppedUp: "充值成功 · {usd}",
  },
};

export function getStoredLang() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "en" || value === "ru" || value === "zh") return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function persistLang(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function translate(lang, key, vars) {
  const dict = translations[lang] || translations.en;
  let text = dict[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function langLabel(code) {
  return LANGS.find((item) => item.code === code)?.nativeLabel || "English";
}

const LangContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLang);

  const setLang = useCallback((code) => {
    if (code !== "en" && code !== "ru" && code !== "zh") return;
    setLangState(code);
    persistLang(code);
    document.documentElement.lang = code;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return createElement(LangContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

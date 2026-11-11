import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

/* Agent OS ships in exactly two languages. Both are bundled (they are small),
   so switching is instant and works offline. The choice is a per-browser UI
   preference, the one thing kept in localStorage — it is not app data. */
export const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "ka", label: "ქართული" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "agentos.lang";
const isLanguage = (v: unknown): v is Language => v === "en" || v === "ka";

function initialLanguage(): Language {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isLanguage(saved)) return saved;
    } catch { /* storage blocked: fall through */ }
    const browser = typeof navigator !== "undefined" ? navigator.language : "";
    return browser.toLowerCase().startsWith("ka") ? "ka" : "en";
}

void i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "ka"],
    defaultNS: "common",
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
});

const syncHtmlLang = (lng: string) => {
    if (typeof document !== "undefined") document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export function setLanguage(lng: Language) {
    try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* not persisted; still switches */ }
    void i18n.changeLanguage(lng);
}

export const currentLanguage = (): Language => (isLanguage(i18n.language) ? i18n.language : "en");

/* For code outside React components (store toasts, domain helpers, date
   formatting). Components use useTranslation() instead. */
export const t = i18n.t.bind(i18n);

export default i18n;

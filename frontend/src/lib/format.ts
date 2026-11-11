import { t } from "../i18n";

export const usd = (n: number | null | undefined) =>
    n === null || n === undefined || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US");

export const initials = (n: string | null | undefined) =>
    (n || "?")
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

/* "$100,000–$150,000", "from $100,000", "up to $150,000" or null. */
export const usdRange = (min: unknown, max: unknown): string | null => {
    const lo = Number(min) || 0, hi = Number(max) || 0;
    if (lo && hi) return `${usd(lo)}–${usd(hi)}`;
    if (lo) return t("format.from", { value: usd(lo) });
    if (hi) return t("format.upTo", { value: usd(hi) });
    return null;
};

/* "70–90 m²", "70+ m²", "up to 90 m²" or null. */
export const areaRange = (min: unknown, max: unknown): string | null => {
    const lo = Number(min) || 0, hi = Number(max) || 0;
    if (lo && hi) return t("format.area", { value: `${lo}–${hi}` });
    if (lo) return t("format.areaPlus", { value: lo });
    if (hi) return t("format.areaUpTo", { value: hi });
    return null;
};

export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);

export const parseMoney = (v: unknown) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : Math.round(n);
};

/* WhatsApp chat link for a Georgian number (9 local digits get +995), with
   an optional prefilled message. Null when there is no usable number. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
    const digits = String(phone ?? "").replace(/\D/g, "");
    if (digits.length < 9) return null;
    const number = digits.length === 9 ? `995${digits}` : digits;
    return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}


import { t } from "../i18n";

/* "Today" is always the Tbilisi calendar day, wherever the browser is. */
export const isoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const tbilisiToday = (): string => {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Tbilisi",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date());
    } catch {
        return isoDate(new Date());
    }
};

/* The Tbilisi calendar day of a timestamp from the database. */
export const tbilisiDateOf = (ts: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
    } catch {
        return ts.slice(0, 10);
    }
};

export const d8 = (iso: string) => new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
export const shiftDate = (iso: string, days: number) => {
    const d = d8(iso);
    d.setDate(d.getDate() + days);
    return isoDate(d);
};

export const TODAY = tbilisiToday();

/* Month/day names come from the active language (common.json → dates). */
const names = (key: "months" | "monthsLong" | "days" | "daysLong") =>
    t(`dates.${key}`, { returnObjects: true }) as unknown as string[];
const shortMonth = (d: Date) => names("months")[d.getMonth()];

export const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = d8(iso);
    return t("dates.short", { month: shortMonth(d), day: d.getDate() });
};
export const fmtLong = (iso: string | null | undefined) => {
    if (!iso || Number.isNaN(d8(iso).getTime())) return t("dates.noDate");
    const d = d8(iso);
    return t("dates.long", { weekday: names("daysLong")[d.getDay()], month: names("monthsLong")[d.getMonth()], day: d.getDate() });
};
export const daysBetween = (a: string, b: string) => Math.round((d8(b).getTime() - d8(a).getTime()) / 86400000);
export const daysAgo = (iso: string) => daysBetween(iso, TODAY);

/* -1, 0, 1 for yesterday/today/tomorrow, otherwise null. Compare this, never
   the translated relDay() text. */
export const nearDay = (iso: string | null | undefined): -1 | 0 | 1 | null => {
    if (!iso || Number.isNaN(d8(iso).getTime())) return null;
    const diff = daysBetween(TODAY, iso);
    return diff === 0 || diff === 1 || diff === -1 ? diff : null;
};
export const relDay = (iso: string | null | undefined) => {
    if (!iso || Number.isNaN(d8(iso).getTime())) return t("dates.noDate");
    const near = nearDay(iso);
    if (near === 0) return t("dates.today");
    if (near === 1) return t("dates.tomorrow");
    if (near === -1) return t("dates.yesterday");
    const d = d8(iso);
    return t("dates.withWeekday", { weekday: names("days")[d.getDay()], month: shortMonth(d), day: d.getDate() });
};

/* Hour of day in Tbilisi (0–23), wherever the browser is. */
export const tbilisiHour = (): number => {
    try {
        return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    } catch {
        return new Date().getHours();
    }
};
export const greeting = () => {
    const h = tbilisiHour();
    return h < 5 ? t("dates.goodEvening") : h < 12 ? t("dates.goodMorning") : h < 18 ? t("dates.goodAfternoon") : t("dates.goodEvening");
};

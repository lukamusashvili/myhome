import { API_BASE_URL } from "./api";
import { getFreshAccessToken } from "./auth";
import { callPortal, checkExtension, type PortalResponse } from "./extension";
import { localizeServerError } from "./http";
import { t } from "../i18n";
import type { MyhomeLocation, SsStreet } from "./publish";

async function sessionHeaders(): Promise<HeadersInit> {
    const token = await getFreshAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonOrThrow<T>(res: Response, action: string): Promise<T> {
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (import.meta.env.DEV) console.warn(`${action} failed (HTTP ${res.status})`, body);
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ? localizeServerError(message) : t("errors.requestFailed", { status: res.status }));
    }
    return res.json();
}

export async function getUsdGelRate(): Promise<number> {
    const res = await fetch(`${API_BASE_URL}/api/fx/usd-gel`, { headers: (await sessionHeaders()) });
    return (await jsonOrThrow<{ rate: number }>(res, "Getting the exchange rate")).rate;
}

// Portal answers come back through the extension (extension/portal.js).
function portalDataOrThrow<T>(res: PortalResponse, action: string): T {
    if (res.status < 200 || res.status >= 300) {
        if (import.meta.env.DEV) console.warn(`${action} failed (HTTP ${res.status})`, res.data);
        throw new Error(t("errors.requestFailed", { status: res.status }));
    }
    return res.data as T;
}

// MyHome's location search is public, so no portal token is needed.
export async function searchMyhomeLocations(query: string): Promise<MyhomeLocation[]> {
    const items = portalDataOrThrow<unknown>(await callPortal("myhome.locations", "", { q: query }), "Searching locations");
    return Array.isArray(items) ? (items as MyhomeLocation[]) : [];
}

// The form's `location_id` is the district's own location record, which the
// street result doesn't carry (its location_id is null), so it takes a second
// lookup by the district's name.
export async function findDistrictLocationId(street: MyhomeLocation): Promise<number | null> {
    const districtName = street.locations[1];
    if (!districtName) return null;
    const results = await searchMyhomeLocations(districtName);
    const match = results.find((r) => r.find_point === "districts" && r.identifiers.district_id === street.identifiers.district_id);
    return match?.location_id ?? null;
}

// ss.ge's list needs the agent's portal token; the app's session means nothing to it.
export async function getSsStreets(): Promise<SsStreet[]> {
    const check = await checkExtension("ss");
    if (check.status !== "ok") throw new Error(t("admin:lookups.ssNeedsExtension"));
    return portalDataOrThrow<SsStreet[]>(await callPortal("ss.streets", check.token), "Loading SS.ge streets");
}

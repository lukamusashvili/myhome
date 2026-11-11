import { API_BASE_URL } from "./api";
import { getFreshAccessToken } from "./auth";
import { t } from "../i18n";
import type enCommon from "../i18n/locales/en/common.json";

/* The backend answers in English. Messages we know are shown in the agent's
   language; anything else is passed through unchanged. */
const SERVER_ERRORS: Record<string, keyof typeof enCommon.errors.server> = {
    "Missing portal token (X-Portal-Token)": "missingPortalToken",
    "Request body must be a JSON object": "badRequest",
    "Property not found": "propertyNotFound",
    "ss.ge returned an empty response": "ssEmpty",
    "id must be numeric": "idNumeric",
    "Your trial has ended, so your workspace is read-only": "trialEnded",
    "Your account is pending approval from Agent OS": "pendingApproval",
    "You do not own this property": "notOwnerProperty",
    "You do not own this photo": "notOwnerPhoto",
    "This property was changed somewhere else (another tab or device). Reload to see the latest, then make your change again.": "conflict",
    "Not found": "notFound",
    "MyHome returned an empty response": "myhomeEmpty",
    "MyHome accepted the photo but did not store it, so nothing was published": "myhomePhotoNotStored",
    "Missing Authorization bearer token": "noSession",
    "Invalid or expired session": "sessionExpired",
    "Could not search MyHome locations": "myhomeLocations",
    "Could not get the USD/GEL exchange rate": "exchangeRate",
    "Agent not found": "agentNotFound",
    "Agency name is required": "agencyRequired",
    "Admin access required": "adminRequired",
};
export const localizeServerError = (message: string): string => {
    const code = SERVER_ERRORS[message];
    return code ? t(`errors.server.${code}`) : message;
};

/* One JSON request to our backend, authenticated as the signed-in agent.
   Throws an Error carrying the backend's message on any non-2xx. */
export async function request<T>(method: string, path: string, body?: unknown, action = "Request"): Promise<T> {
    const token = await getFreshAccessToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (import.meta.env.DEV) console.warn(`${action} failed (HTTP ${res.status})`, err);
        const message = (err as { error?: string } | null)?.error;
        throw new Error(message ? localizeServerError(message) : t("errors.requestFailed", { status: res.status }));
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

/* A database id generated in the browser, so optimistic UI and Postgres
   agree on it from the first render. */
export const newId = (): string => crypto.randomUUID();

import { API_BASE_URL } from "./api";
import { getFreshAccessToken } from "./auth";
import { localizeServerError } from "./http";
import { t } from "../i18n";

async function authHeaders(): Promise<HeadersInit> {
    const token = await getFreshAccessToken();
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function asJson<T>(res: Response, action: string): Promise<T> {
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (import.meta.env.DEV) console.warn(`${action} failed (HTTP ${res.status})`, body);
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ? localizeServerError(message) : t("errors.requestFailed", { status: res.status }));
    }
    return res.json();
}

export interface AdminAgent {
    id: string;
    email: string | null;
    name: string;
    phone: string | null;
    city: string | null;
    agencyId: string | null;
    role: string;
    approved: boolean;
    trialStatus: string;
    createdAt: string;
}

export async function listAgents(page: number, pageSize: number): Promise<{ items: AdminAgent[]; count: number }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/agents?page=${page}&pageSize=${pageSize}`, { headers: (await authHeaders()) });
    return asJson<{ items: AdminAgent[]; count: number }>(res, "Loading agents");
}

export async function updateAgent(
    id: string,
    patch: Partial<Pick<AdminAgent, "role" | "approved" | "name" | "phone" | "city" | "trialStatus">>,
): Promise<AdminAgent> {
    const res = await fetch(`${API_BASE_URL}/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: (await authHeaders()),
        body: JSON.stringify(patch),
    });
    return asJson<AdminAgent>(res, "Saving agent");
}

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

export interface UploadedPhoto {
    url: string;
    publicId: string;
}

// propertyId omitted for a property that hasn't been saved yet — the backend
// files those under an "unassigned" Cloudinary folder rather than rejecting
// them, since there's no row yet to check ownership against.
export async function uploadPhoto(dataUri: string, propertyId?: string): Promise<UploadedPhoto> {
    const res = await fetch(`${API_BASE_URL}/api/photos`, {
        method: "POST",
        headers: (await authHeaders()),
        body: JSON.stringify({ dataUri, propertyId }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ? localizeServerError(message) : t("properties:photos.uploadFailed", { status: res.status }));
    }
    return res.json();
}

export async function deletePhoto(publicId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/photos`, {
        method: "DELETE",
        headers: (await authHeaders()),
        body: JSON.stringify({ publicId }),
    });
    if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ? localizeServerError(message) : t("properties:photos.deleteFailed", { status: res.status }));
    }
}

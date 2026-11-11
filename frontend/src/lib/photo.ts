import { t } from "../i18n";

export const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_PHOTOS = 10;
export const MAX_DIM = 1400; // phone photos get scaled down before they reach local storage
export const JPEG_QUALITY = 0.78;

/* Resize and re-compress in the browser. No upload, no storage service — the
   result is a data URI saved alongside the property like any other field. */
// BACKEND: keep this browser-side downscale, then POST to signed object
// storage instead of producing a data URI
export function processImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!IMAGE_TYPES.includes(file.type)) return reject(new Error("unsupported"));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("unreadable"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("unreadable"));
            img.onload = () => {
                try {
                    const scale = Math.min(1, MAX_DIM / Math.max(img.width || 1, img.height || 1));
                    const w = Math.max(1, Math.round((img.width || 1) * scale));
                    const h = Math.max(1, Math.round((img.height || 1) * scale));
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext && canvas.getContext("2d");
                    if (!ctx) return resolve(reader.result as string); // no canvas: keep the original
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
                } catch {
                    resolve(reader.result as string);
                }
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
}

/* Cloudinary secure URLs embed the public_id as the path after /upload/
   (skipping the delivery transformation segment and an optional version
   segment), minus the file extension. We don't store public_id separately —
   `photos` is just string[] of URLs, matching the DB column — so deletion
   reconstructs it from the URL instead of widening the data model. Only
   needs to handle the shape our own uploads produce, not arbitrary
   Cloudinary URLs. */
export function cloudinaryPublicIdFromUrl(url: string): string | null {
    const m = url.match(/\/upload\/(?:[^/]+\/)?(?:v\d+\/)?(.+)\.[^./?]+(?:\?.*)?$/);
    return m ? m[1] : null;
}

/* An ID without its URL is useless on an incoming call, and a URL without an
   ID can't be searched — so the pair is validated together, per portal. */
export const portalPairError = (id: unknown, url: unknown) => {
    const hasId = String(id || "").trim(), hasUrl = String(url || "").trim();
    if (hasId && !hasUrl) return t("properties:portal.pairNeedsUrl");
    if (!hasId && hasUrl) return t("properties:portal.pairNeedsId");
    return null;
};

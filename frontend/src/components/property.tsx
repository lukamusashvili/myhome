import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, X, Loader2, ImagePlus, Share2, ChevronRight, Camera } from "lucide-react";
import type { Property } from "../types";
import { IMAGE_TYPES, MAX_PHOTOS, cloudinaryPublicIdFromUrl, processImage } from "../lib/photo";
import { deletePhoto, uploadPhoto } from "../lib/photosApi";
import { findPropertyMatch, hasPortalListings, portalListings, propTitle } from "../lib/domain";
import { Badge, Field, Input, Photo } from "./ui";

export function PhotoUploader({
    photos, onChange, toast, disabled, propertyId,
}: {
    photos: string[]; onChange: (next: string[]) => void; toast: (text: string, tone?: "warn") => void;
    disabled?: boolean; propertyId?: string;
}) {
    const { t } = useTranslation("properties");
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [over, setOver] = useState(false);

    const addFiles = async (fileList: FileList | null | undefined) => {
        const files = [...(fileList || [])];
        if (!files.length || disabled) return;
        const room = MAX_PHOTOS - photos.length;
        if (room <= 0) { toast(t("photos.maxReached", { max: MAX_PHOTOS }), "warn"); return; }
        const images = files.filter((f) => IMAGE_TYPES.includes(f.type));
        const skipped = files.length - images.length;
        if (skipped) toast(t("photos.skipped", { count: skipped }), "warn");
        const batch = images.slice(0, room);
        if (images.length > room) toast(t("photos.onlyFit", { count: room }), "warn");
        if (!batch.length) return;
        setBusy(true);
        const added: string[] = [];
        for (const f of batch) {
            try {
                const dataUri = await processImage(f);
                const uploaded = await uploadPhoto(dataUri, propertyId);
                added.push(uploaded.url);
            } catch (err) {
                toast(err instanceof Error ? err.message : t("photos.couldntUpload", { name: f.name }), "warn");
            }
        }
        setBusy(false);
        if (added.length) {
            onChange([...photos, ...added]);
            toast(t("photos.added", { count: added.length }));
        }
    };

    const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, x) => x !== i)]);
    const remove = (i: number) => {
        const [removed] = photos.slice(i, i + 1);
        onChange(photos.filter((_, x) => x !== i)); // photos[0] stays the cover
        const publicId = removed && cloudinaryPublicIdFromUrl(removed);
        if (publicId) deletePhoto(publicId).catch(() => toast(t("photos.removedNotDeleted"), "warn"));
    };

    return (
        <div className="field">
            <label>{t("photos.label")}</label>
            <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <button className={`photo-drop ${over ? "over" : ""}`} disabled={disabled || busy}
                onClick={() => inputRef.current && inputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer && e.dataTransfer.files); }}>
                {busy ? <><Loader2 size={15} className="spin" /> {t("photos.processing")}</> : <><ImagePlus size={15} /> {t("photos.upload")}</>}
            </button>
            <div className="form-note">{t("photos.note", { max: MAX_PHOTOS })}</div>
            {photos.length > 0 && (
                <div className="photo-grid">
                    {photos.map((src, i) => (
                        <div className={`photo-tile ${i === 0 ? "is-cover" : ""}`} key={i}>
                            <Photo src={src} alt={t("photos.alt", { n: i + 1 })} style={{ width: "100%", height: "100%" }} />
                            {i === 0 && <span className="photo-badge">{t("photos.cover")}</span>}
                            <div className="photo-acts">
                                {i !== 0 && <button title={t("photos.makeCover")} disabled={disabled} onClick={() => makeCover(i)}><Star size={12} /></button>}
                                <button title={t("photos.remove")} disabled={disabled} onClick={() => remove(i)}><X size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function PortalRow({
    portal, hint, idValue, urlValue, onId, onUrl, error, disabled,
}: {
    portal: string; hint: string; idValue: string; urlValue: string;
    onId: (e: React.ChangeEvent<HTMLInputElement>) => void; onUrl: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string | null; disabled?: boolean;
}) {
    const { t } = useTranslation("properties");
    return (
        <div className="card card-pad" style={{ padding: "12px 14px", marginBottom: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="fs-13 bold">{portal}</div>
                {idValue ? <Badge tone="teal">{t("portal.published")}</Badge> : <span className="fs-11 faint">{t("portal.notPublished")}</span>}
            </div>
            <div className="form-grid" style={{ marginBottom: 0 }}>
                <Field label={t("portal.listingId")}><Input value={idValue || ""} onChange={onId} placeholder={hint} disabled={disabled} error={!!error} /></Field>
                <Field label={t("portal.listingUrl")}><Input value={urlValue || ""} onChange={onUrl} placeholder="https://…" disabled={disabled} error={!!error} /></Field>
            </div>
            {error && <div className="field-err" style={{ marginTop: -6 }}>{error}</div>}
        </div>
    );
}

export interface PropertyPick { id: string; reference: { type: string; id: string; label: string } | null }

export function PropertyPicker({
    properties, value, onSelect, disabled, placeholder,
}: { properties: Property[]; value: PropertyPick | null; onSelect: (v: PropertyPick | null) => void; disabled?: boolean; placeholder?: string }) {
    const { t } = useTranslation(["properties", "common"]);
    const [q, setQ] = useState("");
    const selected = value ? properties.find((p) => p.id === value.id) : null;

    const results = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return [];
        const out: { property: Property; reference: PropertyPick["reference"] }[] = [];
        for (const p of properties) {
            const hit = findPropertyMatch(p, term);
            if (hit) out.push(hit);
            if (out.length >= 6) break;
        }
        return out;
    }, [q, properties]);

    if (selected) {
        return (
            <div className="picker-selected">
                <Photo src={selected.photos[0]} style={{ width: 40, height: 32, flexShrink: 0 }} radius={6} />
                <div className="grow">
                    <div className="row wrap" style={{ gap: 6 }}>
                        <span className="fs-13 bold">{propTitle(selected)}</span>
                        {selected.status === "archived" && <Badge tone="gray">{t("common:ui.badge.archived")}</Badge>}
                        {!selected.mine && <Badge tone="teal" icon={<Share2 size={11} />}>{t("common:ui.badge.shared", { name: selected.sharedBy })}</Badge>}
                    </div>
                    {hasPortalListings(selected) && (
                        <div className="fs-11 faint" style={{ marginTop: 2 }}>
                            {portalListings(selected).map((l) => `${l.portal} #${l.id}`).join(" · ")}
                        </div>
                    )}
                </div>
                <button className="icon-btn" title={t("picker.chooseDifferent")} disabled={disabled} onClick={() => { onSelect(null); setQ(""); }}><X size={14} /></button>
            </div>
        );
    }

    return (
        <>
            <Input value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || t("picker.placeholder")} />
            {q.trim() && (
                <div className="picker-list">
                    {results.length === 0 && <div className="fs-13 muted" style={{ padding: "11px 12px" }}>{t("picker.noMatch", { query: q.trim() })}</div>}
                    {results.map(({ property: p, reference }) => (
                        <button className="picker-item" key={p.id} onClick={() => { onSelect({ id: p.id, reference }); setQ(""); }}>
                            <Photo src={p.photos[0]} style={{ width: 36, height: 28, flexShrink: 0, marginTop: 2 }} radius={6} />
                            <span className="grow">
                                <span className="row wrap" style={{ gap: 6 }}>
                                    <span className="fs-13 bold">{propTitle(p)}</span>
                                    <span className="fs-12 faint">#{p.id}</span>
                                    {p.status === "archived" && <Badge tone="gray">{t("common:ui.badge.archived")}</Badge>}
                                    {!p.mine && <Badge tone="teal" icon={<Share2 size={11} />}>{t("common:ui.badge.shared", { name: p.sharedBy })}</Badge>}
                                </span>
                                {hasPortalListings(p) && (
                                    <span className="fs-11 faint" style={{ display: "block", marginTop: 2 }}>
                                        {portalListings(p).map((l) => `${l.portal} #${l.id}`).join(" · ")}
                                    </span>
                                )}
                                {reference && (
                                    <span className="fs-11" style={{ display: "block", marginTop: 3, color: "var(--teal)", fontWeight: 600 }}>
                                        {t("picker.matched", { label: reference.label })}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

export function Gallery({
    photos, index, setIndex, title, canEdit, onAddPhotos,
}: { photos: string[]; index: number; setIndex: (i: number) => void; title: string; canEdit?: boolean; onAddPhotos?: () => void }) {
    const { t } = useTranslation("properties");
    const count = photos.length;
    const step = (d: number) => setIndex((index + d + count) % count);
    if (count === 0) {
        return (
            <div className="gallery-main photo-fallback" style={{ flexDirection: "column", gap: 9 }}>
                <Camera size={22} />
                <div className="fs-13 bold">{t("gallery.empty")}</div>
                <div className="fs-12 faint" style={{ maxWidth: 280, textAlign: "center", lineHeight: 1.5 }}>
                    {t("gallery.emptyHint")}
                </div>
                {canEdit && <button className="btn btn-secondary btn-sm" onClick={onAddPhotos}><ImagePlus size={13} /> {t("gallery.addPhotos")}</button>}
            </div>
        );
    }
    return (
        <>
            <div className="gallery-main">
                <Photo key={index} src={photos[index]} alt={title} style={{ width: "100%", height: "100%" }} />
                {count > 1 && (
                    <>
                        <button className="gallery-nav" style={{ left: 12 }} onClick={() => step(-1)} aria-label={t("gallery.previous")}>
                            <ChevronRight size={17} style={{ transform: "rotate(180deg)" }} />
                        </button>
                        <button className="gallery-nav" style={{ right: 12 }} onClick={() => step(1)} aria-label={t("gallery.next")}>
                            <ChevronRight size={17} />
                        </button>
                    </>
                )}
                <div className="gallery-count"><Camera size={12} /> {index + 1} / {count}</div>
            </div>
            {count > 1 && (
                <div className="gallery-thumbs">
                    {photos.map((ph, i) => (
                        <button key={i} onClick={() => setIndex(i)} style={{ border: "none", background: "none", padding: 0, lineHeight: 0 }}>
                            <Photo src={ph} className={i === index ? "sel" : ""} style={{ width: 74, height: 54 }} radius={8} />
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

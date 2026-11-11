import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Loader2, Link2, AlertTriangle, CheckCircle2, ExternalLink, Pencil, Puzzle,
} from "lucide-react";
import { useApp } from "../store/store";
import {
    IMPORT_AVAILABLE, importStageText, PROVIDERS, importListing, importMessage, importToPropertyDraft, persistImportPhotos,
    parseListingInput, type NormalizedListing,
} from "../lib/import";
import { propTitle } from "../lib/domain";
import { usd } from "../lib/format";
import { newId } from "../lib/http";
import { Badge, Field, Input, PageHeader, Photo, Select } from "../components/ui";
import { enumLabel } from "../i18n/labels";

const PreviewRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    const { t } = useTranslation("properties");
    return (
    <div className="kv">
        <span className="kv-l">{label}</span>
        <span className="kv-v" style={{ color: value ? "var(--text)" : "var(--text-faint)" }}>{value || t("common.notProvided")}</span>
    </div>
    );
};

export default function ImportProperty() {
    const { t } = useTranslation("properties");
    const { openModal, nav, readOnly, properties, api } = useApp();
    const [input, setInput] = useState("");
    const [source, setSource] = useState("auto");
    const [stage, setStage] = useState<"idle" | "fetching" | "parsing" | "preparing" | "preview" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<NormalizedListing | null>(null);
    const [duplicate, setDuplicate] = useState<(typeof properties)[number] | null>(null);
    const [clickLocked, setClickLocked] = useState(false);
    const busy = (["fetching", "parsing", "preparing"] as const).includes(stage as "fetching" | "parsing" | "preparing");

    const reset = () => { setStage("idle"); setPreview(null); setError(null); setDuplicate(null); };

    const run = async () => {
        if (busy || clickLocked) return;
        setClickLocked(true);
        setTimeout(() => setClickLocked(false), 1000);
        setError(null); setDuplicate(null); setPreview(null);
        let parsed;
        try {
            parsed = parseListingInput(input, source === "auto" ? null : source);
        } catch (e) {
            setStage("error");
            const code = (e as { code?: string }).code;
            setError(code === "invalid_input" && /^#?\d{4,}$/.test(input.trim())
                ? t("import.pickPortal")
                : importMessage(code));
            return;
        }
        const ref = parsed.externalId ? `${parsed.prefix}-${parsed.externalId}` : null;
        const existing = ref && properties.find((p) => !p.deleted && p.sourceRef === ref);
        if (existing) { setStage("error"); setDuplicate(existing); return; }

        try {
            const result = await importListing(input, source === "auto" ? null : source, { onStage: (s) => setStage(s as typeof stage) });
            setPreview(result);
            setStage("preview");
        } catch (e) {
            setStage("error");
            const code = (e as { code?: string }).code;
            setError(importMessage(code));
            if (typeof console !== "undefined") console.warn("[import] provider failure", { code, input, source });
        }
    };

    const [copying, setCopying] = useState(false);
    const confirmImport = async () => {
        if (!preview || copying) return;
        setCopying(true);
        try {
            const draft = importToPropertyDraft(preview, newId());
            draft.photos = await persistImportPhotos(draft.photos || []);
            openModal("property", { mode: "import", initial: draft });
        } catch (e) {
            api.toast(e instanceof Error ? e.message : t("import.couldntCopyPhotos"), "warn");
        } finally {
            setCopying(false);
        }
    };

    return (
        <div className="page">
            <PageHeader title={t("import.title")} subtitle={t("import.subtitle")} />

            <div className="grid-2">
                <div className="stack" style={{ gap: 18 }}>
                    <div className="card card-pad">
                        <div className="form-grid" style={{ gridTemplateColumns: "1fr 160px" }}>
                            <Field label={t("import.inputLabel")}>
                                <Input value={input} disabled={busy} onChange={(e) => { setInput(e.target.value); if (stage === "error") reset(); }} placeholder={t("import.inputPlaceholder")} />
                            </Field>
                            <Field label={t("import.source")}>
                                <Select value={source} disabled={busy} onChange={(e) => setSource(e.target.value)}
                                    options={[{ value: "auto", label: t("import.detectAuto") }, ...PROVIDERS.map((p) => ({ value: p.id, label: p.label }))]} />
                            </Field>
                        </div>
                        <div className="row wrap" style={{ gap: 8 }}>
                            <button className="btn btn-primary" disabled={busy || clickLocked || readOnly || !input.trim()} onClick={run}>
                                {busy ? <><Loader2 size={14} className="spin" /> {importStageText(stage)}</> : <><Link2 size={14} /> {t("import.import")}</>}
                            </button>
                            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { reset(); setInput("https://www.myhome.ge/pr/1748902/"); }}>{t("import.myhomeSample")}</button>
                            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { reset(); setInput("https://ss.ge/en/real-estate/8451207"); }}>{t("import.ssSample")}</button>
                        </div>
                    </div>

                    {busy && (
                        <div className="card card-pad">
                            <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                                <Loader2 size={15} className="spin" color="var(--navy-2)" />
                                <span className="fs-13 bold">{importStageText(stage)}</span>
                            </div>
                            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                                {[0, 1, 2, 3].map((i) => <div className="skel" key={i} style={{ width: 74, height: 54 }} />)}
                            </div>
                            {[0, 1, 2].map((i) => <div className="skel" key={i} style={{ height: 12, marginBottom: 9, width: `${90 - i * 18}%` }} />)}
                        </div>
                    )}

                    {stage === "error" && duplicate && (
                        <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none" }}>
                            <div className="row fs-13 bold" style={{ color: "var(--amber)", marginBottom: 6 }}><AlertTriangle size={15} /> {t("import.duplicate.title")}</div>
                            <div className="fs-13" style={{ color: "var(--amber)", lineHeight: 1.5, marginBottom: 11 }}>
                                {t("import.duplicate.body", { property: propTitle(duplicate), ref: duplicate.sourceRef })}
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => nav("property", { id: duplicate.id })}>{t("import.duplicate.open")}</button>
                        </div>
                    )}

                    {stage === "error" && error && (
                        <div className="card card-pad" style={{ background: "var(--brick-tint)", border: "none" }}>
                            <div className="row fs-13 bold" style={{ color: "var(--brick)", marginBottom: 6 }}><AlertTriangle size={15} /> {t("import.failed")}</div>
                            <div className="fs-13" style={{ color: "var(--brick)", lineHeight: 1.55 }}>{error}</div>
                        </div>
                    )}

                    {stage === "preview" && preview && (
                        <>
                            <div className="card" style={{ overflow: "hidden" }}>
                                <div className="row" style={{ gap: 8, padding: "13px 18px", background: "var(--teal-tint)" }}>
                                    <CheckCircle2 size={16} color="var(--teal)" />
                                    <span className="fs-13 bold grow" style={{ color: "var(--teal)" }}>{t("import.preview.title")}</span>
                                    {preview.simulated && <Badge tone="amber">{t("import.preview.simulated")}</Badge>}
                                </div>
                                <div className="card-pad">
                                    {preview.images.length > 0 ? (
                                        <div className="row" style={{ gap: 7, marginBottom: 14, overflowX: "auto" }}>
                                            {preview.images.slice(0, 8).map((im, i) => (
                                                <Photo key={i} src={im.url} style={{ width: 92, height: 68, flexShrink: 0 }} radius={8} />
                                            ))}
                                            {preview.images.length > 8 && (
                                                <div className="badge badge-gray" style={{ height: 68, padding: "0 13px", flexShrink: 0 }}>+{preview.images.length - 8}</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="fs-12 faint" style={{ marginBottom: 12 }}>{t("import.preview.noImages")}</div>
                                    )}

                                    {preview.title && <div className="fs-14 bold" style={{ marginBottom: 8 }}>{preview.title}</div>}
                                    <PreviewRow label={t("import.preview.propertyType")} value={enumLabel("propertyType", preview.type)} />
                                    <PreviewRow label={t("import.preview.dealType")} value={enumLabel("dealType", preview.dealType)} />
                                    <PreviewRow label={t("import.preview.price")} value={preview.price ? `${usd(preview.price)}${preview.currency && preview.currency !== "USD" ? ` (${preview.currency})` : ""}` : null} />
                                    <PreviewRow label={t("import.preview.city")} value={enumLabel("city", preview.city)} />
                                    <PreviewRow label={t("import.preview.district")} value={enumLabel("district", preview.district) || (preview.districtRaw ? t("import.preview.notRecognised", { district: preview.districtRaw }) : null)} />
                                    <PreviewRow label={t("import.preview.address")} value={preview.address} />
                                    <PreviewRow label={t("import.preview.area")} value={preview.area ? t("common.area", { value: preview.area }) : null} />
                                    <PreviewRow label={t("import.preview.rooms")} value={preview.rooms} />
                                    <PreviewRow label={t("import.preview.bedrooms")} value={preview.beds} />
                                    <PreviewRow label={t("import.preview.bathrooms")} value={preview.baths} />
                                    <PreviewRow label={t("import.preview.floor")} value={preview.floor && preview.floors ? t("common.floorOf", { floor: preview.floor, floors: preview.floors }) : preview.floor} />
                                    <PreviewRow label={t("import.preview.condition")} value={enumLabel("condition", preview.condition)} />
                                    <PreviewRow label={t("import.preview.images")} value={preview.images.length ? t("import.preview.imagesFound", { count: preview.images.length }) : null} />
                                    {preview.features.length > 0 && (
                                        <div style={{ marginTop: 11 }}>
                                            <div className="eyebrow" style={{ marginBottom: 6 }}>{t("import.preview.features")}</div>
                                            <div className="row wrap" style={{ gap: 6 }}>{preview.features.map((f, i) => <span key={`${i}:${f}`} className="badge badge-gray">{f}</span>)}</div>
                                        </div>
                                    )}
                                    {preview.description && (
                                        <div style={{ marginTop: 11 }}>
                                            <div className="eyebrow" style={{ marginBottom: 6 }}>{t("import.preview.description")}</div>
                                            <div className="fs-13 muted" style={{ lineHeight: 1.55 }}>{preview.description}</div>
                                        </div>
                                    )}
                                    <div style={{ marginTop: 13, paddingTop: 11, borderTop: "1px solid var(--border)" }}>
                                        <div className="eyebrow" style={{ marginBottom: 6 }}>{t("import.preview.sourceListing")}</div>
                                        <div className="fs-13">{preview.source}{preview.sourceRef ? ` · ${preview.sourceRef}` : ""}</div>
                                        {preview.sourceUrl && <a className="link-quiet" style={{ marginTop: 6 }} href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">{t("import.preview.openSource")} <ExternalLink size={12} /></a>}
                                    </div>
                                </div>
                            </div>

                            <div className="card card-pad" style={{ background: "var(--amber-tint)", border: "none" }}>
                                <div className="row fs-13 bold" style={{ color: "var(--amber)", marginBottom: 8 }}><AlertTriangle size={15} /> {t("import.stillNeeds.title")}</div>
                                <div className="row wrap" style={{ gap: 6 }}>
                                    {(["contactType", "cooperation", "commissionModel", "commissionPct", "negotiable", "notes"] as const).map((k) => t(`import.stillNeeds.${k}`)).map((m) => (
                                        <span key={m} className="badge badge-amber">{m}</span>
                                    ))}
                                </div>
                                <div className="fs-12" style={{ color: "var(--amber)", marginTop: 10, lineHeight: 1.5 }}>
                                    {t("import.stillNeeds.body")}
                                </div>
                            </div>

                            <div className="row wrap" style={{ gap: 8 }}>
                                <button className="btn btn-secondary" onClick={reset}>{t("import.cancel")}</button>
                                <button className="btn btn-primary" disabled={readOnly || copying} onClick={confirmImport}><Pencil size={14} /> {copying ? t("import.copyingPhotos") : t("import.confirm")}</button>
                            </div>
                        </>
                    )}
                </div>

                <div className="stack" style={{ gap: 16 }}>
                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 8 }}>{t("import.supported.title")}</div>
                        {PROVIDERS.map((p) => (
                            <div className="kv" key={p.id}><span className="kv-l">{p.label}</span><span className="kv-v">{IMPORT_AVAILABLE ? t("import.supported.live") : t("import.supported.needsService")}</span></div>
                        ))}
                        <div className="fs-12 faint" style={{ marginTop: 10, lineHeight: 1.55 }}>
                            {IMPORT_AVAILABLE
                                ? t("import.supported.viaService")
                                : t("import.supported.noService")}
                        </div>
                    </div>

                    <div className="card card-pad">
                        <div className="row" style={{ gap: 9, marginBottom: 9 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}><Puzzle size={16} color="var(--navy-2)" /></div>
                            <div className="section-title">{t("import.extension.title")}</div>
                        </div>
                        <div className="fs-13 muted" style={{ lineHeight: 1.55, marginBottom: 12 }}>{t("import.extension.body")}</div>
                        <button className="btn btn-secondary btn-block" onClick={() => openModal("extension", {})}>{t("import.extension.install")}</button>
                    </div>

                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 9 }}>{t("import.why.title")}</div>
                        {[[t("import.why.manual"), t("import.why.manualTime")], [t("import.why.import"), t("import.why.importTime")]].map(([k, v]) => (
                            <div className="kv" key={k}><span className="kv-l">{k}</span><span className="kv-v">{v}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

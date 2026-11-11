import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Pencil, CheckSquare, X, Share2, MoreHorizontal, RotateCcw, Star, Trash2, ShieldCheck, ExternalLink,
    MessageCircle, Layers, BedDouble, DoorOpen, Bath, Car, Building, Lock, Clock, Archive, Building2 as Building2Icon,
} from "lucide-react";
import { useApp } from "../store/store";
import { calcPricing, hasPortalListings, portalListings, propTitle } from "../lib/domain";
import { daysAgo, fmtDate } from "../lib/dates";
import { usd, initials } from "../lib/format";
import { ActionMenu, Badge, EmptyState, FeedbackChip, PageHeader, PriceCalculator, SourceBadge, StatusBadge, Fact } from "../components/ui";
import { Gallery } from "../components/property";
import { enumLabel } from "../i18n/labels";

export default function PropertyDetails({ id }: { id: string }) {
    const { t } = useTranslation("properties");
    const { sel, api, nav, openModal, readOnly } = useApp();
    const p = sel.property(id);
    const [tab, setTab] = useState("Overview");
    const [photo, setPhoto] = useState(0);
    useEffect(() => { setPhoto(0); setTab("Overview"); }, [id]);
    if (!p) return <div className="page"><EmptyState icon={<Building2Icon />} title={t("details.notFound")} body={t("details.notFoundBody")} /></div>;

    const pricing = calcPricing(p);
    const sentRecords = sel.propertySent(p.id);
    // Tab ids stay English (they drive which panel shows); labels are translated.
    const tabs = (p.mine ? ["Overview", "Owner & Commission", "Activity", "Sent to Clients"] : ["Overview", "Activity"]) as ("Overview" | "Owner & Commission" | "Activity" | "Sent to Clients")[];
    const yesNo = (v: unknown) => enumLabel("yesNo", v ? "Yes" : "No");

    return (
        <div className="page">
            <PageHeader
                back={{ label: t("details.back"), onClick: () => nav("properties") }}
                title={propTitle(p)}
                actions={p.mine ? (
                    <>
                        <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("property", { initial: p })}><Pencil size={14} /> {t("details.edit")}</button>
                        <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("task", { initial: { propertyId: p.id, title: t("common.callOwnerTitle"), type: "Call" } })}><CheckSquare size={14} /> {t("common.addTask")}</button>
                        {p.sharedWithAgency
                            ? <button className="btn btn-secondary" disabled={readOnly} onClick={() => api.shareProperty(p.id, false)}><X size={14} /> {t("details.stopSharing")}</button>
                            : <button className="btn btn-teal" disabled={readOnly} onClick={() => openModal("share-property", { property: p })}><Share2 size={14} /> {t("details.shareWithAgency")}</button>}
                        <ActionMenu items={[
                            p.status === "archived"
                                ? { label: t("details.reactivateProperty"), icon: <RotateCcw size={14} />, onClick: () => api.reactivateProperty(p.id), disabled: readOnly }
                                : { label: t("details.archiveProperty"), icon: <Archive size={14} />, onClick: () => openModal("archive", { property: p }), disabled: readOnly },
                            { label: p.favorite ? t("common.removeFavorite") : t("common.addFavorite"), icon: <Star size={14} />, onClick: () => api.toggleFavorite(p.id), disabled: readOnly },
                            "sep",
                            { label: t("details.deleteProperty"), icon: <Trash2 size={14} />, danger: true, disabled: readOnly,
                                onClick: () => openModal("confirm", { title: t("details.deleteConfirmTitle"), danger: true, confirmLabel: t("details.delete"),
                                    body: t("details.deleteConfirmBody"),
                                    onConfirm: () => { api.deleteProperty(p.id); nav("properties"); } }) },
                        ]}><button className="btn btn-secondary"><MoreHorizontal size={15} /></button></ActionMenu>
                    </>
                ) : (
                    <>
                        <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("task", { initial: { propertyId: p.id } })}><CheckSquare size={14} /> {t("common.addTask")}</button>
                        <button className="btn btn-teal" onClick={() => openModal("contact-agent", { agent: p.sharedBy, phone: p.sharedByPhone, property: p })}>
                            <MessageCircle size={14} /> {t("details.contact", { name: (p.sharedBy || "").split(" ")[0] })}</button>
                    </>
                )} />

            <div className="row wrap" style={{ gap: 8, marginTop: -8, marginBottom: 14 }}>
                <StatusBadge status={p.status} />
                <SourceBadge p={p} />
                <Badge tone="gray" icon={<ShieldCheck size={11} />}>
                    {daysAgo(p.verifiedAt) === 0 ? t("details.verifiedToday") : t("details.verifiedAgo", { count: daysAgo(p.verifiedAt) })}
                </Badge>
                {p.archiveReason && <Badge tone="gray">{enumLabel("archiveReason", p.archiveReason)}</Badge>}
            </div>
            <div className="ew-serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 16 }}>{usd(Number(p.price))}</div>

            <Gallery photos={p.photos} index={photo} setIndex={setPhoto} title={propTitle(p)} canEdit={p.mine && !readOnly} onAddPhotos={() => openModal("property", { initial: p })} />

            <div className="tabs" style={{ marginTop: 20, marginBottom: 18 }}>
                {tabs.map((id) => <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{t(`details.tabs.${id}`)}</button>)}
            </div>

            {tab === "Overview" && (
                <div className="grid-2">
                    <div className="card card-pad">
                        <div className="section-title" style={{ marginBottom: 6 }}>{t("details.overview.title")}</div>
                        {([
                            [t("details.overview.propertyType"), enumLabel("propertyType", p.type)], [t("details.overview.dealType"), enumLabel("dealType", p.dealType)],
                            [t("details.overview.city"), enumLabel("city", p.city)], [t("details.overview.district"), enumLabel("district", p.district)],
                            [t("details.overview.address"), p.address], [t("details.overview.area"), t("common.area", { value: p.area })],
                            [t("details.overview.rooms"), p.rooms], [t("details.overview.bedrooms"), p.beds],
                            [t("details.overview.bathrooms"), p.baths], [t("details.overview.floor"), p.floor], [t("details.overview.totalFloors"), p.floors],
                            [t("details.overview.condition"), enumLabel("condition", p.condition)],
                            [t("details.overview.buildingType"), enumLabel("buildingType", p.buildingType)], [t("details.overview.parking"), yesNo(p.parking)], [t("details.overview.balcony"), yesNo(p.balcony)],
                        ] as [string, React.ReactNode][]).map(([k, v]) => <div className="kv" key={k}><span className="kv-l">{k}</span><span className="kv-v">{v}</span></div>)}
                    </div>
                    <div className="stack" style={{ gap: 16 }}>
                        <div className="card card-pad">
                            <div className="section-title" style={{ marginBottom: 11 }}>{t("details.overview.keyFacts")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                                <Fact icon={<Layers size={15} />} label={t("details.overview.area")} value={t("common.area", { value: p.area })} />
                                <Fact icon={<BedDouble size={15} />} label={t("details.overview.bedrooms")} value={p.beds} />
                                <Fact icon={<DoorOpen size={15} />} label={t("details.overview.floor")} value={t("common.floorOf", { floor: p.floor, floors: p.floors })} />
                                <Fact icon={<Bath size={15} />} label={t("details.overview.bathrooms")} value={p.baths} />
                                <Fact icon={<Car size={15} />} label={t("details.overview.parking")} value={yesNo(p.parking)} />
                                <Fact icon={<Building size={15} />} label={t("details.overview.building")} value={enumLabel("buildingType", p.buildingType)} />
                            </div>
                        </div>
                        <div className="card card-pad">
                            <div className="section-title" style={{ marginBottom: 8 }}>{t("details.sourceListing.title")}</div>
                            <div className="fs-12 faint" style={{ marginBottom: 7, lineHeight: 1.5 }}>
                                {t("details.sourceListing.hint")}
                            </div>
                            <div className="fs-13 muted">{p.importedAt ? t("details.sourceListing.importedFrom", { source: p.source }) : p.sourceRef || p.sourceUrl ? enumLabel("source", p.source) : t("details.sourceListing.addedManually")}</div>
                            {p.sourceRef && <div className="fs-12 faint" style={{ marginTop: 4 }}>{t("details.sourceListing.reference", { ref: p.sourceRef })}</div>}
                            {p.sourceUrl ? (
                                <a className="link-quiet" style={{ marginTop: 8 }} href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{t("details.sourceListing.openOriginal")} <ExternalLink size={12} /></a>
                            ) : p.sourceRef ? (
                                <div className="fs-11 faint" style={{ marginTop: 8 }}>{t("details.sourceListing.noLink")}</div>
                            ) : null}
                        </div>

                        {(p.mine || hasPortalListings(p)) && (
                            <div className="card card-pad">
                                <div className="section-title" style={{ marginBottom: 8 }}>{t("details.published.title")}</div>
                                <div className="fs-12 faint" style={{ marginBottom: 9, lineHeight: 1.5 }}>
                                    {p.mine ? t("details.published.hintMine") : t("details.published.hintShared", { name: p.sharedBy })}
                                </div>
                                {p.mine && (!p.myHomeListingId || !p.ssListingId) && (
                                    <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                        {!p.myHomeListingId && <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => openModal("publish-listing", { property: p, portal: "myhome" })}>{t("details.published.publishMyHome")}</button>}
                                        {!p.ssListingId && <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => openModal("publish-listing", { property: p, portal: "ss" })}>{t("details.published.publishSS")}</button>}
                                    </div>
                                )}
                                {hasPortalListings(p) ? (
                                    <div className="stack" style={{ gap: 9 }}>
                                        {portalListings(p).map((l) => (
                                            <div className="row" key={l.portal} style={{ justifyContent: "space-between", gap: 10 }}>
                                                <div>
                                                    <div className="fs-13 bold">{l.portal}</div>
                                                    <div className="fs-12 faint">#{l.id}</div>
                                                </div>
                                                {l.url ? <a className="link-quiet" href={l.url} target="_blank" rel="noopener noreferrer">{t("details.published.openListing")} <ExternalLink size={12} /></a> : <span className="fs-11 faint">{t("details.published.noLink")}</span>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="fs-13 muted" style={{ lineHeight: 1.5 }}>{t("details.published.notYet")}</div>
                                        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} disabled={readOnly} onClick={() => openModal("property", { initial: p })}>
                                            <Pencil size={12} /> {t("details.published.addIds")}</button>
                                    </div>
                                )}
                            </div>
                        )}
                        {!p.mine && (
                            <div className="card card-pad" style={{ background: "var(--teal-tint)", border: "none" }}>
                                <div className="row fs-12 bold" style={{ color: "var(--teal)", marginBottom: 6 }}><Lock size={14} /> {t("details.sharedBy", { name: p.sharedBy })}</div>
                                <div className="fs-13" style={{ color: "var(--teal)", lineHeight: 1.55 }}>
                                    {t("details.sharedPrivacy", { name: (p.sharedBy || "").split(" ")[0] })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === "Owner & Commission" && (
                <div className="grid-2">
                    <div className="card card-pad">
                        <div className="row wrap" style={{ gap: 8, marginBottom: 13 }}>
                            <div className="section-title">{t("details.owner.title")}</div>
                            <Badge tone="brick" icon={<Lock size={11} />}>{t("details.owner.privateBadge")}</Badge>
                        </div>
                        {([
                            [t("details.owner.contactType"), enumLabel("contactType", p.contactType)], [t("details.owner.contactName"), p.contactName || t("details.owner.notRecorded")],
                            [t("details.owner.phone"), p.contactPhone || t("details.owner.notRecorded")], [t("details.owner.cooperates"), enumLabel("yesNo", p.cooperates)],
                            [t("details.owner.commissionModel"), enumLabel("commissionModel", p.commissionModel) || t("details.owner.notConfirmed")],
                            [t("details.owner.commission"), p.commissionPct === "" || p.commissionPct === null || p.commissionPct === undefined ? t("details.owner.notConfirmed") : `${pricing.commissionPct}%`],
                            [t("details.owner.portalPrice"), usd(Number(p.portalPrice))], [t("details.owner.listingPrice"), usd(Number(p.price))],
                            [t("details.owner.negotiableTo"), usd(Number(p.negotiableTo))], [t("details.owner.commissionAmount"), usd(pricing.commissionAmount)],
                        ] as [string, React.ReactNode][]).map(([k, v]) => <div className="kv" key={k}><span className="kv-l">{k}</span><span className="kv-v">{v}</span></div>)}

                        <div style={{ marginTop: 15 }}>
                            <div className="eyebrow" style={{ marginBottom: 6 }}>{t("details.owner.agentNotes")}</div>
                            <div className="fs-13" style={{ background: "var(--surface-sunk)", padding: 12, borderRadius: 10, lineHeight: 1.55, border: "1px solid var(--border)", color: p.notes ? "var(--text)" : "var(--text-faint)" }}>
                                {p.notes || t("details.owner.noNotes")}
                            </div>
                        </div>

                        <div className="row wrap" style={{ gap: 22, marginTop: 15 }}>
                            <div><div className="fs-11 faint">{t("details.owner.lastVerified")}</div><div className="fs-13 bold">{fmtDate(p.verifiedAt)}</div></div>
                            <div><div className="fs-11 faint">{t("details.owner.nextFollowUp")}</div><div className="fs-13 bold">{p.nextFollowUp ? fmtDate(p.nextFollowUp) : t("details.owner.notSet")}</div></div>
                        </div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 15 }}>
                            <button className="btn btn-primary" disabled={readOnly} onClick={() => api.markVerified(p.id)}><ShieldCheck size={14} /> {t("details.owner.markVerified")}</button>
                            <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("property", { initial: p })}><Pencil size={14} /> {t("details.owner.editPrivate")}</button>
                        </div>
                    </div>
                    <PriceCalculator model={p.commissionModel} pct={p.commissionPct} portal={p.portalPrice} price={p.price} />
                </div>
            )}

            {tab === "Activity" && (
                <div className="card card-pad">
                    {sel.activityFor(p.id).length === 0 && <div className="fs-13 muted">{t("details.activity.empty")}</div>}
                    {sel.activityFor(p.id).map((a, i) => (
                        <div className="task-row" key={i}>
                            <Clock size={14} color="var(--text-faint)" style={{ marginTop: 3 }} />
                            <div className="grow fs-13">{a.text}</div>
                            <div className="faint fs-12">{fmtDate(a.date)}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "Sent to Clients" && (
                <div className="card card-pad">
                    {sentRecords.length === 0 ? (
                        <div className="fs-13 muted">{t("details.sent.empty")}</div>
                    ) : sentRecords.map((s) => {
                        const c = sel.client(s.clientId);
                        return (
                            <div className="task-row" key={s.id}>
                                <div className="avatar sm">{initials(c?.name)}</div>
                                <div className="grow">
                                    <button className="fs-13 bold" style={{ background: "none", border: "none", padding: 0 }} onClick={() => nav("client", { id: s.clientId })}>{c?.name}</button>
                                    <div className="fs-12 faint">{t("details.sent.sentAt", { date: fmtDate(s.date), price: usd(s.price) })}</div>
                                </div>
                                <FeedbackChip value={s.feedback} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

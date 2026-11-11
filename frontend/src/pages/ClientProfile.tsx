import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Phone, MessageCircle, Plus, CheckSquare, Pencil, MoreHorizontal, Trash2, Search, Lock, Share2, X,
    PauseCircle, PlayCircle, Archive, Users, Check,
} from "lucide-react";
import type { Client, Requirement } from "../types";
import { useApp } from "../store/store";
import { propTitle } from "../lib/domain";
import { fmtDate } from "../lib/dates";
import { areaRange, usd, usdRange, initials, whatsappLink } from "../lib/format";
import { FEEDBACKS } from "../data/constants";
import { enumLabel } from "../i18n/labels";
import { ActionMenu, Badge, EmptyState, FeedbackChip, PageHeader, Photo } from "../components/ui";

const LIFECYCLE = ["active", "paused", "closed"] as const;
const badgeKey = (s: string) => (LIFECYCLE as readonly string[]).includes(s) ? (s as (typeof LIFECYCLE)[number]) : null;

function RequirementCard({ r, client }: { r: Requirement; client: Client }) {
    const { t } = useTranslation("clients");
    const { api, nav, openModal, readOnly } = useApp();
    const paused = r.status !== "active";
    const mustTags: [string, boolean][] = [
        [t("requirement.must.location"), r.must.location], [t("requirement.must.beds"), r.must.beds], [t("requirement.must.parking"), r.must.parking],
        [t("requirement.must.budget"), r.must.budget], [t("requirement.must.area"), r.must.area],
    ];
    const summary = [
        r.districts.map((d) => enumLabel("district", d)).join(", "),
        usdRange(r.budgetMin, r.budgetMax),
        areaRange(r.areaMin, r.areaMax),
        r.beds ? t("requirement.bedrooms", { count: Number(r.beds) }) : null,
        r.parking ? t("requirement.parkingRequired") : null,
    ].filter(Boolean).join(" · ");
    const k = badgeKey(r.status);

    return (
        <div className="card card-pad" style={{ opacity: paused ? 0.78 : 1 }}>
            <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div className="grow">
                    <div className="row wrap" style={{ gap: 8 }}>
                        <div className="section-title">{r.name}</div>
                        <Badge tone={r.status === "active" ? "teal" : r.status === "paused" ? "gray" : "brick"}>{k ? t(`statusBadge.${k}`) : r.status.toUpperCase()}</Badge>
                        {r.shared && <Badge tone="navy" icon={<Share2 size={11} />}>{t("requirement.sharedAnonymous")}</Badge>}
                    </div>
                    <div className="fs-13 muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{summary}</div>
                </div>
                <div className="row wrap" style={{ gap: 7 }}>
                    <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => openModal("requirement", { initial: r, clientId: r.clientId })}><Pencil size={12} /> {t("requirement.edit")}</button>
                    <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => api.setRequirementStatus(r.id, r.status === "active" ? "paused" : "active")}>
                        {r.status === "active" ? <><PauseCircle size={12} /> {t("requirement.pause")}</> : <><PlayCircle size={12} /> {t("requirement.resume")}</>}
                    </button>
                    <button className="btn btn-primary btn-sm" disabled={readOnly} onClick={() => nav("matching", { reqId: r.id })}><Search size={12} /> {t("requirement.findMatches")}</button>
                    <ActionMenu items={[
                        r.shared
                            ? { label: t("requirement.stopSharing"), icon: <X size={14} />, onClick: () => api.shareRequirement(r.id, false), disabled: readOnly }
                            : { label: t("requirement.shareWithAgency"), icon: <Share2 size={14} />, onClick: () => openModal("share-requirement", { requirement: r, client }), disabled: readOnly },
                        { label: t("requirement.close"), icon: <Archive size={14} />, onClick: () => api.setRequirementStatus(r.id, "closed"), disabled: readOnly },
                    ]}><button className="icon-btn"><MoreHorizontal size={15} /></button></ActionMenu>
                </div>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
                {mustTags.map(([label, must]) => (
                    <span className={`chip ${must ? "on-teal" : ""}`} key={label} style={{ cursor: "default", fontSize: 11 }}>
                        {must ? <Lock size={11} /> : null}{label} — {must ? t("requirement.mustHave") : t("requirement.flexible")}
                    </span>
                ))}
            </div>
            {r.notes && <div className="fs-12 faint" style={{ marginTop: 10, lineHeight: 1.5 }}>{r.notes}</div>}
        </div>
    );
}

const TABS = ["overview", "requirements", "sent", "activity"] as const;
type Tab = (typeof TABS)[number];

export default function ClientProfile({ id }: { id: string }) {
    const { t } = useTranslation("clients");
    const { sel, api, nav, openModal, readOnly } = useApp();
    const c = sel.client(id);
    const [tab, setTab] = useState<Tab>("overview");
    useEffect(() => setTab("overview"), [id]);
    if (!c) return <div className="page"><EmptyState icon={<Users size={20} />} title={t("profile.notFoundTitle")} body={t("profile.notFoundBody")} /></div>;

    const reqs = sel.clientRequirements(c.id);
    const sentList = [...sel.clientSent(c.id)].sort((a, b) => b.date.localeCompare(a.date));
    const counts = FEEDBACKS.reduce<Record<string, number>>((a, f) => ({ ...a, [f]: sentList.filter((s) => s.feedback === f).length }), {});
    const activeReq = reqs.find((r) => r.status === "active");

    const activity = [
        ...sentList.map((s) => ({ date: s.date, text: t("profile.sentAt", { property: sel.property(s.propertyId) ? propTitle(sel.property(s.propertyId)) : s.propertyLabel || t("profile.aProperty"), price: usd(s.price) }) })),
        // Only what really happened: the last-contact date the agent recorded.
        ...(c.lastContact ? [{ date: c.lastContact, text: t("profile.lastContacted") }] : []),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    const grouped = activity.reduce<Record<string, { date: string; text: string }[]>>((acc, a) => { (acc[a.date] = acc[a.date] || []).push(a); return acc; }, {});

    return (
        <div className="page">
            <PageHeader
                back={{ label: t("profile.backToClients"), onClick: () => nav("clients") }}
                title={c.name}
                actions={<>
                    {c.phone
                        ? <a className="btn btn-secondary" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}><Phone size={14} /> {t("profile.call")}</a>
                        : <button className="btn btn-secondary" disabled title={t("profile.noPhone")}><Phone size={14} /> {t("profile.call")}</button>}
                    {whatsappLink(c.phone)
                        ? <a className="btn btn-secondary" href={whatsappLink(c.phone) as string} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> {t("profile.whatsapp")}</a>
                        : <button className="btn btn-secondary" disabled title={t("profile.noPhone")}><MessageCircle size={14} /> {t("profile.whatsapp")}</button>}
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("requirement", { clientId: c.id })}><Plus size={14} /> {t("profile.addRequirement")}</button>
                    <button className="btn btn-secondary" disabled={readOnly} onClick={() => openModal("task", { initial: { clientId: c.id, title: t("followUpTitle"), type: "Follow-up" } })}><CheckSquare size={14} /> {t("profile.addTask")}</button>
                    <button className="btn btn-primary" disabled={readOnly || !activeReq} onClick={() => activeReq && nav("matching", { reqId: activeReq.id })}><MessageCircle size={14} /> {t("profile.prepareOffer")}</button>
                    <ActionMenu items={[
                        { label: t("profile.editClient"), icon: <Pencil size={14} />, onClick: () => openModal("client", { initial: c }), disabled: readOnly },
                        "sep",
                        { label: t("profile.deleteClient"), icon: <Trash2 size={14} />, danger: true, disabled: readOnly,
                            onClick: () => openModal("confirm", { title: t("profile.deleteTitle", { name: c.name }), danger: true, confirmLabel: t("profile.deleteConfirm"),
                                body: t("profile.deleteBody"),
                                onConfirm: () => { api.deleteClient(c.id); nav("clients"); } }) },
                    ]}><button className="btn btn-secondary"><MoreHorizontal size={15} /></button></ActionMenu>
                </>} />

            <div className="row wrap" style={{ gap: 12, marginTop: -8, marginBottom: 18 }}>
                <div className="avatar md">{initials(c.name)}</div>
                <div>
                    <div className="row fs-13 muted" style={{ gap: 5 }}><Phone size={12} /> {c.phone}</div>
                    <div className="row wrap fs-12 faint" style={{ gap: 12, marginTop: 4 }}>
                        <span>{t("profile.activeRequirements", { count: reqs.filter((r) => r.status === "active").length })}</span>
                        <span>{t("profile.propertiesSent", { count: sentList.length })}</span>
                        <span>{t("profile.lastContact", { date: fmtDate(c.lastContact) })}</span>
                    </div>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 18 }}>
                {TABS.map((k) => (
                    <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{t(`profile.tabs.${k}`)}</button>
                ))}
            </div>

            {(tab === "overview" || tab === "requirements") && (
                <div className="stack" style={{ gap: 13, marginBottom: 22 }}>
                    <div className="section-head" style={{ marginBottom: 0 }}>
                        <div className="section-title">{t("profile.requirementsTitle")}</div>
                        <button className="link-quiet" disabled={readOnly} onClick={() => openModal("requirement", { clientId: c.id })}><Plus size={12} /> {t("profile.addRequirementLower")}</button>
                    </div>
                    {reqs.length === 0 ? (
                        <EmptyState icon={<Search size={20} />} title={t("profile.noRequirementsTitle")}
                            body={t("profile.noRequirementsBody")}
                            action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("requirement", { clientId: c.id })}><Plus size={14} /> {t("profile.addRequirementLower")}</button>} />
                    ) : reqs.map((r) => <RequirementCard key={r.id} r={r} client={c} />)}
                </div>
            )}

            {(tab === "overview" || tab === "sent") && (
                <div style={{ marginBottom: 22 }}>
                    <div className="section-head">
                        <div className="section-title">{t("profile.sentTitle")}</div>
                        <span className="faint fs-12">{t("profile.total", { count: sentList.length })}</span>
                    </div>
                    {sentList.length === 0 ? (
                        <div className="card card-pad fs-13 muted">{t("profile.nothingSent")}</div>
                    ) : (
                        <>
                            <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                                {FEEDBACKS.filter((f) => counts[f] > 0).map((f) => (
                                    <Badge key={f} tone={f === "Interested" || f === "Wants Showing" ? "teal" : f === "Too Expensive" || f === "Not Interested" ? "brick" : f === "Viewed" ? "navy" : "gray"}>
                                        {counts[f]} {enumLabel("feedback", f)}
                                    </Badge>
                                ))}
                            </div>
                            <div className="card card-pad">
                                {sentList.map((s) => {
                                    const p = sel.property(s.propertyId);
                                    return (
                                        <div className="task-row" key={s.id} style={{ alignItems: "center" }}>
                                            {p && <Photo src={p.photos[0]} style={{ width: 46, height: 36, flexShrink: 0 }} radius={7} />}
                                            <div className="grow">
                                                <button className="fs-13 bold" style={{ background: "none", border: "none", padding: 0, textAlign: "left" }} onClick={() => p && nav("property", { id: p.id })}>{p ? propTitle(p) : t("profile.noLongerAvailable", { property: s.propertyLabel || t("profile.aProperty") })}</button>
                                                <div className="fs-12 faint">{t("profile.sentLine", { date: fmtDate(s.date), price: usd(s.price) })}{p && !p.mine ? t("profile.sharedBy", { name: p.sharedBy }) : ""}</div>
                                            </div>
                                            <ActionMenu items={FEEDBACKS.map((fb) => ({ label: enumLabel("feedback", fb), icon: fb === s.feedback ? <Check size={14} /> : <span style={{ width: 14 }} />, onClick: () => api.setFeedback(s.id, fb as typeof s.feedback), disabled: readOnly }))}>
                                                <button style={{ border: "none", background: "none", padding: 0 }} disabled={readOnly}><FeedbackChip value={s.feedback} /></button>
                                            </ActionMenu>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="fs-11 faint" style={{ marginTop: 8 }}>{t("profile.feedbackHint")}</div>
                        </>
                    )}
                </div>
            )}

            {(tab === "overview" || tab === "activity") && (
                <div>
                    <div className="section-head"><div className="section-title">{t("profile.recentActivity")}</div></div>
                    <div className="card card-pad">
                        {Object.entries(grouped).map(([date, items]) => (
                            <div className="task-row" key={date} style={{ alignItems: "flex-start" }}>
                                <div className="task-time" style={{ width: 54 }}>{fmtDate(date)}</div>
                                <div className="grow stack" style={{ gap: 4 }}>
                                    {items.map((a, i) => <div className="fs-13" key={i}>{a.text}</div>)}
                                </div>
                            </div>
                        ))}
                        {c.notes && (
                            <div style={{ marginTop: 14 }}>
                                <div className="eyebrow" style={{ marginBottom: 6 }}>{t("profile.notesPrivate")}</div>
                                <div className="fs-13" style={{ background: "var(--surface-sunk)", border: "1px solid var(--border)", padding: 12, borderRadius: 10, lineHeight: 1.55 }}>{c.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

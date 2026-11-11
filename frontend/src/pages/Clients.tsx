import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Users, MoreHorizontal, ExternalLink, CheckSquare } from "lucide-react";
import { useApp } from "../store/store";
import { fmtDate } from "../lib/dates";
import { initials } from "../lib/format";
import { ActionMenu, Badge, EmptyState, PageHeader } from "../components/ui";

const STATUS_FILTERS = ["all", "active", "paused", "closed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const LIFECYCLE = ["active", "paused", "closed"] as const;
const badgeKey = (s: string) => (LIFECYCLE as readonly string[]).includes(s) ? (s as (typeof LIFECYCLE)[number]) : null;

export default function Clients() {
    const { t } = useTranslation("clients");
    const { clients, sel, nav, openModal, readOnly } = useApp();
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const list = clients.filter((c) => {
        if (status !== "all" && c.status !== status) return false;
        const term = q.trim().toLowerCase();
        if (!term) return true;
        return c.name.toLowerCase().includes(term) || c.phone.includes(term);
    });
    const statusBadge = (s: string) => {
        const k = badgeKey(s);
        return k ? t(`statusBadge.${k}`) : s.toUpperCase();
    };
    const followUp = (clientId: string) => openModal("task", { initial: { clientId, title: t("followUpTitle"), type: "Follow-up" } });

    return (
        <div className="page">
            <PageHeader title={t("list.title")} subtitle={t("list.subtitle", { count: list.length })}
                actions={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("client", {})}><Plus size={15} /> {t("list.addClient")}</button>} />

            <div className="row wrap" style={{ justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
                <div className="search-box" style={{ maxWidth: 300 }}>
                    <Search size={15} />
                    <input placeholder={t("list.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="segmented">
                    {STATUS_FILTERS.map((s) => (
                        <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{t(`list.filter.${s}`)}</button>
                    ))}
                </div>
            </div>

            {list.length === 0 ? (
                <EmptyState icon={<Users size={20} />} title={t("list.emptyTitle")}
                    body={t("list.emptyBody")}
                    action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("client", {})}><Plus size={14} /> {t("list.addClientLower")}</button>} />
            ) : (
                <div className="card tbl-wrap desk-only">
                    <table className="tbl">
                        <thead><tr>{[t("list.col.client"), t("list.col.phone"), t("list.col.requirements"), t("list.col.lastContact"), t("list.col.sent"), t("list.col.status"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                        <tbody>
                            {list.map((c) => {
                                const reqs = sel.clientRequirements(c.id);
                                const active = reqs.filter((r) => r.status === "active").length;
                                return (
                                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => nav("client", { id: c.id })}>
                                        <td>
                                            <div className="row" style={{ gap: 9 }}>
                                                <div className="avatar sm">{initials(c.name)}</div><span className="bold">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="muted">{c.phone}</td>
                                        <td>{t("list.activeCount", { count: active })}{reqs.length > active ? t("list.totalCount", { count: reqs.length }) : ""}</td>
                                        <td className="faint">{fmtDate(c.lastContact)}</td>
                                        <td>{sel.clientSent(c.id).length}</td>
                                        <td><Badge tone={c.status === "active" ? "teal" : c.status === "paused" ? "amber" : "gray"}>{statusBadge(c.status)}</Badge></td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <ActionMenu items={[
                                                { label: t("list.openProfile"), icon: <ExternalLink size={14} />, onClick: () => nav("client", { id: c.id }) },
                                                { label: t("list.addRequirement"), icon: <Plus size={14} />, onClick: () => openModal("requirement", { clientId: c.id }), disabled: readOnly },
                                                { label: t("list.addTask"), icon: <CheckSquare size={14} />, onClick: () => followUp(c.id), disabled: readOnly },
                                            ]}><button className="icon-btn plain"><MoreHorizontal size={16} /></button></ActionMenu>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="stack mob-only" style={{ gap: 11 }}>
                {list.map((c) => {
                    const reqs = sel.clientRequirements(c.id);
                    return (
                        <div className="card card-pad" key={c.id} onClick={() => nav("client", { id: c.id })}>
                            <div className="row" style={{ gap: 10 }}>
                                <div className="avatar md">{initials(c.name)}</div>
                                <div className="grow">
                                    <div className="fs-14 bold">{c.name}</div>
                                    <div className="fs-12 muted">{c.phone}</div>
                                </div>
                                <Badge tone={c.status === "active" ? "teal" : c.status === "paused" ? "amber" : "gray"}>{statusBadge(c.status)}</Badge>
                            </div>
                            <div className="row wrap fs-12 faint" style={{ gap: 12, marginTop: 10 }}>
                                <span>{t("list.activeRequirements", { count: reqs.filter((r) => r.status === "active").length })}</span>
                                <span>{t("list.sentCount", { count: sel.clientSent(c.id).length })}</span>
                                <span>{t("list.lastContact", { date: fmtDate(c.lastContact) })}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

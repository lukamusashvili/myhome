import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "../store/store";
import { propTitle } from "../lib/domain";
import { usd } from "../lib/format";
import { daysAgo, fmtDate } from "../lib/dates";
import { EmptyState, PageHeader, Photo } from "../components/ui";
import { enumLabel } from "../i18n/labels";

export default function ArchiveTrash() {
    const { properties, trash, api, nav, openModal, readOnly } = useApp();
    const { t } = useTranslation("workspace");
    const [tab, setTab] = useState<"Archived" | "Recently Deleted">("Archived");
    const archived = properties.filter((p) => !p.deleted && p.status === "archived");
    return (
        <div className="page">
            <PageHeader title={t("archive.title")} subtitle={t("archive.subtitle")} />
            <div className="tabs" style={{ marginBottom: 16 }}>
                {(["Archived", "Recently Deleted"] as const).map((key) => (
                    <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                        {t(`archive.tabs.${key}`)} <span className="faint">{key === "Archived" ? archived.length : trash.length}</span>
                    </button>
                ))}
            </div>

            {tab === "Archived" ? (
                archived.length === 0 ? (
                    <EmptyState icon={<Archive size={20} />} title={t("archive.emptyArchivedTitle")} body={t("archive.emptyArchivedBody")} />
                ) : (
                    <div className="card tbl-wrap">
                        <table className="tbl">
                            <thead><tr>{[t("archive.cols.property"), t("archive.cols.price"), t("archive.cols.reason"), t("archive.cols.lastVerified"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                            <tbody>
                                {archived.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="row" style={{ gap: 9 }}>
                                                <Photo src={p.photos[0]} style={{ width: 34, height: 26, flexShrink: 0 }} radius={5} />
                                                <button className="bold" style={{ background: "none", border: "none", padding: 0 }} onClick={() => nav("property", { id: p.id })}>{propTitle(p)}</button>
                                            </div>
                                        </td>
                                        <td>{usd(Number(p.price))}</td>
                                        <td><span className="badge badge-gray">{enumLabel("archiveReason", p.archiveReason || "Inactive")}</span></td>
                                        <td className="faint">{fmtDate(p.verifiedAt)}</td>
                                        <td>
                                            <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                                                <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => api.reactivateProperty(p.id)}><RotateCcw size={12} /> {t("archive.reactivate")}</button>
                                                <button className="icon-btn" disabled={readOnly} onClick={() => openModal("confirm", {
                                                    title: t("archive.deleteTitle"), danger: true, confirmLabel: t("archive.deleteConfirm"),
                                                    body: t("archive.deleteBody"),
                                                    onConfirm: () => api.deleteProperty(p.id),
                                                })}><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : trash.length === 0 ? (
                <EmptyState icon={<Trash2 size={20} />} title={t("archive.emptyTrashTitle")} body={t("archive.emptyTrashBody")} />
            ) : (
                <>
                    <div className="card tbl-wrap">
                        <table className="tbl">
                            <thead><tr>{[t("archive.cols.item"), t("archive.cols.type"), t("archive.cols.deleted"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                            <tbody>
                                {trash.map((item) => (
                                    <tr key={item.id}>
                                        <td className="bold">{item.label}</td>
                                        <td><span className="badge badge-gray">{enumLabel("trashKind", item.kind).toUpperCase()}</span></td>
                                        <td className="faint">{fmtDate(item.deletedAt)} · {t("archive.daysLeft", { count: 30 - daysAgo(item.deletedAt) })}</td>
                                        <td>
                                            <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                                                <button className="btn btn-secondary btn-sm" disabled={readOnly} onClick={() => api.restoreTrash(item)}><RotateCcw size={12} /> {t("archive.restore")}</button>
                                                <button className="icon-btn" disabled={readOnly} onClick={() => openModal("confirm", {
                                                    title: t("archive.purgeTitle"), danger: true, confirmLabel: t("archive.purgeConfirm"),
                                                    body: t("archive.purgeBody"), onConfirm: () => api.purgeTrash(item),
                                                })}><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="fs-12 faint" style={{ marginTop: 10 }}>{t("archive.purgeNote")}</div>
                </>
            )}
        </div>
    );
}

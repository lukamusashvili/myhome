import { useTranslation } from "react-i18next";
import { Inbox, Plus, Trash2, User } from "lucide-react";
import { useApp } from "../store/store";
import { propTitle } from "../lib/domain";
import { fmtDate } from "../lib/dates";
import { Badge, EmptyState, PageHeader, Photo } from "../components/ui";

export default function Inquiries() {
    const { t } = useTranslation("workspace");
    const { inquiries, sel, nav, openModal, api, readOnly } = useApp();
    const open = inquiries.filter((i) => !i.converted);
    return (
        <div className="page">
            <PageHeader title={t("inquiries.title")} subtitle={t("inquiries.subtitle")}
                actions={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("inquiry", {})}><Plus size={15} /> {t("inquiries.logInquiry")}</button>} />
            {inquiries.length === 0 ? (
                <EmptyState icon={<Inbox size={20} />} title={t("inquiries.emptyTitle")}
                    body={t("inquiries.emptyBody")}
                    action={<button className="btn btn-primary" disabled={readOnly} onClick={() => openModal("inquiry", {})}><Plus size={14} /> {t("inquiries.logInquiryLower")}</button>} />
            ) : (
                <div className="stack" style={{ gap: 12 }}>
                    {inquiries.map((i) => {
                        const p = i.propertyId ? sel.property(i.propertyId) : null;
                        return (
                            <div className="card card-pad" key={i.id} style={{ opacity: i.converted ? 0.65 : 1 }}>
                                <div className="row wrap" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                                    <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                                        {p && <Photo src={p.photos[0]} style={{ width: 58, height: 46, flexShrink: 0 }} radius={8} />}
                                        <div>
                                            <div className="row wrap" style={{ gap: 8 }}>
                                                <div className="fs-14 bold">{i.phone}</div>
                                                {i.converted ? <Badge tone="teal">{t("inquiries.converted")}</Badge> : <Badge tone="amber">{t("inquiries.new")}</Badge>}
                                            </div>
                                            <div className="fs-12 muted" style={{ marginTop: 4 }}>
                                                {p ? `${t("inquiries.about", { property: propTitle(p) })}${i.listingReference ? ` · ${i.listingReference.label}` : ""}` : t("inquiries.noProperty")} · {fmtDate(i.date)}
                                            </div>
                                            <div className="fs-13" style={{ marginTop: 7, lineHeight: 1.5 }}>{t("inquiries.quoted", { note: i.note })}</div>
                                        </div>
                                    </div>
                                    <div className="row wrap" style={{ gap: 7 }}>
                                        {i.converted ? (
                                            <button className="btn btn-secondary btn-sm" onClick={() => nav("client", { id: i.clientId })}>{t("inquiries.openClient")}</button>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary btn-sm" disabled={readOnly} onClick={() => openModal("convert-inquiry", { inquiry: i })}><User size={12} /> {t("inquiries.convert")}</button>
                                                <button className="icon-btn" title={t("inquiries.delete")} aria-label={t("inquiries.delete")} disabled={readOnly} onClick={() => api.deleteInquiry(i.id)}><Trash2 size={13} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {open.length > 0 && (
                <div className="fs-12 faint" style={{ marginTop: 12 }}>
                    {t("inquiries.waiting", { count: open.length })}
                </div>
            )}
        </div>
    );
}

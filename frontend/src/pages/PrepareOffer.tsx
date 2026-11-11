import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CheckSquare, Eye, MessageCircle, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "../store/store";
import { propTitle } from "../lib/domain";
import { usd, parseMoney, whatsappLink } from "../lib/format";
import { TODAY, fmtDate, shiftDate } from "../lib/dates";
import { enumLabel } from "../i18n/labels";
import { EmptyState, Modal, PageHeader, Photo, SourceBadge } from "../components/ui";

export default function PrepareOffer({ clientId, ids, reqId }: { clientId: string; ids: string[]; reqId?: string }) {
    const { t } = useTranslation("clients");
    const { sel, api, nav, openModal, readOnly, settings } = useApp();
    const client = sel.client(clientId);
    const [items, setItems] = useState(() => (ids || []).map((id) => {
        const p = sel.property(id);
        return { id, price: p ? Number(p.price) : 0 };
    }));
    const [preview, setPreview] = useState(false);
    const [phase, setPhase] = useState<"edit" | "sent">("edit");

    if (!client) return <div className="page"><EmptyState icon={<AlertTriangle size={20} />} title={t("offer.notFoundTitle")} body={t("offer.notFoundBody")} /></div>;

    const setPrice = (id: string, v: string) => setItems((l) => l.map((i) => (i.id === id ? { ...i, price: parseMoney(v) } : i)));
    const remove = (id: string) => setItems((l) => l.filter((i) => i.id !== id));

    const firstName = client.name.split(" ")[0];
    // Written in the agent's current language: it is what the client reads.
    const message = [
        t("offer.message.greeting", { name: firstName }), "",
        ...items.map((i, n) => {
            const p = sel.property(i.id);
            return `${t("offer.message.line", { n: n + 1, property: propTitle(p), price: usd(i.price) })}\n${t("offer.message.details", { area: p?.area, count: Number(p?.beds) || 0, floor: p?.floor, floors: p?.floors })}${p?.parking ? t("offer.message.parking") : ""}`;
        }), "", t("offer.message.closing"), `${settings.profile.name} · ${settings.profile.phone}`,
    ].join("\n");

    const link = whatsappLink(client.phone, message);
    // Opens the chat with the message prefilled; the agent presses send in
    // WhatsApp. Opened inside the click so the browser doesn't block it.
    const send = () => {
        if (!link) return;
        window.open(link, "_blank", "noopener,noreferrer");
        api.sendOffer(clientId, items);
        setPhase("sent");
        api.toast(t("offer.openedToast", { name: firstName }));
    };

    if (phase === "sent") {
        return (
            <div className="page">
                <div className="card card-pad" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
                    <div className="empty-mark" style={{ background: "var(--teal-tint)", color: "var(--teal)" }}><CheckCircle2 size={22} /></div>
                    <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>{t("offer.sentTitle")}</h2>
                    <div className="fs-13 muted" style={{ lineHeight: 1.6, marginBottom: 16 }}>
                        {t("offer.sentBody", { count: items.length, client: client.name, name: firstName })}
                    </div>
                    <div className="row wrap" style={{ gap: 8, justifyContent: "center" }}>
                        <button className="btn btn-primary" onClick={() => nav("client", { id: clientId })}>{t("offer.openHistory", { name: firstName })}</button>
                        <button className="btn btn-secondary" onClick={() => openModal("task", {
                            initial: { clientId, title: t("followUpTitle"), type: "Follow-up", date: shiftDate(TODAY, 2), time: "11:00",
                                notes: t("offer.followUpNotes", { count: items.length, date: fmtDate(TODAY), name: firstName }) },
                        })}><CheckSquare size={14} /> {t("offer.addFollowUp")}</button>
                        <button className="btn btn-ghost" onClick={() => nav("dashboard")}>{t("offer.backToDashboard")}</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page page-with-bar">
            <PageHeader
                back={{ label: reqId ? t("offer.backToMatches") : t("offer.backTo", { name: client.name }), onClick: () => (reqId ? nav("matching", { reqId }) : nav("client", { id: clientId })) }}
                title={t("offer.title", { name: firstName })}
                subtitle={t("offer.subtitle")} />

            {items.length === 0 ? (
                <EmptyState icon={<MessageCircle size={20} />} title={t("offer.emptyTitle")}
                    body={t("offer.emptyBody")}
                    action={<button className="btn btn-primary" onClick={() => nav("matching", { reqId })}>{t("offer.backToMatches")}</button>} />
            ) : (
                <div className="stack" style={{ gap: 13 }}>
                    {items.map((item) => {
                        const p = sel.property(item.id);
                        if (!p) return null;
                        const already = sel.lastSent(clientId, item.id);
                        const changed = item.price !== Number(p.price);
                        return (
                            <div className="card card-pad" key={item.id}>
                                <div className="row wrap" style={{ gap: 13, alignItems: "flex-start" }}>
                                    <Photo src={p.photos[0]} alt={propTitle(p)} style={{ width: 104, height: 82, flexShrink: 0 }} radius={9} />
                                    <div className="grow" style={{ minWidth: 170 }}>
                                        <div className="row wrap" style={{ gap: 8 }}>
                                            <div className="fs-13 bold">{propTitle(p)}</div>
                                            <SourceBadge p={p} />
                                        </div>
                                        <div className="fs-12 faint" style={{ marginTop: 4 }}>
                                            {t("facts", { area: p.area, count: Number(p.beds) || 0, floor: p.floor, floors: p.floors })}{p.parking ? t("factsParking") : ""}
                                        </div>
                                        <div className="fs-12 faint" style={{ marginTop: 3 }}>{t("offer.listedAt", { price: usd(Number(p.price)) })}</div>
                                        {already && (
                                            <div className="row fs-12" style={{ gap: 7, marginTop: 9, background: "var(--amber-tint)", color: "var(--amber)", padding: "7px 10px", borderRadius: 8, alignItems: "flex-start" }}>
                                                <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                                                <span>{t("offer.alreadySent", { date: fmtDate(already.date), price: usd(already.price), feedback: enumLabel("feedback", already.feedback) })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div className="fs-11 faint" style={{ marginBottom: 5 }}>{t("offer.clientPrice")}</div>
                                        <input className="price-input" value={usd(item.price)} onChange={(e) => setPrice(item.id, e.target.value)} />
                                        {changed && <div className="fs-11" style={{ color: "var(--teal)", marginTop: 5 }}>{t("offer.editedFrom", { price: usd(Number(p.price)) })}</div>}
                                        <div className="row" style={{ gap: 6, marginTop: 9, justifyContent: "flex-end" }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setPrice(item.id, String(p.price))}>{t("offer.reset")}</button>
                                            <button className="icon-btn" title={t("offer.removeFromOffer")} onClick={() => remove(item.id)}><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setPreview(true)}><Eye size={14} /> {t("offer.preview")}</button>
                </div>
            )}

            {preview && (
                <Modal title={t("offer.previewTitle")} onClose={() => setPreview(false)}
                    subtitle={t("offer.previewSubtitle")}
                    footer={<button className="btn btn-secondary" onClick={() => setPreview(false)}>{t("actions.close", { ns: "common" })}</button>}>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, 'Noto Sans Georgian', sans-serif", fontSize: 13, lineHeight: 1.6, background: "var(--teal-tint)", padding: 14, borderRadius: 12, margin: 0, color: "var(--text)" }}>{message}</pre>
                </Modal>
            )}

            <div className="sticky-bar">
                <div>
                    <div className="fs-13 bold">{t("offer.ready", { count: items.length })}</div>
                    <div className="fs-11 faint">{link ? t("offer.opensWhatsapp") : t("offer.addPhone", { name: firstName })}</div>
                </div>
                <button className="btn btn-teal" disabled={!items.length || readOnly || !link} onClick={send}>
                    <MessageCircle size={15} /> {t("offer.share")}
                </button>
            </div>
        </div>
    );
}

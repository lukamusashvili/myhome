import { Check, Download, Lock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store/store";
import { Stat } from "../components/ui";

const CAN = ["browse", "clients", "history", "tasks", "export"] as const;
const PAUSED = ["add", "requirements", "tasks", "share", "offers"] as const;

export default function TrialExpired() {
    const { t } = useTranslation("account");
    const { api, nav, openModal, properties, clients, sent } = useApp();
    return (
        <div className="page">
            <div className="card card-pad" style={{ maxWidth: 620, margin: "24px auto" }}>
                <div className="row" style={{ gap: 9, marginBottom: 12 }}>
                    <div className="empty-mark" style={{ margin: 0, width: 38, height: 38 }}><Lock size={18} /></div>
                    <div>
                        <h2 style={{ fontSize: 19, fontWeight: 600 }}>{t("trial.title")}</h2>
                        <div className="fs-13 muted" style={{ marginTop: 3 }}>{t("trial.subtitle")}</div>
                    </div>
                </div>

                <div className="grid-3" style={{ marginBottom: 16 }}>
                    <Stat label={t("trial.properties")} value={properties.filter((p) => p.mine && !p.deleted).length} />
                    <Stat label={t("trial.clients")} value={clients.length} />
                    <Stat label={t("trial.sentRecords")} value={sent.length} />
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 7 }}>{t("trial.canStill")}</div>
                        {CAN.map((k) => (
                            <div className="row fs-13" key={k} style={{ gap: 7, marginBottom: 5 }}><Check size={13} color="var(--teal)" />{t(`trial.can.${k}`)}</div>
                        ))}
                    </div>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 7 }}>{t("trial.paused")}</div>
                        {PAUSED.map((k) => (
                            <div className="row fs-13" key={k} style={{ gap: 7, marginBottom: 5, color: "var(--text-faint)" }}><X size={13} />{t(`trial.pausedItems.${k}`)}</div>
                        ))}
                    </div>
                </div>

                <div className="card card-pad" style={{ background: "var(--teal-tint)", border: "none", marginBottom: 16 }}>
                    <div className="fs-13 bold" style={{ color: "var(--teal)" }}>{t("trial.yourData")}</div>
                    <div className="fs-12" style={{ color: "var(--teal)", marginTop: 4, lineHeight: 1.5 }}>{t("trial.yourDataBody")}</div>
                </div>

                <div className="row wrap" style={{ gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => api.toast(t("trial.checkoutToast"))}>{t("trial.upgrade")}</button>
                    <button className="btn btn-secondary" onClick={() => openModal("export", {})}><Download size={14} /> {t("trial.export")}</button>
                    <button className="btn btn-ghost" onClick={() => nav("dashboard")}>{t("trial.keepLooking")}</button>
                </div>
            </div>
        </div>
    );
}

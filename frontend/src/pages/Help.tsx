import { useTranslation } from "react-i18next";
import { useApp } from "../store/store";
import { PageHeader, Textarea } from "../components/ui";

export default function Help() {
    const { t } = useTranslation("account");
    const { api, nav } = useApp();
    const journeys: ["import" | "match" | "offer" | "share", () => void][] = [
        ["import", () => nav("import")],
        ["match", () => nav("clients")],
        ["offer", () => nav("clients")],
        ["share", () => nav("properties")],
    ];
    return (
        <div className="page">
            <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
            <div className="grid-2">
                <div className="stack" style={{ gap: 12 }}>
                    {journeys.map(([key, go]) => (
                        <button className="card card-pad" key={key} style={{ textAlign: "left" }} onClick={go}>
                            <div className="fs-14 bold">{t(`help.journeys.${key}.title`)}</div>
                            <div className="fs-12 muted" style={{ marginTop: 4 }}>{t(`help.journeys.${key}.path`)}</div>
                        </button>
                    ))}
                </div>
                <div className="card card-pad">
                    <div className="section-title" style={{ marginBottom: 8 }}>{t("help.feedbackTitle")}</div>
                    <div className="fs-13 muted" style={{ lineHeight: 1.55, marginBottom: 11 }}>
                        {t("help.feedbackBody")}
                    </div>
                    <Textarea placeholder={t("help.feedbackPlaceholder")} />
                    <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => api.toast(t("help.sentToast"))}>{t("help.send")}</button>
                </div>
            </div>
        </div>
    );
}
